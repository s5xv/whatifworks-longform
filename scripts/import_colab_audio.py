#!/usr/bin/env python3
"""Import colab_audio_out.zip -> public/audio/, run local Parakeet align.py, and update manifest.json durations."""
import json
import os
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_AUDIO = ROOT / 'public' / 'audio'
SCRIPTS_DIR = ROOT / 'scripts'
MANIFEST_PATH = ROOT / 'longform' / 'manifest.json'

ALIGN_CANDIDATES = [
    Path.home() / '.config' / 'opencode' / 'anim-skills' / 'skills' / 'whatifworks' / 'tools' / 'align.py',
    Path.home() / '.gemini' / 'config' / 'plugins' / 'migrated-settings' / 'skills' / 'whatifworks' / 'tools' / 'align.py',
]
KIT_PY_CANDIDATES = [
    Path.home() / '.config' / 'opencode' / 'anim-skills' / 'kit' / '.venv' / 'bin' / 'python',
    Path.home() / '.gemini' / 'config' / 'plugins' / 'migrated-settings' / 'kit' / '.venv' / 'bin' / 'python',
]


def resolve_zip(cli_arg: str | None) -> Path:
    if cli_arg:
        p = Path(cli_arg).expanduser().resolve()
        if not p.is_file():
            raise SystemExit(f'Zip file not found: {p}')
        return p
    for cand in [
        ROOT / 'cloud' / 'colab_audio_out.zip',
        ROOT / 'colab_audio_out.zip',
        Path.home() / 'Downloads' / 'colab_audio_out.zip',
    ]:
        if cand.is_file():
            return cand
    raise SystemExit('Could not find colab_audio_out.zip (pass path as argument or place in ~/Downloads/ or cloud/)')


def ffprobe_duration(mp3_path: Path) -> float:
    out = subprocess.check_output(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', str(mp3_path)],
        text=True,
    ).strip()
    return float(out)


def main():
    zip_path = resolve_zip(sys.argv[1] if len(sys.argv) > 1 else None)
    align_py = next((p for p in ALIGN_CANDIDATES if p.is_file()), None)
    if not align_py:
        raise SystemExit('Could not locate align.py in anim-skills or migrated-settings')
    kit_py = next((p for p in KIT_PY_CANDIDATES if p.is_file()), Path(sys.executable))

    PUBLIC_AUDIO.mkdir(parents=True, exist_ok=True)
    extracted: list[Path] = []

    with zipfile.ZipFile(zip_path, 'r') as zf:
        for member in sorted(zf.namelist()):
            name = Path(member).name
            if not name.endswith('.mp3') or not name.startswith('ch'):
                continue
            target = PUBLIC_AUDIO / name
            with zf.open(member) as src, open(target, 'wb') as dst:
                dst.write(src.read())
            extracted.append(target)
            print(f'[import] Extracted {target.relative_to(ROOT)}')

    if not extracted:
        raise SystemExit(f'No ch*.mp3 files found in {zip_path}')

    manifest = json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))
    ch_by_id = {ch['id']: ch for ch in manifest.get('chapters', [])}

    with tempfile.TemporaryDirectory(prefix='colab_align_') as tmp_dir:
        tmp = Path(tmp_dir)
        for mp3_path in extracted:
            ch_id = mp3_path.stem
            dur = round(ffprobe_duration(mp3_path), 2)
            words_out = PUBLIC_AUDIO / f'{ch_id}.words.json'
            script_src = SCRIPTS_DIR / f'{ch_id}.json'

            if not script_src.is_file():
                print(f'[import] Warning: missing {script_src.relative_to(ROOT)}, skipping alignment for {ch_id}')
            else:
                raw_beats = json.loads(script_src.read_text(encoding='utf-8'))
                lines = [b['text'] if isinstance(b, dict) else str(b) for b in raw_beats]
                lines_json = tmp / f'{ch_id}.lines.json'
                lines_json.write_text(json.dumps(lines, indent=2), encoding='utf-8')

                wav_tmp = tmp / f'{ch_id}.wav'
                subprocess.run(
                    ['ffmpeg', '-y', '-v', 'error', '-i', str(mp3_path), '-ac', '1', '-ar', '16000', str(wav_tmp)],
                    check=True,
                )
                subprocess.run(
                    [str(kit_py), str(align_py), str(wav_tmp), str(lines_json), str(words_out)],
                    check=True,
                )

            if ch_id in ch_by_id:
                ch_by_id[ch_id]['durationSec'] = dur
                ch_by_id[ch_id]['audio'] = f'audio/{mp3_path.name}'
                if words_out.is_file():
                    ch_by_id[ch_id]['words'] = f'audio/{words_out.name}'
                print(f'[import] Updated manifest {ch_id}: durationSec={dur}s')

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(f'[import] Saved {MANIFEST_PATH.relative_to(ROOT)}. Ready for `npm run qa`.')


if __name__ == '__main__':
    main()
