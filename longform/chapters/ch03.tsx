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

export const Chapter03: React.FC<ChapterComponentProps> = ({
  title = 'Chapter 3: Building the Doomsday Weapon',
  skyColor = '#4a89dc',
  fogColor = '#cde5ff',
  audioPath,
  wordsPath,
  words: wordsProp = [],
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const durationSec = durationInFrames / fps;
  const loadedWords = useChapterWords(wordsPath);
  const words = wordsProp.length > 0 ? wordsProp : loadedWords;

  const powerSec = useMemo(() => cueAt(words, 'gigawatts', 12.0), [words]);
  const tripSec = useMemo(() => cueAt(words, 'switch', 23.0), [words]);
  const supplySec = useMemo(() => cueAt(words, 'regulators', 38.0), [words]);
  const outletSec = useMemo(() => cueAt(words, 'toaster', Math.max(46, durationSec - 10)), [words, durationSec]);

  const cameraSchedule = useMemo(
    () =>
      createCamera2DSchedule(durationSec, [
        cueCamera2DAt(words, 'weapon', 'wide', 5.5, { fallbackStartSec: 0 }),
        cueCamera2DAt(words, 'gigawatts', 'zoomIn', 5.5, {
          fallbackStartSec: powerSec,
          focusX: 460,
          focusY: 420,
          zoom: 1.2,
        }),
        cueCamera2DAt(words, 'switch', 'impactShake', 5.0, {
          fallbackStartSec: tripSec,
          intensity: 1.35,
        }),
        cueCamera2DAt(words, 'regulators', 'pan', 5.5, {
          fallbackStartSec: supplySec - 4,
          panX: -110,
        }),
        cueCamera2DAt(words, 'toaster', 'zoomIn', 6.5, {
          fallbackStartSec: outletSec - 4,
          focusX: 1120,
          focusY: 660,
          zoom: 1.24,
        }),
      ]),
    [durationSec, words, powerSec, tripSec, supplySec, outletSec]
  );

  const sfxCues = useMemo(
    () => [
      buildSfxCue(words, 'weapon', 'whoosh', { fallbackSec: 1.5, volume: 0.55 }),
      buildSfxCue(words, 'switch', 'impact', { fallbackSec: tripSec, volume: 0.8 }),
      buildSfxCue(words, 'overheat', 'alarm', { fallbackSec: tripSec + 3.5, volume: 0.7 }),
      buildSfxCue(words, 'toaster', 'chime', { fallbackSec: outletSec, volume: 0.52 }),
    ],
    [words, tripSec, outletSec]
  );

  const hudWidgets = useMemo<TelemetryWidgetSpec[]>(
    () => [
      {
        id: 'power-draw',
        kind: 'gauge',
        label: 'POWER DRAW',
        unit: 'GW',
        min: 0,
        max: 1.5,
        decimals: 2,
        triggerSec: 0.6,
        keyframes: [
          { timeSec: 0.6, value: 0.05, severity: 'normal' },
          { timeSec: powerSec, value: 1.2, severity: 'warn' },
          { timeSec: tripSec + 0.5, value: 0.0, severity: 'critical' },
        ],
      },
      {
        id: 'core-temp',
        kind: 'counter',
        label: 'CORE TEMP',
        unit: '°C',
        min: 20,
        max: 3000,
        decimals: 0,
        triggerSec: 1.5,
        keyframes: [
          { timeSec: 1.5, value: 420, severity: 'normal' },
          { timeSec: tripSec, value: 2800, severity: 'critical' },
        ],
      },
      {
        id: 'grid-badge',
        kind: 'badge',
        label: 'UTILITY GRID',
        badgeText: 'SHUT OFF',
        severity: 'critical',
        triggerSec: tripSec + 0.4,
      },
    ],
    [powerSec, tripSec]
  );

  const onDrawScene = useCallback(
    (ctx: CanvasRenderingContext2D, t: number) => {
      const gridTripped = t >= tripSec;
      const showToasterGag = t >= outletSec - 3.0;

      // 1. Animated Power Grid & Overheating Diagram (top-left)
      ctx.save();
      ctx.translate(455, 315);
      ctx.fillStyle = 'rgba(15, 26, 52, 0.88)';
      ctx.strokeStyle = gridTripped ? '#FF5252' : '#80C7FF';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(-345, -145, 690, 290, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LOCAL UTILITY GRID vs. DOOMSDAY LASER', 0, -108);

      // Substation Box -> Breaker -> Laser
      ctx.fillStyle = '#1e88e5';
      ctx.beginPath();
      ctx.roundRect(-305, -55, 165, 92, 12);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 15px system-ui, sans-serif';
      ctx.fillText('TOWN GRID', -222, -16);
      ctx.fillStyle = '#ffe082';
      ctx.fillText('MAX: 0.2 GW', -222, 10);

      // Animated current line
      ctx.strokeStyle = gridTripped ? '#FF5252' : '#69F0AE';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-140, -10);
      ctx.lineTo(135, -10);
      ctx.stroke();

      // Breaker switch indicator
      ctx.fillStyle = gridTripped ? '#d32f2f' : '#2e7d32';
      ctx.beginPath();
      ctx.roundRect(-62, -45, 124, 70, 10);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 15px system-ui, sans-serif';
      ctx.fillText(gridTripped ? 'BREAKER' : 'SWITCH', 0, -14);
      ctx.fillText(gridTripped ? 'TRIPPED!' : 'ONLINE', 0, 10);

      // Overheating Gauge Bar inside diagram
      ctx.fillStyle = '#14203d';
      ctx.beginPath();
      ctx.roundRect(150, -55, 160, 92, 12);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 14px system-ui, sans-serif';
      ctx.fillText('MIRROR TEMP', 230, -28);
      const heatPct = gridTripped ? 0.98 : Math.min(0.8, 0.2 + t * 0.03);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(168, -6, 124, 22);
      ctx.fillStyle = heatPct > 0.7 ? '#FF5252' : '#FFB74D';
      ctx.fillRect(168, -6, 124 * heatPct, 22);

      // Bottom status
      ctx.fillStyle = gridTripped ? '#FF8A80' : '#80C7FF';
      ctx.font = '900 16px system-ui, sans-serif';
      ctx.fillText(
        gridTripped
          ? 'UTILITY COMPANY REMOTELY CUT YOUR POWER!'
          : 'DRAWING 1.2 GW (1 NUCLEAR PLANT)',
        0,
        104
      );
      ctx.restore();

      // 2. Giant Stylized 2D Death Laser Cannon (left)
      ctx.save();
      ctx.translate(420, STAGE2D_FLOOR_Y);
      // Gantry legs
      ctx.strokeStyle = '#37474f';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(-110, 0);
      ctx.lineTo(-40, -210);
      ctx.moveTo(110, 0);
      ctx.lineTo(40, -210);
      ctx.stroke();

      // Cannon barrel tilted upward
      ctx.save();
      ctx.translate(0, -220);
      ctx.rotate(-0.32);
      ctx.fillStyle = '#546e7a';
      ctx.strokeStyle = '#222633';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-140, -55, 310, 110, 22);
      ctx.fill();
      ctx.stroke();
      // Emitter dish
      ctx.fillStyle = gridTripped ? '#455a64' : '#80C7FF';
      ctx.beginPath();
      ctx.ellipse(172, 0, 22, 54, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Warning stripes
      ctx.fillStyle = '#ffb300';
      ctx.fillRect(-60, -55, 24, 110);
      ctx.fillRect(-15, -55, 24, 110);
      ctx.restore();
      ctx.restore();

      // Thick power cable snaking from laser toward wall outlet
      ctx.strokeStyle = '#222633';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(510, STAGE2D_FLOOR_Y - 120);
      ctx.bezierCurveTo(700, STAGE2D_FLOOR_Y - 20, 880, STAGE2D_FLOOR_Y - 10, 1080, STAGE2D_FLOOR_Y - 140);
      ctx.stroke();

      // 3. Standard 120V Wall Outlet + Lukewarm Toaster Gag (right-center)
      ctx.save();
      ctx.translate(1310, STAGE2D_FLOOR_Y);
      // Wall pillar
      ctx.fillStyle = '#cfd8dc';
      ctx.strokeStyle = '#222633';
      ctx.lineWidth = 4;
      ctx.fillRect(-65, -340, 130, 340);
      ctx.strokeRect(-65, -340, 130, 340);
      // Tiny 120V outlet plate
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-26, -220, 52, 76);
      ctx.strokeRect(-26, -220, 52, 76);
      ctx.fillStyle = '#222633';
      ctx.fillRect(-10, -200, 6, 16);
      ctx.fillRect(4, -200, 6, 16);
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('120V OUTLET', 0, -234);

      // Electric sparks when tripped
      if (gridTripped && !showToasterGag) {
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 4;
        for (let i = 0; i < 4; i++) {
          const ang = t * 14 + i * 1.6;
          ctx.beginPath();
          ctx.moveTo(-26, -182);
          ctx.lineTo(-26 + Math.cos(ang) * 42, -182 + Math.sin(ang) * 42);
          ctx.stroke();
        }
      }

      // Lukewarm Toaster on side table
      if (showToasterGag) {
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(95, -90, 110, 90);
        ctx.strokeRect(95, -90, 110, 90);
        ctx.fillStyle = '#eceff1';
        ctx.beginPath();
        ctx.roundRect(114, -142, 72, 52, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#222633';
        ctx.font = '800 13px system-ui, sans-serif';
        ctx.fillText('TOASTER', 150, -112);
      }
      ctx.restore();

      // 4. Watt Protagonist holding giant laser plug
      let pose: Watt2DPose = 'explain';
      if (showToasterGag) pose = 'deadpan';
      else if (gridTripped) pose = 'shocked';

      drawWatt2D(ctx, {
        x: 1030,
        y: STAGE2D_FLOOR_Y,
        s: 360,
        t,
        pose,
        outfit: 'villain',
      });

      // Comically oversized 3-prong industrial plug next to Watt's right hand
      ctx.save();
      ctx.translate(1135, STAGE2D_FLOOR_Y - 148 + Math.sin(t * 4) * 6);
      ctx.fillStyle = '#ff7043';
      ctx.strokeStyle = '#222633';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(-28, -28, 56, 56, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#cfd8dc';
      ctx.fillRect(28, -16, 26, 10);
      ctx.strokeRect(28, -16, 26, 10);
      ctx.fillRect(28, 6, 26, 10);
      ctx.strokeRect(28, 6, 26, 10);
      ctx.restore();
    },
    [tripSec, outletSec]
  );

  return (
    <Stage2D
      skyTop={skyColor}
      skyBottom={fogColor}
      horizonColor="#5c7ca8"
      floorColor="#e2ebf5"
      cameraSchedule={cameraSchedule}
      onDrawScene={onDrawScene}
    >
      <AudioTrack audioPath={audioPath} words={words} sfxCues={sfxCues} />
      <ChapterCard chapterNumber={3} title={title} accentColor="#FF5252" />
      <TelemetryHUD words={words} side="right" widgets={hudWidgets} />
      <KineticCaptions words={words} fallbackLine="Your death ray trips a neighborhood breaker." />
    </Stage2D>
  );
};
