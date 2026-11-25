#!/usr/bin/env python3
"""Bundle assets/voice_ref.wav and scripts/ch*.json into cloud/colab_tts_bundle.zip.

Pass --push-drive to automatically upload/update colab_tts_bundle.zip in Google Drive
via `gdrive` so Colab reads it without any browser file-upload prompts.
"""
import argparse
import json
import shutil
import subprocess
import time
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOICE_REF = ROOT / 'assets' / 'voice_ref.wav'
SCRIPTS_DIR = ROOT / 'scripts'
OUT_ZIP = ROOT / 'cloud' / 'colab_tts_bundle.zip'
DRIVE_BUNDLE_ID = '1nGQ0M4kddgdg1IXvlaXPrd0wH5p4sMe-'


def push_to_drive(zip_path: Path):
    gdrive_bin = shutil.which('gdrive')
    if not gdrive_bin:
        cand = Path.home() / '.gemini' / 'config' / 'plugins' / 'gdrive' / 'skills' / 'gdrive' / 'scripts' / 'gdrive'
        if cand.is_file():
            subprocess.run([str(cand), '--version'], check=True, stdout=subprocess.DEVNULL)
            gdrive_bin = 'gdrive'
        else:
            raise SystemExit('gdrive CLI not found in PATH')

    for attempt in range(3):
        res = subprocess.run(
            [gdrive_bin, 'mutate', 'update', DRIVE_BUNDLE_ID, str(zip_path)],
            capture_output=True,
            text=True,
        )
        if res.returncode == 0:
            print(res.stdout.strip())
            return
        if 'rateLimitExceeded' in res.stderr and attempt < 2:
            print(f'[pack_colab_tts] Drive rate limit, retrying in 5s...')
            time.sleep(5)
            continue
        if 'notFound' in res.stderr or '404' in res.stderr:
            print('[pack_colab_tts] Drive ID not found, uploading as new file...')
            subprocess.run([gdrive_bin, 'mutate', 'upload', str(zip_path)], check=True)
            return
        raise SystemExit(f'[pack_colab_tts] Drive update failed:\n{res.stderr.strip()}')


def main():
    ap = argparse.ArgumentParser(description='Pack voice_ref.wav + scripts/ch*.json for Colab T4 TTS')
    ap.add_argument('--push-drive', action='store_true', help='Update colab_tts_bundle.zip in Google Drive via gdrive')
    args = ap.parse_args()

    if not VOICE_REF.is_file():
        raise SystemExit(f'Missing voice reference: {VOICE_REF}')

    chapter_files = sorted(SCRIPTS_DIR.glob('ch*.json'))
    if not chapter_files:
        raise SystemExit(f'No ch*.json scripts found in {SCRIPTS_DIR}')

    OUT_ZIP.parent.mkdir(parents=True, exist_ok=True)

    total_beats = 0
    with zipfile.ZipFile(OUT_ZIP, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(VOICE_REF, arcname='voice_ref.wav')
        for cf in chapter_files:
            data = json.loads(cf.read_text(encoding='utf-8'))
            if not isinstance(data, list):
                raise SystemExit(f'Expected JSON array in {cf}')
            total_beats += len(data)
            zf.write(cf, arcname=f'scripts/{cf.name}')

    size_kb = OUT_ZIP.stat().st_size / 1024.0
    print(f'[pack_colab_tts] Bundled voice_ref.wav + {len(chapter_files)} chapter(s) ({total_beats} beats)')
    print(f'[pack_colab_tts] Output: {OUT_ZIP} ({size_kb:.1f} KB)')

    if args.push_drive:
        push_to_drive(OUT_ZIP)


if __name__ == '__main__':
    main()
