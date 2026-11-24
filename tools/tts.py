#!/usr/bin/env python3
"""Project-local TTS entrypoint delegating to /whatifworks kit/tts.py."""
import sys
from pathlib import Path

CANDIDATES = [
    Path.home() / '.config' / 'opencode' / 'anim-skills' / 'kit',
    Path.home() / '.gemini' / 'config' / 'plugins' / 'migrated-settings' / 'kit',
]
KIT = next((p for p in CANDIDATES if (p / 'tts.py').is_file()), None)
if KIT is None:
    raise SystemExit('Could not locate anim-skills/kit/tts.py')

if str(KIT) not in sys.path:
    sys.path.insert(0, str(KIT))

import tts  # noqa: E402

if __name__ == '__main__':
    tts.main()
