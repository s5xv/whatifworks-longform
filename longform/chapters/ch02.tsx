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

export const Chapter02: React.FC<ChapterComponentProps> = ({
  title = 'Chapter 2: Hiring Henchmen (The HR Nightmare)',
  skyColor = '#5591db',
  fogColor = '#c4e0ff',
  audioPath,
  wordsPath,
  words: wordsProp = [],
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const durationSec = durationInFrames / fps;
  const loadedWords = useChapterWords(wordsPath);
  const words = wordsProp.length > 0 ? wordsProp : loadedWords;

  const payrollSec = useMemo(() => cueAt(words, 'payroll', 14.0), [words]);
  const loyaltySec = useMemo(() => cueAt(words, 'loyalty', 25.0), [words]);
  const leakSec = useMemo(() => cueAt(words, 'forty-seven', 40.0), [words]);
  const coffeeSec = useMemo(() => cueAt(words, 'coffee', Math.max(48, durationSec - 9)), [words, durationSec]);

  const cameraSchedule = useMemo(
    () =>
      createCamera2DSchedule(durationSec, [
        cueCamera2DAt(words, 'human', 'wide', 5.5, { fallbackStartSec: 0 }),
        cueCamera2DAt(words, 'payroll', 'zoomIn', 5.5, {
          fallbackStartSec: payrollSec,
          focusX: 540,
          focusY: 460,
          zoom: 1.2,
        }),
        cueCamera2DAt(words, 'loyalty', 'pan', 6.0, {
          fallbackStartSec: loyaltySec,
          panX: 110,
        }),
        cueCamera2DAt(words, 'forty-seven', 'impactShake', 5.0, {
          fallbackStartSec: leakSec,
          intensity: 1.2,
        }),
        cueCamera2DAt(words, 'coffee', 'zoomIn', 6.5, {
          fallbackStartSec: coffeeSec - 3,
          focusX: 1180,
          focusY: 660,
          zoom: 1.22,
        }),
      ]),
    [durationSec, words, payrollSec, loyaltySec, leakSec, coffeeSec]
  );

  const sfxCues = useMemo(
    () => [
      buildSfxCue(words, 'army', 'whoosh', { fallbackSec: 2.0, volume: 0.55 }),
      buildSfxCue(words, 'nine', 'chime', { fallbackSec: payrollSec + 2, volume: 0.52 }),
      buildSfxCue(words, 'forty-seven', 'alarm', { fallbackSec: leakSec, volume: 0.72 }),
      buildSfxCue(words, 'coffee', 'chime', { fallbackSec: coffeeSec, volume: 0.5 }),
    ],
    [words, payrollSec, leakSec, coffeeSec]
  );

  const hudWidgets = useMemo<TelemetryWidgetSpec[]>(
    () => [
      {
        id: 'hench-loyalty',
        kind: 'gauge',
        label: 'LOYALTY',
        unit: '%',
        min: 0,
        max: 100,
        decimals: 0,
        triggerSec: 0.6,
        keyframes: [
          { timeSec: 0.6, value: 85, severity: 'normal' },
          { timeSec: loyaltySec, value: 32, severity: 'warn' },
          { timeSec: leakSec, value: 12, severity: 'critical' },
        ],
      },
      {
        id: 'tiktok-leaks',
        kind: 'counter',
        label: 'LEAKS',
        unit: 'POSTS',
        min: 0,
        max: 60,
        decimals: 0,
        triggerSec: 2.0,
        keyframes: [
          { timeSec: 2.0, value: 0, severity: 'normal' },
          { timeSec: leakSec - 1, value: 6, severity: 'warn' },
          { timeSec: leakSec + 1.5, value: 47, severity: 'critical' },
        ],
      },
      {
        id: 'payroll-cost',
        kind: 'counter',
        label: 'PAYROLL / YR',
        prefix: '$',
        unit: 'M',
        min: 0,
        max: 10,
        decimals: 1,
        triggerSec: payrollSec - 1,
        keyframes: [
          { timeSec: payrollSec - 1, value: 1.5, severity: 'normal' },
          { timeSec: payrollSec + 3, value: 9.0, severity: 'warn' },
        ],
      },
    ],
    [payrollSec, loyaltySec, leakSec]
  );

  const onDrawScene = useCallback(
    (ctx: CanvasRenderingContext2D, t: number) => {
      const showLeaks = t >= leakSec - 1.5;
      const showCoffeeGag = t >= coffeeSec - 2.0;

      // 1. Animated 2D Evil Org Chart Board (top-left)
      ctx.save();
      ctx.translate(450, 345);
      ctx.fillStyle = 'rgba(15, 26, 52, 0.88)';
      ctx.strokeStyle = '#80C7FF';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(-340, -175, 680, 350, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#80C7FF';
      ctx.font = '900 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VILLAIN SYNDICATE ORG CHART (HR VIEW)', 0, -138);

      // Connector lines
      ctx.strokeStyle = '#9be7ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -68);
      ctx.lineTo(0, -25);
      ctx.moveTo(-190, -25);
      ctx.lineTo(190, -25);
      ctx.moveTo(-190, -25);
      ctx.lineTo(-190, 20);
      ctx.moveTo(0, -25);
      ctx.lineTo(0, 20);
      ctx.moveTo(190, -25);
      ctx.lineTo(190, 20);
      ctx.stroke();

      // Top node: You
      ctx.fillStyle = '#c62828';
      ctx.beginPath();
      ctx.roundRect(-125, -112, 250, 44, 10);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 17px system-ui, sans-serif';
      ctx.fillText('SUPREME VILLAIN (YOU)', 0, -84);

      // 3 Mid nodes: Guards / Techs / HR
      const boxes = [
        { x: -190, title: '60 GUARDS', sub: '$17/HR + DENTAL', col: '#1e88e5' },
        { x: 0, title: '25 TECHS', sub: 'OVERTIME $$$', col: '#1e88e5' },
        { x: 190, title: '15 HR / ADMIN', sub: '401(K) MATCH', col: '#1e88e5' },
      ];
      boxes.forEach((b) => {
        ctx.fillStyle = b.col;
        ctx.beginPath();
        ctx.roundRect(b.x - 86, 20, 172, 68, 10);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 16px system-ui, sans-serif';
        ctx.fillText(b.title, b.x, 48);
        ctx.fillStyle = '#ffe082';
        ctx.font = '700 13px system-ui, sans-serif';
        ctx.fillText(b.sub, b.x, 72);
      });

      // Bottom status bar
      ctx.fillStyle = showLeaks ? '#FF5252' : '#FFB74D';
      ctx.font = '900 18px system-ui, sans-serif';
      ctx.fillText(
        showLeaks ? 'STATUS: 47 TIKTOK BASE TOURS LIVE!' : 'ANNUAL PAYROLL BURN: $9,000,000',
        0,
        136
      );
      ctx.restore();

      // 2. Towering Resume Stack on Floor (center-left)
      const stackCount = Math.min(9, Math.max(2, Math.floor(t * 0.7) + 2));
      ctx.save();
      ctx.translate(270, STAGE2D_FLOOR_Y);
      for (let i = 0; i < stackCount; i++) {
        const rx = Math.sin(i * 1.7) * 5;
        const ry = -16 - i * 16;
        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f1f5f9';
        ctx.strokeStyle = '#222633';
        ctx.lineWidth = 2.5;
        ctx.fillRect(-75 + rx, ry, 150, 15);
        ctx.strokeRect(-75 + rx, ry, 150, 15);
      }
      ctx.fillStyle = '#d32f2f';
      ctx.font = '900 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RESUMES (UNVETTED)', 0, -stackCount * 16 - 24);
      ctx.restore();

      // 3. TikTok Livestream Leak Phone Popup
      if (showLeaks) {
        const bounce = Math.sin(t * 8) * 6;
        ctx.save();
        ctx.translate(780, 590 + bounce);
        ctx.fillStyle = '#111625';
        ctx.strokeStyle = '#FF5252';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.roundRect(-95, -165, 190, 330, 24);
        ctx.fill();
        ctx.stroke();

        // Screen
        ctx.fillStyle = '#263554';
        ctx.beginPath();
        ctx.roundRect(-80, -135, 160, 265, 12);
        ctx.fill();

        // LIVE pill
        ctx.fillStyle = '#FF1744';
        ctx.beginPath();
        ctx.roundRect(-68, -122, 64, 24, 6);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('LIVE', -36, -105);

        ctx.fillStyle = '#ffd54f';
        ctx.font = '800 14px system-ui, sans-serif';
        ctx.fillText('14.2K VIEWERS', 28, -105);

        // Mini guard waving
        ctx.fillStyle = '#80C7FF';
        ctx.beginPath();
        ctx.arc(0, -25, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 14px system-ui, sans-serif';
        ctx.fillText('"RATE OUR', 0, 42);
        ctx.fillText('LASER HALLWAY!"', 0, 62);
        ctx.fillStyle = '#ff8a80';
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.fillText('GPS PIN: SHARED', 0, 98);
        ctx.restore();
      }

      // 4. Comedy Gag: Broken Breakroom Coffee Machine
      if (showCoffeeGag) {
        ctx.save();
        ctx.translate(1410, STAGE2D_FLOOR_Y);
        // Table
        ctx.fillStyle = '#8d6e63';
        ctx.strokeStyle = '#222633';
        ctx.lineWidth = 3.5;
        ctx.fillRect(-95, -120, 190, 120);
        ctx.strokeRect(-95, -120, 190, 120);
        // Coffee brewer
        ctx.fillStyle = '#37474f';
        ctx.fillRect(-48, -235, 96, 115);
        ctx.strokeRect(-48, -235, 96, 115);
        // Smoking puff
        ctx.fillStyle = 'rgba(220, 226, 235, 0.85)';
        ctx.beginPath();
        ctx.arc(Math.sin(t * 5) * 10, -260 - ((t * 40) % 45), 18, 0, Math.PI * 2);
        ctx.fill();
        // Sticky note
        ctx.fillStyle = '#ffee58';
        ctx.fillRect(-40, -195, 80, 38);
        ctx.strokeRect(-40, -195, 80, 38);
        ctx.fillStyle = '#d32f2f';
        ctx.font = '900 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BROKEN', 0, -172);
        ctx.restore();
      }

      // 5. Watt Protagonist in Villain Cape
      let pose: Watt2DPose = 'explain';
      if (showCoffeeGag) pose = 'deadpan';
      else if (showLeaks) pose = 'shocked';

      drawWatt2D(ctx, {
        x: 1150,
        y: STAGE2D_FLOOR_Y,
        s: 360,
        t,
        pose,
        outfit: 'villain',
        flip: -1,
      });
    },
    [leakSec, coffeeSec]
  );

  return (
    <Stage2D
      skyTop={skyColor}
      skyBottom={fogColor}
      horizonColor="#6e8bb5"
      floorColor="#e8edf5"
      cameraSchedule={cameraSchedule}
      onDrawScene={onDrawScene}
    >
      <AudioTrack audioPath={audioPath} words={words} sfxCues={sfxCues} />
      <ChapterCard chapterNumber={2} title={title} accentColor="#FFB74D" />
      <TelemetryHUD words={words} side="right" widgets={hudWidgets} />
      <KineticCaptions words={words} fallbackLine="Forty-seven guards livestreamed your base on TikTok." />
    </Stage2D>
  );
};
