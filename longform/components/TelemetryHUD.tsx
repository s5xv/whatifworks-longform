import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { WordTiming } from './KineticCaptions';
import { cueAt } from '../three/timing';

export type HudSeverity = 'normal' | 'warn' | 'critical';

export interface TelemetryKeyframe {
  word?: string;
  timeSec?: number;
  value: number;
  labelOverride?: string;
  severity?: HudSeverity;
}

export interface TelemetryWidgetSpec {
  id: string;
  kind: 'gauge' | 'counter' | 'badge';
  label: string;
  prefix?: string;
  unit?: string;
  displayMode?: 'number' | 'mmss';
  min?: number;
  max?: number;
  decimals?: number;
  triggerWord?: string;
  triggerSec?: number;
  badgeText?: string;
  severity?: HudSeverity;
  keyframes?: TelemetryKeyframe[];
}

export interface TelemetryHUDProps {
  words?: WordTiming[];
  side?: 'left' | 'right';
  widgets: TelemetryWidgetSpec[];
}

const SEVERITY_COLOR: Record<HudSeverity, string> = {
  normal: '#80C7FF',
  warn: '#FFB74D',
  critical: '#FF5252',
};

function resolveTime(words: WordTiming[], word?: string, fallbackSec: number = 0): number {
  if (word && words.length > 0) {
    return cueAt(words, word, fallbackSec);
  }
  return fallbackSec;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  words = [],
  side = 'right',
  widgets,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  if (!widgets || widgets.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 108,
        [side]: 34,
        width: 290,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        zIndex: 20,
        pointerEvents: 'none',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {widgets.map((w) => {
        const appearAt = resolveTime(words, w.triggerWord, w.triggerSec ?? 0);
        if (t < appearAt) return null;

        const appearProg = interpolate(t, [appearAt, appearAt + 0.28], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        let currentVal = w.min ?? 0;
        let activeSeverity: HudSeverity = w.severity ?? 'normal';
        let activeText = w.badgeText ?? '';

        if (w.keyframes && w.keyframes.length > 0) {
          const resolved = w.keyframes
            .map((kf, idx) => ({
              ...kf,
              tSec: resolveTime(words, kf.word, kf.timeSec ?? appearAt + idx * 4),
            }))
            .sort((a, b) => a.tSec - b.tSec);

          currentVal = resolved[0].value;
          activeSeverity = resolved[0].severity ?? activeSeverity;
          if (resolved[0].labelOverride) activeText = resolved[0].labelOverride;

          for (let i = 0; i < resolved.length - 1; i++) {
            const a = resolved[i];
            const b = resolved[i + 1];
            if (t >= a.tSec && t <= b.tSec) {
              const span = Math.max(0.1, b.tSec - a.tSec);
              const u = Math.max(0, Math.min(1, (t - a.tSec) / span));
              currentVal = a.value + (b.value - a.value) * u;
              activeSeverity = u > 0.65 && b.severity ? b.severity : a.severity ?? activeSeverity;
              if (u > 0.65 && b.labelOverride) activeText = b.labelOverride;
              else if (a.labelOverride) activeText = a.labelOverride;
              break;
            } else if (t > b.tSec) {
              currentVal = b.value;
              activeSeverity = b.severity ?? activeSeverity;
              if (b.labelOverride) activeText = b.labelOverride;
            }
          }
        }

        const accent = SEVERITY_COLOR[activeSeverity];
        const min = w.min ?? 0;
        const max = w.max ?? 100;
        const pct = Math.max(0, Math.min(100, ((currentVal - min) / Math.max(1e-5, max - min)) * 100));
        const decimals = w.decimals ?? 1;
        let formatted: string;
        if (w.displayMode === 'mmss') {
          const totalSecs = Math.max(0, Math.round(currentVal));
          const mins = Math.floor(totalSecs / 60);
          const secs = totalSecs % 60;
          formatted = `${mins}:${String(secs).padStart(2, '0')}`;
        } else if (decimals === 0 && Math.abs(currentVal) >= 1000) {
          formatted = Math.round(currentVal).toLocaleString('en-US');
        } else {
          formatted = currentVal.toFixed(decimals);
        }

        return (
          <div
            key={w.id}
            style={{
              opacity: appearProg,
              transform: `translateX(${(1 - appearProg) * (side === 'right' ? 28 : -28)}px)`,
              backgroundColor: 'rgba(11, 18, 36, 0.78)',
              border: `1.5px solid ${accent}`,
              borderRadius: 10,
              padding: '10px 14px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.38)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: w.kind === 'gauge' ? 8 : 0,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  color: '#B8C9E8',
                  textTransform: 'uppercase',
                }}
              >
                {w.label}
              </span>
              {w.kind === 'badge' ? (
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: accent,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {activeText || `${formatted}${w.unit ? ` ${w.unit}` : ''}`}
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: accent,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {w.prefix ?? ''}
                  {formatted}
                  {w.unit ? (
                    <span style={{ fontSize: 13, marginLeft: 4, color: '#D4E4FF' }}>{w.unit}</span>
                  ) : null}
                </span>
              )}
            </div>

            {w.kind === 'gauge' ? (
              <div
                style={{
                  width: '100%',
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'rgba(255, 255, 255, 0.14)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${pct.toFixed(1)}%`,
                    height: '100%',
                    backgroundColor: accent,
                    boxShadow: `0 0 8px ${accent}`,
                  }}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
