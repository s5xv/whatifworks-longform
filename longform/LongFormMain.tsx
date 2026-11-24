import React from 'react';
import { Series } from 'remotion';
import manifest from './manifest.json';
import { CHAPTER_REGISTRY } from './chapters';

export const LongFormMain: React.FC = () => {
  const fps = manifest.fps || 30;
  return (
    <Series>
      {manifest.chapters.map((ch) => {
        const Comp = CHAPTER_REGISTRY[ch.id];
        if (!Comp) {
          throw new Error(`Chapter component missing in CHAPTER_REGISTRY for id="${ch.id}"`);
        }
        const frames = Math.round(ch.durationSec * fps);
        return (
          <Series.Sequence key={ch.id} durationInFrames={frames}>
            <Comp
              title={ch.title}
              skyColor={ch.skyColor}
              fogColor={ch.fogColor}
              audioPath={ch.audio}
              wordsPath={ch.words}
            />
          </Series.Sequence>
        );
      })}
    </Series>
  );
};
