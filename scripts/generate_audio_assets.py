#!/usr/bin/env python3
"""Generate procedural royalty-free 16:9 BGM loop and SFX cues for whatifworks-longform."""
import math
import os
import random
import struct
import subprocess
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / 'public' / 'audio'
SFX_DIR = AUDIO_DIR / 'sfx'
SR = 44100


def write_wav_and_mp3(samples, out_mp3: Path, bitrate: str = '128k'):
    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        wav_path = tmp.name
    try:
        peak = max((abs(s) for s in samples), default=1.0)
        scale = 0.88 / max(peak, 1e-6) if peak > 0.88 else 1.0
        pcm = bytearray()
        for s in samples:
            v = max(-1.0, min(1.0, s * scale))
            pcm.extend(struct.pack('<h', int(v * 32767)))
        with wave.open(wav_path, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(SR)
            wf.writeframes(bytes(pcm))
        subprocess.run(
            ['ffmpeg', '-y', '-v', 'error', '-i', wav_path, '-codec:a', 'libmp3lame', '-b:a', bitrate, str(out_mp3)],
            check=True,
        )
    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)


def gen_bgm_loop(duration_sec: float = 30.0):
    """Clean 30s seamlessly loopable ambient synth bed (D minor / F major pad + soft pulse)."""
    n = int(SR * duration_sec)
    samples = [0.0] * n
    # Chord progression every 7.5s (4 chords across 30s, exact integer cycles at loop boundary)
    chords = [
        [146.83, 220.00, 261.63, 329.63],  # Dm9
        [130.81, 196.00, 246.94, 293.66],  # Cmaj9
        [116.54, 174.61, 220.00, 261.63],  # Bbmaj7
        [110.00, 164.81, 220.00, 261.63],  # Am7
    ]
    chord_len = duration_sec / len(chords)

    for i in range(n):
        t = i / SR
        c_idx = min(len(chords) - 1, int(t / chord_len))
        local_t = t - c_idx * chord_len
        # Smooth crossfade between chords (0.8s)
        fade = min(1.0, local_t / 0.8) * min(1.0, (chord_len - local_t) / 0.8 + 0.15)
        fade = max(0.25, min(1.0, fade))

        pad = 0.0
        for f_idx, freq in enumerate(chords[c_idx]):
            # Integer-rounded frequency relative to 30s loop for zero-click wrap
            detune = 1.0 + (0.0018 if f_idx % 2 == 0 else -0.0018)
            pad += math.sin(2.0 * math.pi * freq * t) * 0.18
            pad += math.sin(2.0 * math.pi * (freq * detune) * t) * 0.08

        # Subtle 120 BPM (0.5s) low pulse
        beat_t = t % 0.5
        pulse_env = math.exp(-beat_t * 9.0)
        sub_freq = chords[c_idx][0] * 0.5
        pulse = math.sin(2.0 * math.pi * sub_freq * t) * pulse_env * 0.16

        samples[i] = (pad * fade + pulse) * 0.45

    # 0.4s loop-boundary crossfade to guarantee seamless wrap
    xf = int(0.4 * SR)
    for i in range(xf):
        alpha = i / xf
        samples[i] = samples[i] * alpha + samples[n - xf + i] * (1.0 - alpha)
    return samples


def gen_whoosh(duration_sec: float = 0.45):
    n = int(SR * duration_sec)
    rng = random.Random(42)
    lp = 0.0
    samples = []
    for i in range(n):
        t = i / SR
        u = t / duration_sec
        env = math.sin(math.pi * u) ** 1.6
        cutoff = 0.04 + 0.35 * math.sin(math.pi * u)
        white = rng.uniform(-1.0, 1.0)
        lp = lp + cutoff * (white - lp)
        tone = math.sin(2.0 * math.pi * (180 + 420 * u) * t) * 0.25
        samples.append((lp * 0.85 + tone) * env * 0.8)
    return samples


def gen_impact(duration_sec: float = 0.75):
    n = int(SR * duration_sec)
    rng = random.Random(7)
    samples = []
    for i in range(n):
        t = i / SR
        freq = 135.0 * math.exp(-t * 14.0) + 38.0
        sub = math.sin(2.0 * math.pi * freq * t) * math.exp(-t * 4.5)
        snap = rng.uniform(-1.0, 1.0) * math.exp(-t * 32.0) * 0.65
        samples.append((sub * 0.9 + snap) * 0.9)
    return samples


def gen_alarm(duration_sec: float = 0.85):
    n = int(SR * duration_sec)
    samples = []
    for i in range(n):
        t = i / SR
        # Two urgent sci-fi pulses
        pulse = 1.0 if (t % 0.42) < 0.24 else 0.15
        env = min(1.0, t / 0.02) * min(1.0, (duration_sec - t) / 0.08)
        f = 780.0 + 180.0 * math.sin(2.0 * math.pi * 6.0 * t)
        sig = (math.sin(2.0 * math.pi * f * t) + 0.3 * math.sin(4.0 * math.pi * f * t)) * 0.45
        samples.append(sig * pulse * env)
    return samples


def gen_chime(duration_sec: float = 0.65):
    n = int(SR * duration_sec)
    notes = [1046.50, 1318.51, 1567.98]  # C6, E6, G6
    samples = []
    for i in range(n):
        t = i / SR
        val = 0.0
        for idx, freq in enumerate(notes):
            nt = t - idx * 0.055
            if nt >= 0:
                val += math.sin(2.0 * math.pi * freq * nt) * math.exp(-nt * 7.5) * 0.35
        samples.append(val)
    return samples


def gen_chapter_sting(duration_sec: float = 1.25):
    n = int(SR * duration_sec)
    freqs = [146.83, 220.00, 293.66, 440.00, 587.33]
    samples = []
    for i in range(n):
        t = i / SR
        attack = min(1.0, t / 0.03)
        decay = math.exp(-t * 2.8)
        chord = sum(math.sin(2.0 * math.pi * f * t) for f in freqs) / len(freqs)
        shimmer = math.sin(2.0 * math.pi * 880.0 * t) * math.exp(-t * 5.0) * 0.25
        samples.append((chord * 0.8 + shimmer) * attack * decay * 0.85)
    return samples


def main():
    bgm_path = AUDIO_DIR / 'bgm_loop.mp3'
    if not bgm_path.exists():
        print(f'[audio] Generating {bgm_path}...')
        write_wav_and_mp3(gen_bgm_loop(30.0), bgm_path)
    else:
        print(f'[audio] Keeping existing {bgm_path}')

    sfx_specs = {
        'whoosh.mp3': gen_whoosh,
        'impact.mp3': gen_impact,
        'alarm.mp3': gen_alarm,
        'chime.mp3': gen_chime,
        'chapter_sting.mp3': gen_chapter_sting,
    }
    for name, fn in sfx_specs.items():
        p = SFX_DIR / name
        print(f'[audio] Generating {p}...')
        write_wav_and_mp3(fn(), p)
    print('[audio] Done.')


if __name__ == '__main__':
    main()
