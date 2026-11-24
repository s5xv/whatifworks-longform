#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

GH_BIN="$(command -v gh || true)"
if [ -z "$GH_BIN" ] && [ -x "$HOME/.local/opt/gh-cli/bin/gh" ]; then
  GH_BIN="$HOME/.local/opt/gh-cli/bin/gh"
fi
if [ -z "$GH_BIN" ]; then
  echo "Error: gh CLI not found in PATH or ~/.local/opt/gh-cli/bin/gh" >&2
  exit 1
fi

COMP="LongFormMain"
WORKERS=""
WORKERS_SET=0
OUTPUT_NAME="episode"
COMMIT_MSG="Update episode for cloud render"
DO_PUSH=1

# Parse positional args or flags
POSITIONAL=()
while [ $# -gt 0 ]; do
  case "$1" in
    -c|--composition) COMP="$2"; shift 2 ;;
    -w|--workers)     WORKERS="$2"; WORKERS_SET=1; shift 2 ;;
    -o|--output)      OUTPUT_NAME="$2"; shift 2 ;;
    -m|--message)     COMMIT_MSG="$2"; shift 2 ;;
    --no-push)        DO_PUSH=0; shift ;;
    -h|--help)
      echo "Usage: $0 [composition] [workers] [output_name] [--message MSG] [--no-push]"
      exit 0
      ;;
    *) POSITIONAL+=("$1"); shift ;;
  esac
done

if [ ${#POSITIONAL[@]} -ge 1 ]; then COMP="${POSITIONAL[0]}"; fi
if [ ${#POSITIONAL[@]} -ge 2 ]; then WORKERS="${POSITIONAL[1]}"; WORKERS_SET=1; fi
if [ ${#POSITIONAL[@]} -ge 3 ]; then OUTPUT_NAME="${POSITIONAL[2]}"; fi

# Auto-scale GitHub Actions workers: 5 for single chapter, 15 for LongFormMain
if [ "$WORKERS_SET" -eq 0 ] || [ -z "$WORKERS" ]; then
  if [ "$COMP" = "LongFormMain" ]; then
    WORKERS="15"
  else
    WORKERS="5"
  fi
fi

# Sanitize output name to match render_matrix.yml stitch step
SAFE_NAME="$(printf '%s' "$OUTPUT_NAME" | tr -cd 'A-Za-z0-9._-')"
[ -n "$SAFE_NAME" ] || SAFE_NAME="episode"

# Mandatory Pre-Flight QA Gate before git push / cloud render
echo "[cloud_render] Running pre-flight QA gate (composition=$COMP)..."
if [ "$COMP" = "LongFormMain" ]; then
  node "$ROOT_DIR/scripts/qa_longform.mjs"
else
  node "$ROOT_DIR/scripts/qa_longform.mjs" --chapter "$COMP"
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if [ "$DO_PUSH" -eq 1 ]; then
  echo "[cloud_render] Checking git status on branch '$BRANCH'..."
  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "$COMMIT_MSG"
  fi
  echo "[cloud_render] Pushing '$BRANCH' to origin..."
  git push origin "$BRANCH"
fi

HEAD_SHA="$(git rev-parse HEAD)"

# Snapshot existing workflow run IDs so we reliably pick the newly dispatched run
PREV_IDS="$("$GH_BIN" run list --workflow=render_matrix.yml --event=workflow_dispatch --limit 10 --json databaseId --jq '.[].databaseId' 2>/dev/null || true)"

echo "[cloud_render] Dispatching render_matrix.yml: composition=$COMP workers=$WORKERS output_name=$SAFE_NAME (commit ${HEAD_SHA:0:7})..."
"$GH_BIN" workflow run render_matrix.yml \
  --ref "$BRANCH" \
  -f composition="$COMP" \
  -f workers="$WORKERS" \
  -f output_name="$SAFE_NAME"

RUN_ID=""
echo "[cloud_render] Waiting for GitHub Actions run to register..."
for _ in $(seq 1 30); do
  CAND_JSON="$("$GH_BIN" run list --workflow=render_matrix.yml --event=workflow_dispatch --limit 10 --json databaseId,headSha,status)"
  RUN_ID="$(python3 -c '
import json, sys
runs = json.loads(sys.argv[1])
prev = set(sys.argv[2].split())
sha = sys.argv[3]
for r in runs:
    rid = str(r["databaseId"])
    if rid not in prev and r.get("headSha") == sha:
        print(rid)
        break
' "$CAND_JSON" "$PREV_IDS" "$HEAD_SHA")"
  if [ -n "$RUN_ID" ]; then
    break
  fi
  sleep 2
done

if [ -z "$RUN_ID" ]; then
  echo "Error: Timed out waiting for workflow run to appear in gh run list." >&2
  exit 1
fi

RUN_URL="$("$GH_BIN" run view "$RUN_ID" --json url --jq '.url')"
echo "[cloud_render] Run registered: #$RUN_ID ($RUN_URL)"
echo "[cloud_render] Watching run progress..."

if ! "$GH_BIN" run watch "$RUN_ID" --exit-status; then
  echo "[cloud_render] Run #$RUN_ID failed! Fetching failed job logs..." >&2
  "$GH_BIN" run view "$RUN_ID" --log-failed || true
  exit 1
fi

mkdir -p "$ROOT_DIR/renders"
TMP_DL="$(mktemp -d "$ROOT_DIR/renders/.dl_XXXXXX")"
trap 'rm -rf "$TMP_DL"' EXIT

echo "[cloud_render] Downloading artifact '$SAFE_NAME'..."
"$GH_BIN" run download "$RUN_ID" -n "$SAFE_NAME" -D "$TMP_DL"

DOWNLOADED_FILE="$(find "$TMP_DL" -type f -name "*.mp4" | head -n 1)"
if [ -z "$DOWNLOADED_FILE" ] || [ ! -f "$DOWNLOADED_FILE" ]; then
  echo "Error: No .mp4 found inside downloaded artifact '$SAFE_NAME'." >&2
  exit 1
fi

FINAL_MP4="$ROOT_DIR/renders/${SAFE_NAME}.mp4"
mv -f "$DOWNLOADED_FILE" "$FINAL_MP4"

echo "[cloud_render] Complete! Downloaded to: $FINAL_MP4"
if command -v ffprobe >/dev/null 2>&1; then
  ffprobe -hide_banner -v error \
    -show_entries stream=width,height,r_frame_rate,codec_name \
    -show_entries format=duration,size \
    "$FINAL_MP4"
fi

echo ""
echo "=== YouTube Chapters ==="
node -e '
const fs = require("fs");
const m = JSON.parse(fs.readFileSync("longform/manifest.json", "utf8"));
const fmt = (s) => {
  const sec = Math.round(s);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const r = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
    : `${m}:${String(r).padStart(2, "0")}`;
};
let cur = 0;
for (const ch of m.chapters || []) {
  console.log(`${fmt(cur)} ${ch.title}`);
  cur += Number(ch.durationSec) || 0;
}
'
