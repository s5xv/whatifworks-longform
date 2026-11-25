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

export const Chapter01: React.FC<ChapterComponentProps> = ({
  title = 'Chapter 1: The Secret Lair Problem',
  skyColor = '#5da2e8',
  fogColor = '#b7dcff',
  audioPath,
  wordsPath,
  words: wordsProp = [],
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const durationSec = durationInFrames / fps;
  const loadedWords = useChapterWords(wordsPath);
  const words = wordsProp.length > 0 ? wordsProp : loadedWords;

  const costSec = useMemo(() => cueAt(words, 'billion', 14.0), [words]);
  const truckSec = useMemo(() => cueAt(words, 'trucks', 24.0), [words]);
  const thermalSec = useMemo(() => cueAt(words, 'thermal', 36.0), [words]);
  const spotSec = useMemo(() => cueAt(words, 'forty-eight', 44.0), [words]);
  const permitSec = useMemo(() => cueAt(words, 'permit', Math.max(46, durationSec - 9)), [words, durationSec]);

  const cameraSchedule = useMemo(
    () =>
      createCamera2DSchedule(durationSec, [
        cueCamera2DAt(words, 'supervillain', 'wide', 5.5, { fallbackStartSec: 0 }),
        cueCamera2DAt(words, 'volcano', 'zoomIn', 5.5, {
          fallbackStartSec: 7.0,
          focusX: 620,
          focusY: 600,
          zoom: 1.2,
        }),
        cueCamera2DAt(words, 'trucks', 'pan', 6.0, {
          fallbackStartSec: truckSec,
          panX: 110,
        }),
        cueCamera2DAt(words, 'thermal', 'whipPan', 5.5, {
          fallbackStartSec: thermalSec,
          focusX: 660,
          focusY: 500,
          zoom: 1.16,
        }),
        cueCamera2DAt(words, 'forty-eight', 'impactShake', 4.8, {
          fallbackStartSec: spotSec,
          intensity: 1.15,
        }),
        cueCamera2DAt(words, 'inspector', 'zoomIn', 6.5, {
          fallbackStartSec: permitSec - 3,
          focusX: 1180,
          focusY: 660,
          zoom: 1.22,
        }),
      ]),
    [durationSec, words, truckSec, thermalSec, spotSec, permitSec]
  );

  const sfxCues = useMemo(
    () => [
      buildSfxCue(words, 'supervillain', 'whoosh', { fallbackSec: 1.2, volume: 0.55 }),
      buildSfxCue(words, 'billion', 'chime', { fallbackSec: costSec, volume: 0.52 }),
      buildSfxCue(words, 'forty-eight', 'alarm', { fallbackSec: spotSec, volume: 0.68 }),
      buildSfxCue(words, 'permit', 'impact', { fallbackSec: permitSec, volume: 0.72 }),
    ],
    [words, costSec, spotSec, permitSec]
  );

  const hudWidgets = useMemo<TelemetryWidgetSpec[]>(
    () => [
      {
        id: 'lair-budget',
        kind: 'counter',
        label: 'LAIR BUDGET',
        prefix: '$',
        unit: 'B',
        min: 0,
        max: 2.0,
        decimals: 1,
        triggerSec: 0.6,
        keyframes: [
          { timeSec: 0.6, value: 0.1, severity: 'normal' },
          { timeSec: costSec, value: 1.8, severity: 'warn' },
        ],
      },
      {
        id: 'stealth-pct',
        kind: 'gauge',
        label: 'STEALTH',
        unit: '%',
        min: 0,
        max: 100,
        decimals: 0,
        triggerSec: 1.2,
        keyframes: [
          { timeSec: 1.2, value: 100, severity: 'normal' },
          { timeSec: truckSec, value: 45, severity: 'warn' },
          { timeSec: spotSec, value: 0, severity: 'critical' },
        ],
      },
      {
        id: 'thermal-badge',
        kind: 'badge',
        label: 'THERMAL SATELLITE',
        badgeText: 'LOCKED (48H)',
        severity: 'critical',
        triggerSec: spotSec,
      },
    ],
    [costSec, truckSec, spotSec]
  );

  const onDrawScene = useCallback(
    (ctx: CanvasRenderingContext2D, t: number, _frame: number, _dur: number, _cam: Camera2DState) => {
      const thermalAlert = t >= thermalSec;
      const spotted = t >= spotSec;
      const showPermitGag = t >= permitSec - 1.5;

      // 1. Bright 2D Cutaway Volcano Blueprint (left-center)
      ctx.save();
      ctx.translate(640, STAGE2D_FLOOR_Y);

      // Volcano silhouette cone
      ctx.beginPath();
      ctx.moveTo(-410, 0);
      ctx.lineTo(-140, -470);
      ctx.lineTo(140, -470);
      ctx.lineTo(410, 0);
      ctx.closePath();
      ctx.fillStyle = '#5c4d4d';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#222633';
      ctx.stroke();

      // Crater rim lava glow
      ctx.beginPath();
      ctx.ellipse(0, -468, 138, 22, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ff7043';
      ctx.fill();
      ctx.strokeStyle = '#222633';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Blueprint Cutaway Cross-Section Panel inside the Volcano
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-250, -390, 500, 355, 18);
      ctx.fillStyle = thermalAlert ? '#24345a' : '#1b4988';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#80C7FF';
      ctx.stroke();
      ctx.clip();

      // Blueprint grid lines
      ctx.strokeStyle = 'rgba(128, 199, 255, 0.22)';
      ctx.lineWidth = 1.5;
      for (let gx = -240; gx <= 240; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, -390);
        ctx.lineTo(gx, -35);
        ctx.stroke();
      }
      for (let gy = -380; gy <= -40; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(-250, gy);
        ctx.lineTo(250, gy);
        ctx.stroke();
      }

      // Room 1: Control Room (top)
      ctx.strokeStyle = '#9be7ff';
      ctx.lineWidth = 3;
      ctx.strokeRect(-210, -350, 200, 125);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('EVIL CONTROL ROOM', -110, -324);
      // Monitor screens
      ctx.fillStyle = '#69F0AE';
      ctx.fillRect(-185, -305, 58, 36);
      ctx.fillStyle = '#ffd54f';
      ctx.fillRect(-115, -305, 58, 36);

      // Room 2: Ventilation Shafts & HVAC
      ctx.strokeStyle = '#9be7ff';
      ctx.strokeRect(10, -350, 200, 125);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('HVAC ($40M/YR)', 110, -324);
      // Spinning fan blades
      ctx.save();
      ctx.translate(110, -270);
      ctx.rotate(t * 7);
      ctx.strokeStyle = '#80C7FF';
      ctx.lineWidth = 5;
      for (let b = 0; b < 4; b++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(28, 0);
        ctx.stroke();
      }
      ctx.restore();

      // Room 3: Shark Tank (bottom left)
      ctx.fillStyle = 'rgba(41, 182, 246, 0.45)';
      ctx.fillRect(-210, -205, 220, 140);
      ctx.strokeStyle = '#80C7FF';
      ctx.strokeRect(-210, -205, 220, 140);
      // Swimming shark fin
      const finX = -150 + ((t * 55) % 120);
      ctx.fillStyle = '#b0bec5';
      ctx.beginPath();
      ctx.moveTo(finX, -135);
      ctx.lineTo(finX + 18, -162);
      ctx.lineTo(finX + 30, -135);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText('SHARK TANK', -100, -180);

      // Room 4: Generator Core (bottom right - glowing hot on thermal!)
      const corePulse = 0.5 + 0.5 * Math.sin(t * 8);
      ctx.fillStyle = thermalAlert
        ? `rgba(255, 82, 82, ${0.42 + corePulse * 0.25})`
        : 'rgba(255, 183, 77, 0.35)';
      ctx.fillRect(30, -205, 180, 140);
      ctx.strokeStyle = thermalAlert ? '#FF5252' : '#FFB74D';
      ctx.strokeRect(30, -205, 180, 140);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('GENERATOR CORE', 120, -180);
      ctx.fillStyle = thermalAlert ? '#FF8A80' : '#FFE082';
      ctx.font = '900 18px system-ui, sans-serif';
      ctx.fillText(thermalAlert ? 'HEAT: 98 MW!' : 'POWER: 14 MW', 120, -120);

      ctx.restore();

      // Rising thermal heat squiggles once thermal beat starts
      if (thermalAlert) {
        ctx.strokeStyle = 'rgba(255, 82, 82, 0.85)';
        ctx.lineWidth = 4;
        for (let i = -1; i <= 1; i++) {
          const hx = i * 55;
          const phase = (t * 2 + i) % 1;
          ctx.beginPath();
          ctx.moveTo(hx, -485 - phase * 110);
          ctx.quadraticCurveTo(hx + 16, -515 - phase * 110, hx, -545 - phase * 110);
          ctx.stroke();
        }
      }
      ctx.restore();

      // 2. Concrete Mixer Trucks driving up near volcano base during construction beat
      if (t >= costSec - 2 && t < spotSec + 2) {
        for (let i = 0; i < 3; i++) {
          const tx = 140 + ((t * 95 + i * 165) % 420);
          const ty = STAGE2D_FLOOR_Y - 12;
          ctx.save();
          ctx.translate(tx, ty);
          ctx.fillStyle = '#ffb300';
          ctx.strokeStyle = '#222633';
          ctx.lineWidth = 3;
          ctx.fillRect(-34, -34, 64, 24);
          ctx.strokeRect(-34, -34, 64, 24);
          // Mixer drum
          ctx.beginPath();
          ctx.ellipse(-6, -42, 24, 15, -0.18, 0, Math.PI * 2);
          ctx.fillStyle = '#eceff1';
          ctx.fill();
          ctx.stroke();
          // Wheels
          ctx.fillStyle = '#222633';
          ctx.beginPath();
          ctx.arc(-18, -6, 8, 0, Math.PI * 2);
          ctx.arc(16, -6, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 3. Orbiting Infrared Spy Satellite + Thermal Scan Beam
      const satX = 560 + Math.sin(t * 0.9) * 140;
      const satY = 140;
      ctx.save();
      ctx.translate(satX, satY);
      // Scan cone
      const beamAlpha = thermalAlert ? 0.34 : 0.16;
      ctx.beginPath();
      ctx.moveTo(0, 18);
      ctx.lineTo(-170, STAGE2D_FLOOR_Y - satY - 220);
      ctx.lineTo(220, STAGE2D_FLOOR_Y - satY - 220);
      ctx.closePath();
      ctx.fillStyle = spotted
        ? `rgba(255, 82, 82, ${beamAlpha})`
        : `rgba(105, 240, 174, ${beamAlpha})`;
      ctx.fill();

      // Satellite body + solar wings
      ctx.fillStyle = '#1e88e5';
      ctx.strokeStyle = '#0d162b';
      ctx.lineWidth = 3;
      ctx.fillRect(-76, -12, 46, 24);
      ctx.strokeRect(-76, -12, 46, 24);
      ctx.fillRect(30, -12, 46, 24);
      ctx.strokeRect(30, -12, 46, 24);
      ctx.fillStyle = '#cfd8dc';
      ctx.fillRect(-26, -18, 52, 36);
      ctx.strokeRect(-26, -18, 52, 36);
      // Red thermal eye
      ctx.beginPath();
      ctx.arc(0, 12, 8, 0, Math.PI * 2);
      ctx.fillStyle = spotted ? '#FF1744' : '#69F0AE';
      ctx.fill();
      ctx.restore();

      if (spotted) {
        ctx.save();
        ctx.translate(640, 320);
        ctx.fillStyle = 'rgba(183, 28, 28, 0.92)';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-145, -24, 290, 48, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TARGET LOCKED: VOLCANO #4', 0, 6);
        ctx.restore();
      }

      // 4. Watt Protagonist in Villain Cape
      let pose: Watt2DPose = 'explain';
      if (t < 2.2) pose = 'idle';
      else if (showPermitGag) pose = 'deadpan';
      else if (spotted) pose = 'shocked';

      drawWatt2D(ctx, {
        x: 1180,
        y: STAGE2D_FLOOR_Y,
        s: 360,
        t,
        pose,
        outfit: 'villain',
        flip: -1,
      });

      // 5. Comedy Gag: Red "ZONING VIOLATION: SHARK TANK" Fine Stamp
      if (showPermitGag) {
        ctx.save();
        ctx.translate(1335, 575);
        ctx.rotate(-0.14);
        ctx.fillStyle = '#fffde7';
        ctx.strokeStyle = '#222633';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(-140, -90, 280, 180, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#d32f2f';
        ctx.strokeStyle = '#d32f2f';
        ctx.lineWidth = 4;
        ctx.strokeRect(-115, -55, 230, 74);
        ctx.font = '900 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CODE VIOLATION', 0, -24);
        ctx.font = '800 16px system-ui, sans-serif';
        ctx.fillText('NO SHARK PERMIT', 0, 4);

        ctx.fillStyle = '#222633';
        ctx.font = '800 17px system-ui, sans-serif';
        ctx.fillText('FINE: $4,500', 0, 54);
        ctx.restore();
      }
    },
    [costSec, thermalSec, spotSec, permitSec]
  );

  return (
    <Stage2D
      skyTop={skyColor}
      skyBottom={fogColor}
      horizonColor="#4da86b"
      floorColor="#dce8f2"
      cameraSchedule={cameraSchedule}
      onDrawScene={onDrawScene}
    >
      <AudioTrack audioPath={audioPath} words={words} sfxCues={sfxCues} />
      <ChapterCard chapterNumber={1} title={title} accentColor="#FF7043" />
      <TelemetryHUD words={words} side="right" widgets={hudWidgets} />
      <KineticCaptions words={words} fallbackLine="Your biggest enemy is your electric bill." />
    </Stage2D>
  );
};
