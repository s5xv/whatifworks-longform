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

export const Chapter05: React.FC<ChapterComponentProps> = ({
  title = 'Chapter 5: The Real-World Ending & Payoff',
  skyColor = '#6499de',
  fogColor = '#cfe3fa',
  audioPath,
  wordsPath,
  words: wordsProp = [],
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const durationSec = durationInFrames / fps;
  const loadedWords = useChapterWords(wordsPath);
  const words = wordsProp.length > 0 ? wordsProp : loadedWords;

  const taxSec = useMemo(() => cueAt(words, 'tax', 12.0), [words]);
  const powerOffSec = useMemo(() => cueAt(words, 'power', 22.0), [words]);
  const padlockSec = useMemo(() => cueAt(words, 'padlock', 34.0), [words]);
  const pollSec = useMemo(() => cueAt(words, 'question', Math.max(44, durationSec - 14)), [words, durationSec]);

  const cameraSchedule = useMemo(
    () =>
      createCamera2DSchedule(durationSec, [
        cueCamera2DAt(words, 'movies', 'wide', 5.5, { fallbackStartSec: 0 }),
        cueCamera2DAt(words, 'tax', 'zoomIn', 5.5, {
          fallbackStartSec: taxSec,
          focusX: 520,
          focusY: 460,
          zoom: 1.2,
        }),
        cueCamera2DAt(words, 'power', 'pan', 5.5, {
          fallbackStartSec: powerOffSec,
          panX: -100,
        }),
        cueCamera2DAt(words, 'padlock', 'impactShake', 5.0, {
          fallbackStartSec: padlockSec,
          intensity: 1.25,
        }),
        cueCamera2DAt(words, 'question', 'zoomIn', 7.0, {
          fallbackStartSec: pollSec,
          focusX: 980,
          focusY: 610,
          zoom: 1.16,
        }),
      ]),
    [durationSec, words, taxSec, powerOffSec, padlockSec, pollSec]
  );

  const sfxCues = useMemo(
    () => [
      buildSfxCue(words, 'movies', 'whoosh', { fallbackSec: 1.5, volume: 0.5 }),
      buildSfxCue(words, 'tax', 'alarm', { fallbackSec: taxSec, volume: 0.62 }),
      buildSfxCue(words, 'padlock', 'impact', { fallbackSec: padlockSec, volume: 0.8 }),
      buildSfxCue(words, 'question', 'chime', { fallbackSec: pollSec, volume: 0.52 }),
    ],
    [words, taxSec, padlockSec, pollSec]
  );

  const hudWidgets = useMemo<TelemetryWidgetSpec[]>(
    () => [
      {
        id: 'heroes-needed',
        kind: 'counter',
        label: 'HEROES NEEDED',
        min: 0,
        max: 10,
        decimals: 0,
        triggerSec: 0.6,
        keyframes: [{ timeSec: 0.6, value: 0, severity: 'normal' }],
      },
      {
        id: 'tax-audit',
        kind: 'badge',
        label: 'IRS AUDIT',
        badgeText: 'TRIGGERED',
        severity: 'warn',
        triggerSec: taxSec,
      },
      {
        id: 'lair-foreclosed',
        kind: 'badge',
        label: 'LAIR STATUS',
        badgeText: 'FORECLOSED',
        severity: 'critical',
        triggerSec: padlockSec,
      },
    ],
    [taxSec, padlockSec]
  );

  const onDrawScene = useCallback(
    (ctx: CanvasRenderingContext2D, t: number, _frame: number, _dur: number, _cam: Camera2DState) => {
      const showTaxStamp = t >= taxSec;
      const showUtilityDisconnect = t >= powerOffSec;
      const showPadlock = t >= padlockSec;
      const showPoll = t >= pollSec;

      // 1. Foreclosed Lair Vault Door + Padlock (left)
      ctx.save();
      ctx.translate(450, STAGE2D_FLOOR_Y);
      // Stone arch
      ctx.fillStyle = '#607d8b';
      ctx.strokeStyle = '#222633';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(-210, -370, 420, 370, [180, 180, 0, 0]);
      ctx.fill();
      ctx.stroke();

      // Steel vault door
      ctx.fillStyle = '#90a4ae';
      ctx.beginPath();
      ctx.roundRect(-155, -315, 310, 315, [130, 130, 0, 0]);
      ctx.fill();
      ctx.stroke();

      // Official Red Stamps / Notices on Door
      if (showTaxStamp) {
        ctx.save();
        ctx.translate(-55, -210);
        ctx.rotate(-0.15);
        ctx.fillStyle = '#fffde7';
        ctx.strokeStyle = '#d32f2f';
        ctx.lineWidth = 4;
        ctx.fillRect(-100, -34, 200, 68);
        ctx.strokeRect(-100, -34, 200, 68);
        ctx.fillStyle = '#d32f2f';
        ctx.font = '900 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('IRS SEIZED', 0, 6);
        ctx.restore();
      }

      if (showUtilityDisconnect) {
        ctx.save();
        ctx.translate(65, -110);
        ctx.rotate(0.12);
        ctx.fillStyle = '#fff3e0';
        ctx.strokeStyle = '#e65100';
        ctx.lineWidth = 4;
        ctx.fillRect(-105, -32, 210, 64);
        ctx.strokeRect(-105, -32, 210, 64);
        ctx.fillStyle = '#e65100';
        ctx.font = '900 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('POWER SHUT OFF', 0, 6);
        ctx.restore();
      }

      // Giant Heavy Padlock slamming onto door
      if (showPadlock) {
        ctx.save();
        ctx.translate(0, -145);
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.arc(0, -36, 36, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = '#ffb300';
        ctx.strokeStyle = '#222633';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(-52, -36, 104, 86, 14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#222633';
        ctx.beginPath();
        ctx.arc(0, 2, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // 2. Giant Past-Due Electric Bill Envelope in Watt's Hand / Foreground
      ctx.save();
      ctx.translate(820, STAGE2D_FLOOR_Y - 190);
      ctx.rotate(-0.08);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#222633';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(-95, -56, 190, 112, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#d32f2f';
      ctx.font = '900 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAST DUE BILL', 0, -16);
      ctx.fillStyle = '#222633';
      ctx.font = '800 17px system-ui, sans-serif';
      ctx.fillText('$4,280,911.00', 0, 18);
      ctx.restore();

      // 3. Watt Protagonist (deadpan payoff!)
      let pose: Watt2DPose = 'explain';
      if (t >= powerOffSec) pose = 'deadpan';
      else if (showPadlock) pose = 'shocked';

      drawWatt2D(ctx, {
        x: 980,
        y: STAGE2D_FLOOR_Y,
        s: 360,
        t,
        pose,
        outfit: 'villain',
      });

      // 4. Comment-Bait Poll Graphic in final 14s
      if (showPoll) {
        const options = [
          '1. THE IRS TAX AUDIT',
          '2. UNPAID ELECTRIC BILL',
          '3. TIKTOK HENCHMEN',
        ];
        ctx.save();
        ctx.translate(1360, 505);
        ctx.fillStyle = 'rgba(13, 22, 43, 0.90)';
        ctx.strokeStyle = '#80C7FF';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.roundRect(-220, -125, 440, 250, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#80C7FF';
        ctx.font = '900 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WHAT RUINS YOU FIRST?', 0, -84);

        options.forEach((opt, idx) => {
          const y = -32 + idx * 58;
          ctx.fillStyle = 'rgba(128, 199, 255, 0.16)';
          ctx.strokeStyle = '#80C7FF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(-185, y - 22, 370, 44, 10);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.font = '800 17px system-ui, sans-serif';
          ctx.fillText(opt, 0, y + 6);
        });
        ctx.restore();
      }
    },
    [taxSec, powerOffSec, padlockSec, pollSec]
  );

  return (
    <Stage2D
      skyTop={skyColor}
      skyBottom={fogColor}
      horizonColor="#7592b8"
      floorColor="#eaeff5"
      cameraSchedule={cameraSchedule}
      onDrawScene={onDrawScene}
    >
      <AudioTrack audioPath={audioPath} words={words} sfxCues={sfxCues} />
      <ChapterCard chapterNumber={5} title={title} accentColor="#80C7FF" />
      <TelemetryHUD words={words} side="right" widgets={hudWidgets} />
      <KineticCaptions words={words} fallbackLine="Drop your answer in the comments." />
    </Stage2D>
  );
};
