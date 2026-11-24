import React from 'react';
import { Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import type { WordTiming } from './KineticCaptions';
import { cueAt } from '../three/timing';

export type SfxType = 'whoosh' | 'impact' | 'alarm' | 'chime' | 'chapter_sting';

export interface SfxCue {
  timeSec: number;
  type: SfxType;
  volume?: number;
}

export interface AudioTrackProps {
  audioPath?: string | null;
  words?: WordTiming[];
  bgmPath?: string | null;
  bgmDuckVolume?: number;
  bgmSwellVolume?: number;
  sfxCues?: SfxCue[];
  playChapterSting?: boolean;
  chapterStingVolume?: number;
}

const SFX_FILE_MAP: Record<SfxType, string> = {
  whoosh: 'audio/sfx/whoosh.mp3',
  impact: 'audio/sfx/impact.mp3',
  alarm: 'audio/sfx/alarm.mp3',
  chime: 'audio/sfx/chime.mp3',
  chapter_sting: 'audio/sfx/chapter_sting.mp3',
};

const SFX_DEFAULT_DURATION_SEC: Record<SfxType, number> = {
  whoosh: 0.6,
  impact: 0.9,
  alarm: 1.0,
  chime: 0.8,
  chapter_sting: 1.4,
};

/**
 * Helper to create a word-synced SFX cue using `cueAt()`.
 */
export function buildSfxCue(
  words: WordTiming[] | undefined,
  query: string,
  type: SfxType,
  options?: { fallbackSec?: number; offsetSec?: number; volume?: number }
): SfxCue {
  const baseSec = cueAt(words, query, options?.fallbackSec ?? 0);
  return {
    timeSec: Math.max(0, baseSec + (options?.offsetSec ?? 0)),
    type,
    volume: options?.volume,
  };
}

function isSpeakingAt(words: WordTiming[], t: number): boolean {
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (t >= w.s - 0.14 && t <= w.e + 0.22) {
      return true;
    }
  }
  return false;
}

export const AudioTrack: React.FC<AudioTrackProps> = ({
  audioPath,
  words = [],
  bgmPath = 'audio/bgm_loop.mp3',
  bgmDuckVolume = 0.15,
  bgmSwellVolume = 0.30,
  sfxCues = [],
  playChapterSting = true,
  chapterStingVolume = 0.42,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const totalSec = durationInFrames / fps;
  const clampedDuck = Math.max(0.12, Math.min(0.18, bgmDuckVolume));

  const bgmVolume = (f: number): number => {
    const t = f / fps;
    const inTransition = t < 1.5 || t > Math.max(1.5, totalSec - 1.5);
    if (inTransition) {
      return bgmSwellVolume;
    }
    if (words.length > 0) {
      return isSpeakingAt(words, t) ? clampedDuck : Math.min(bgmSwellVolume, clampedDuck + 0.11);
    }
    // If narration exists without word timings, stay ducked under narration
    return audioPath ? clampedDuck : bgmSwellVolume;
  };

  const validSfx = sfxCues.filter((c) => Number.isFinite(c.timeSec) && c.timeSec >= 0 && c.timeSec < totalSec);

  return (
    <>
      {audioPath ? <Audio src={staticFile(audioPath)} volume={1.0} /> : null}

      {bgmPath ? (
        <Audio
          src={staticFile(bgmPath)}
          loop
          loopVolumeCurveBehavior="extend"
          volume={bgmVolume}
        />
      ) : null}

      {playChapterSting ? (
        <Sequence from={0} durationInFrames={Math.min(durationInFrames, Math.ceil(1.4 * fps))}>
          <Audio src={staticFile(SFX_FILE_MAP.chapter_sting)} volume={chapterStingVolume} />
        </Sequence>
      ) : null}

      {validSfx.map((cue, idx) => {
        const fromFrame = Math.max(0, Math.round(cue.timeSec * fps));
        const durFrames = Math.max(
          1,
          Math.min(durationInFrames - fromFrame, Math.ceil(SFX_DEFAULT_DURATION_SEC[cue.type] * fps))
        );
        if (durFrames <= 0) return null;
        return (
          <Sequence key={`${cue.type}-${fromFrame}-${idx}`} from={fromFrame} durationInFrames={durFrames}>
            <Audio src={staticFile(SFX_FILE_MAP[cue.type])} volume={cue.volume ?? 0.65} />
          </Sequence>
        );
      })}
    </>
  );
};
