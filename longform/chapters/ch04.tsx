import React, { useCallback, useMemo } from 'react';
import { useVideoConfig } from 'remotion';
import { Stage2D, STAGE2D_FLOOR_Y } from '../components/Stage2D';
import { drawWatt2D, Watt2DPose } from '../components/Watt2D';
import {
  createCamera2DSchedule,
  cueCamera2DAt,
  Camera2DState,
} from '../components/camera2D';
import { KineticCaptions } from '../components/KineticCaptions';
import { ChapterCard } from '../components/ChapterCard';
import { TelemetryHUD, TelemetryWidgetSpec } from '../components/TelemetryHUD';
import { AudioTrack, buildSfxCue } from '../components/AudioTrack';
import { useChapterWords } from '../components/useChapterWords';
import { cueAt } from '../three/timing';
import { ChapterComponentProps } from './index';

export const Chapter04: React.FC<ChapterComponentProps> = ({
  title = 'Chapter 4: Holding the World Hostage',
  skyColor = '#5798e6',
  fogColor = '#c8e2ff',
  audioPath,
  wordsPath,
  words: wordsProp = [],
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const durationSec = durationInFrames / fps;
  const loadedWords = useChapterWords(wordsPath);
  const words = wordsProp.length > 0 ? wordsProp : loadedWords;

  const weightSec = useMemo(() => cueAt(words, 'eleven', 13.0), [words]);
  const cryptoSec = useMemo(() => cueAt(words, 'cryptocurrency', 27.0), [words]);
  const jetSec = useMemo(() => cueAt(words, 'forty-two', 38.0), [words]);
  const trafficSec = useMemo(() => cueAt(words, 'traffic', Math.max(46, durationSec - 9)), [words, durationSec]);

  const cameraSchedule = useMemo(
    () =>
      createCamera2DSchedule(durationSec, [
        cueCamera2DAt(words, 'United', 'wide', 5.5, { fallbackStartSec: 0 }),
        cueCamera2DAt(words, 'eleven', 'zoomIn', 5.5, {
          fallbackStartSec: weightSec,
          focusX: 460,
          focusY: 620,
          zoom: 1.2,
        }),
        cueCamera2DAt(words, 'cryptocurrency', 'pan', 5.5, {
          fallbackStartSec: cryptoSec,
          panX: 120,
        }),
        cueCamera2DAt(words, 'forty-two', 'impactShake', 5.0, {
          fallbackStartSec: jetSec,
          intensity: 1.3,
        }),
        cueCamera2DAt(words, 'traffic', 'zoomIn', 6.5, {
          fallbackStartSec: trafficSec - 3,
          focusX: 1120,
          focusY: 660,
          zoom: 1.22,
        }),
      ]),
    [durationSec, words, weightSec, cryptoSec, jetSec, trafficSec]
  );

  const sfxCues = useMemo(
    () => [
      buildSfxCue(words, 'trillion', 'chime', { fallbackSec: 5.5, volume: 0.55 }),
      buildSfxCue(words, 'eleven', 'impact', { fallbackSec: weightSec, volume: 0.72 }),
      buildSfxCue(words, 'forty-two', 'alarm', { fallbackSec: jetSec, volume: 0.75 }),
      buildSfxCue(words, 'fighter', 'whoosh', { fallbackSec: jetSec + 2.5, volume: 0.65 }),
    ],
    [words, weightSec, jetSec]
  );

  const hudWidgets = useMemo<TelemetryWidgetSpec[]>(
    () => [
      {
        id: 'cash-weight',
        kind: 'counter',
        label: 'CASH WEIGHT',
        unit: 'TONS',
        min: 0,
        max: 12000,
        decimals: 0,
        triggerSec: 0.6,
        keyframes: [
          { timeSec: 0.6, value: 100, severity: 'normal' },
          { timeSec: weightSec, value: 11000, severity: 'critical' },
        ],
      },
      {
        id: 'monologue-time',
        kind: 'counter',
        label: 'MONOLOGUE TIME',
        displayMode: 'mmss',
        min: 0,
        max: 60,
        decimals: 0,
        triggerSec: 1.5,
        keyframes: [
          { timeSec: 1.5, value: 0, severity: 'normal' },
          { timeSec: jetSec, value: 42, severity: 'critical' },
        ],
      },
      {
        id: 'van-badge',
        kind: 'badge',
        label: 'GETAWAY VAN',
        badgeText: 'CRUSHED (11,000T)',
        severity: 'critical',
        triggerSec: weightSec + 1.5,
      },
    ],
    [weightSec, jetSec]
  );

  const onDrawScene = useCallback(
    (ctx: CanvasRenderingContext2D, t: number) => {
      const showMountain = t >= weightSec - 2.0;
      const showCrypto = t >= cryptoSec && t < jetSec;
      const jetsArrived = t >= jetSec;
      const isDeadpanEnd = t >= trafficSec - 1.5;

      // 1. Scale Diagram: Mountain of $1T Cash (11,000 Tons) vs Tiny Getaway Van
      ctx.save();
      ctx.translate(455, STAGE2D_FLOOR_Y);

      // Colossal mountain of stacked green cash pallets
      const grow = showMountain ? Math.min(1, 0.35 + (t - weightSec + 2) * 0.25) : 0.35;
      const tiers = Math.round(7 * grow);
      for (let row = 0; row < tiers; row++) {
        const cols = 7 - row;
        const y = -38 - row * 44;
        for (let c = 0; c < cols; c++) {
          const x = (c - (cols - 1) / 2) * 78;
          ctx.fillStyle = '#43a047';
          ctx.strokeStyle = '#1b5e20';
          ctx.lineWidth = 3;
          ctx.fillRect(x - 35, y, 70, 36);
          ctx.strokeRect(x - 35, y, 70, 36);
          // Cash band
          ctx.fillStyle = '#fff59d';
          ctx.fillRect(x - 8, y, 16, 36);
        }
      }

      // Label placard on cash mountain
      ctx.fillStyle = 'rgba(15, 26, 52, 0.88)';
      ctx.strokeStyle = '#69F0AE';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-185, -tiers * 44 - 72, 370, 56, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#69F0AE';
      ctx.font = '900 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$1 TRILLION = 11,000 TONS', 0, -tiers * 44 - 38);
      ctx.restore();

      // 2. Tiny Getaway Minivan (squashed next to mountain!)
      ctx.save();
      ctx.translate(905, STAGE2D_FLOOR_Y);
      ctx.fillStyle = '#ef5350';
      ctx.strokeStyle = '#222633';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-85, -78, 170, 60, [16, 28, 6, 6]);
      ctx.fill();
      ctx.stroke();
      // Window
      ctx.fillStyle = '#b3e5fc';
      ctx.fillRect(10, -68, 52, 28);
      ctx.strokeRect(10, -68, 52, 28);
      // Squashed flat tires
      ctx.fillStyle = '#222633';
      ctx.beginPath();
      ctx.ellipse(-45, -8, 18, 9, 0, 0, Math.PI * 2);
      ctx.ellipse(45, -8, 18, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222633';
      ctx.font = '900 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VAN MAX: 1 TON', 0, -92);
      ctx.restore();

      // 3. Crypto Freeze Overlay / UN Live Broadcast Card (top-center)
      ctx.save();
      ctx.translate(930, 225);
      ctx.fillStyle = 'rgba(15, 26, 52, 0.88)';
      ctx.strokeStyle = showCrypto || jetsArrived ? '#FF5252' : '#80C7FF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-210, -82, 420, 164, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FF5252';
      ctx.beginPath();
      ctx.roundRect(-185, -62, 74, 26, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LIVE UN', -148, -44);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 17px system-ui, sans-serif';
      ctx.fillText(
        showCrypto
          ? 'CRYPTO LEDGER: TRACED & FROZEN'
          : jetsArrived
          ? 'SIGNAL TRIANGULATED AT 0:42!'
          : 'BROADCASTING EVIL DEMAND...',
        32,
        -44
      );
      ctx.fillStyle = showCrypto || jetsArrived ? '#FF8A80' : '#ffd54f';
      ctx.font = '900 22px system-ui, sans-serif';
      ctx.fillText(
        showCrypto
          ? 'EXCHANGE WALLET LOCKED'
          : jetsArrived
          ? '500 SEMI TRUCKS + JETS INBOUND'
          : 'DEMAND: $1,000,000,000,000',
        0,
        24
      );
      ctx.restore();

      // 4. Supersonic Fighter Jets streaking overhead when monologue hits 0:42
      if (jetsArrived) {
        for (let j = 0; j < 2; j++) {
          const jx = 1850 - (((t - jetSec) * 620 + j * 340) % 2100);
          const jy = 135 + j * 65;
          ctx.save();
          ctx.translate(jx, jy);
          ctx.fillStyle = '#607d8b';
          ctx.strokeStyle = '#102027';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-65, 0);
          ctx.lineTo(25, -14);
          ctx.lineTo(55, -28);
          ctx.lineTo(40, 0);
          ctx.lineTo(55, 22);
          ctx.lineTo(20, 12);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Afterburner flame
          ctx.fillStyle = '#ff9800';
          ctx.beginPath();
          ctx.moveTo(45, -6);
          ctx.lineTo(85 + Math.sin(t * 40) * 12, 0);
          ctx.lineTo(45, 6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // 5. Watt Protagonist holding tiny empty briefcase
      let pose: Watt2DPose = 'explain';
      if (isDeadpanEnd) pose = 'deadpan';
      else if (jetsArrived) pose = 'shocked';

      drawWatt2D(ctx, {
        x: 1185,
        y: STAGE2D_FLOOR_Y,
        s: 360,
        t,
        pose,
        outfit: 'villain',
        flip: -1,
      });

      // Tiny black briefcase next to Watt
      ctx.save();
      ctx.translate(1085, STAGE2D_FLOOR_Y - 120);
      ctx.fillStyle = '#1c2230';
      ctx.strokeStyle = '#222633';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-24, -18, 48, 36, 6);
      ctx.fill();
      ctx.stroke();
      ctx.strokeRect(-10, -26, 20, 8);
      ctx.restore();
    },
    [weightSec, cryptoSec, jetSec, trafficSec]
  );

  return (
    <Stage2D
      skyTop={skyColor}
      skyBottom={fogColor}
      horizonColor="#6388b8"
      floorColor="#e5ecf4"
      cameraSchedule={cameraSchedule}
      onDrawScene={onDrawScene}
    >
      <AudioTrack audioPath={audioPath} words={words} sfxCues={sfxCues} />
      <ChapterCard chapterNumber={4} title={title} accentColor="#69F0AE" />
      <TelemetryHUD words={words} side="right" widgets={hudWidgets} />
      <KineticCaptions words={words} fallbackLine="One trillion dollars weighs eleven thousand tons." />
    </Stage2D>
  );
};
