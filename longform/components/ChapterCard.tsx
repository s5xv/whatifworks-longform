import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface ChapterCardProps {
  chapterNumber?: number | string;
  title: string;
  subtitle?: string;
  accentColor?: string;
  cardDurationSec?: number;
}

function formatChapterHeading(title: string, chapterNumber?: number | string): {
  kicker: string;
  headline: string;
} {
  const colonIdx = title.indexOf(':');
  if (colonIdx > 0) {
    const prefix = title.slice(0, colonIdx).trim().toUpperCase();
    const rest = title.slice(colonIdx + 1).trim().toUpperCase();
    return {
      kicker: prefix.startsWith('CHAPTER') ? prefix : `CHAPTER ${String(chapterNumber ?? '01').padStart(2, '0')}`,
      headline: rest,
    };
  }
  const numStr = chapterNumber !== undefined ? String(chapterNumber).padStart(2, '0') : '01';
  return {
    kicker: `CHAPTER ${numStr}`,
    headline: title.toUpperCase(),
  };
}

export const ChapterCard: React.FC<ChapterCardProps> = ({
  chapterNumber,
  title,
  subtitle,
  accentColor = '#80C7FF',
  cardDurationSec = 1.5,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;

  const progressPct = Math.min(100, Math.max(0, (frame / Math.max(1, durationInFrames - 1)) * 100));

  const enter = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 220, mass: 0.7 },
  });

  const exitStart = Math.max(0.4, cardDurationSec - 0.25);
  const exitOpacity = interpolate(t, [exitStart, cardDurationSec], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const translateX = interpolate(enter, [0, 1], [-48, 0]) + interpolate(t, [exitStart, cardDurationSec], [0, -24], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const { kicker, headline } = formatChapterHeading(title, chapterNumber);

  return (
    <>
      {/* Persistent minimal top-edge progress bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          backgroundColor: 'rgba(11, 18, 36, 0.45)',
          zIndex: 30,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPct.toFixed(2)}%`,
            backgroundColor: accentColor,
            boxShadow: `0 0 12px ${accentColor}`,
          }}
        />
      </div>

      {/* Snappy 1.5s stylized chapter title overlay */}
      {t <= cardDurationSec ? (
        <div
          style={{
            position: 'absolute',
            top: 28,
            left: 36,
            zIndex: 28,
            pointerEvents: 'none',
            opacity: Math.min(enter, exitOpacity),
            transform: `translateX(${translateX}px)`,
            display: 'flex',
            alignItems: 'stretch',
            backgroundColor: 'rgba(11, 18, 36, 0.86)',
            border: `2px solid ${accentColor}`,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          <div style={{ width: 8, backgroundColor: accentColor }} />
          <div style={{ padding: '12px 22px' }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: '0.16em',
                color: accentColor,
                marginBottom: 4,
              }}
            >
              {kicker} —
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 900,
                letterSpacing: '0.03em',
                color: '#FFFFFF',
                lineHeight: 1.1,
              }}
            >
              {headline}
            </div>
            {subtitle ? (
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#CBD9F0',
                  marginTop: 4,
                }}
              >
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
};
