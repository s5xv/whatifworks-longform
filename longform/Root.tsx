import React from 'react';
import { Composition, Folder } from 'remotion';
import manifest from './manifest.json';
import { LongFormMain } from './LongFormMain';
import { CHAPTER_REGISTRY } from './chapters';

export const RemotionRoot: React.FC = () => {
  const fps = manifest.fps || 30;
  const width = manifest.width || 1920;
  const height = manifest.height || 1080;
  const totalFrames = manifest.chapters.reduce(
    (sum, ch) => sum + Math.round(ch.durationSec * fps),
    0
  );

  return (
    <>
      <Composition
        id="LongFormMain"
        component={LongFormMain}
        durationInFrames={totalFrames}
        fps={fps}
        width={width}
        height={height}
      />
      <Folder name="Chapters">
        {manifest.chapters.map((ch) => {
          const Comp = CHAPTER_REGISTRY[ch.id];
          if (!Comp) return null;
          return (
            <Composition
              key={ch.id}
              id={ch.id}
              component={Comp}
              durationInFrames={Math.round(ch.durationSec * fps)}
              fps={fps}
              width={width}
              height={height}
              defaultProps={{
                title: ch.title,
                skyColor: ch.skyColor,
                fogColor: ch.fogColor,
                audioPath: ch.audio,
                wordsPath: ch.words,
              }}
            />
          );
        })}
      </Folder>
    </>
  );
};
