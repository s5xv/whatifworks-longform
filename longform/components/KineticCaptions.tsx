import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

export interface WordTiming {
  w: string;
  s: number;
  e: number;
  line?: number;
}

export interface KineticCaptionsProps {
  words?: WordTiming[];
  fallbackLine?: string;
}

export const KineticCaptions: React.FC<KineticCaptionsProps> = ({ words = [], fallbackLine }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Group into 3-word bursts around current timestamp
  let activeWords: WordTiming[] = [];
  if (words.length > 0) {
    const idx = words.findIndex((w) => t >= w.s && t <= w.e + 0.15);
    const anchor = idx >= 0 ? idx : words.findIndex((w) => w.s > t) - 1;
    if (anchor >= 0) {
      const start = Math.floor(anchor / 3) * 3;
      activeWords = words.slice(start, start + 3);
    }
  }

  if (activeWords.length === 0 && !fallbackLine) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: '8%',
        right: '8%',
        bottom: '7%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
        pointerEvents: 'none',
        zIndex: 10,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {activeWords.length > 0 ? (
        activeWords.map((item, i) => {
          const isActive = t >= item.s && t <= item.e;
          return (
            <span
              key={`${item.s}-${i}`}
              style={{
                fontSize: 56,
                fontWeight: 900,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                color: isActive ? '#80C7FF' : '#FFFFFF',
                transform: isActive ? 'scale(1.12)' : 'scale(1.0)',
                textShadow:
                  '-3px -3px 0 #0b1020, 3px -3px 0 #0b1020, -3px 3px 0 #0b1020, 3px 3px 0 #0b1020, 0 6px 14px rgba(0,0,0,0.55)',
              }}
            >
              {item.w}
            </span>
          );
        })
      ) : (
        <span
          style={{
            fontSize: 44,
            fontWeight: 800,
            color: '#FFFFFF',
            textShadow:
              '-3px -3px 0 #0b1020, 3px -3px 0 #0b1020, -3px 3px 0 #0b1020, 3px 3px 0 #0b1020',
          }}
        >
          {fallbackLine}
        </span>
      )}
    </div>
  );
};
