import React, { useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useVideoConfig } from 'remotion';
import { PS1Stage, PS1SceneContext } from '../components/PS1Stage';
import { KineticCaptions } from '../components/KineticCaptions';
import { ChapterCard } from '../components/ChapterCard';
import { TelemetryHUD, TelemetryWidgetSpec } from '../components/TelemetryHUD';
import { AudioTrack, buildSfxCue } from '../components/AudioTrack';
import { useChapterWords } from '../components/useChapterWords';
import { createWatt, WattInstance } from '../three/watt-model';
import {
  createCameraSchedule,
  cueCameraAt,
  updateCameraDirector,
} from '../three/cameraDirector';
import { cueAt } from '../three/timing';
import { ChapterComponentProps } from './index';

export const Chapter05: React.FC<ChapterComponentProps> = ({
  title = 'Chapter 5: The 60-Second Restart',
  skyColor = '#558de0',
  fogColor = '#7eaee8',
  audioPath,
  wordsPath,
  words: wordsProp = [],
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const durationSec = durationInFrames / fps;
  const loadedWords = useChapterWords(wordsPath);
  const words = wordsProp.length > 0 ? wordsProp : loadedWords;

  const snapSec = useMemo(() => cueAt(words, 'snaps', 7.0), [words]);
  const deadpanSec = useMemo(() => cueAt(words, 'settles', Math.max(24, durationSec - 22)), [words, durationSec]);
  const questionSec = useMemo(() => cueAt(words, 'question', Math.max(32, durationSec - 14)), [words, durationSec]);

  const cameraSchedule = useMemo(
    () =>
      createCameraSchedule(
        durationSec,
        [
          cueCameraAt(words, 'restart', 'wide', 6.5, { fallbackStartSec: 0 }),
          cueCameraAt(words, 'snaps', 'impactShake', 7.5, { fallbackStartSec: 7.0, intensity: 1.3 }),
          cueCameraAt(words, 'megatsunamis', 'orbit', 8.0, { fallbackStartSec: 16.0 }),
          cueCameraAt(words, 'settles', 'dollyIn', 8.0, { fallbackStartSec: Math.max(24, durationSec - 22) }),
          cueCameraAt(words, 'question', 'closeup', 14.0, { fallbackStartSec: Math.max(32, durationSec - 14) }),
        ],
        7.5
      ),
    [durationSec, words]
  );

  const sfxCues = useMemo(
    () => [
      buildSfxCue(words, 'restart', 'alarm', { fallbackSec: 4.5, volume: 0.55 }),
      buildSfxCue(words, 'snaps', 'impact', { fallbackSec: 7.0, volume: 0.78 }),
      buildSfxCue(words, 'west', 'whoosh', { fallbackSec: 12.0, volume: 0.65 }),
      buildSfxCue(words, 'question', 'chime', { fallbackSec: Math.max(32, durationSec - 14), volume: 0.55 }),
    ],
    [words, durationSec]
  );

  const hudWidgets = useMemo<TelemetryWidgetSpec[]>(
    () => [
      {
        id: 'timer',
        kind: 'counter',
        label: 'Stop Timer',
        unit: 's',
        min: 0,
        max: 60,
        decimals: 1,
        triggerSec: 0.3,
        keyframes: [
          { timeSec: 0.3, value: 54.0, severity: 'warn' },
          { word: 'snaps', timeSec: 7.0, value: 60.0, severity: 'critical' },
          { word: 'settles', timeSec: 26.0, value: 0.0, severity: 'normal' },
        ],
      },
      {
        id: 'restart',
        kind: 'gauge',
        label: 'Spin Snapback',
        unit: 'mph',
        min: 0,
        max: 1040,
        decimals: 0,
        triggerSec: 1.0,
        keyframes: [
          { timeSec: 1.0, value: 0, severity: 'critical' },
          { word: 'snaps', timeSec: 7.2, value: 1040, severity: 'warn' },
          { word: 'settles', timeSec: 26.0, value: 1040, severity: 'normal' },
        ],
      },
      {
        id: 'status',
        kind: 'badge',
        label: 'Planet Status',
        badgeText: 'REBOOTED',
        severity: 'normal',
        triggerSec: Math.max(22, durationSec - 22),
      },
    ],
    [durationSec]
  );

  const objectsRef = useRef<{
    watt: WattInstance;
    rubble: THREE.Object3D[];
  } | null>(null);

  const onBuildScene = useCallback((ctx: PS1SceneContext) => {
    const { scene, ps1 } = ctx;

    const groundMat = ps1(new THREE.MeshLambertMaterial({ color: 0x7c8798, flatShading: true }));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60, 14, 14), groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const ruinMat = ps1(new THREE.MeshLambertMaterial({ color: 0x9aa8bd, flatShading: true }));
    for (let i = 0; i < 8; i++) {
      const h = 2.0 + (i % 4) * 1.1;
      const col = new THREE.Mesh(new THREE.BoxGeometry(1.1, h, 1.1), ruinMat);
      col.position.set(-9 + i * 2.6, h / 2 - 0.1, -6.5 - (i % 2) * 2.0);
      col.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.14;
      scene.add(col);
    }

    const watt = createWatt({ ps1Shader: ps1 });
    watt.setPosition(0, 0, 0);
    scene.add(watt.root);

    const rubble: THREE.Object3D[] = [];
    const colors = [0xff8a65, 0x90a4ae, 0xffd54f, 0x81c784];
    for (let i = 0; i < 10; i++) {
      const size = 0.38 + (i % 3) * 0.16;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        ps1(new THREE.MeshLambertMaterial({ color: colors[i % colors.length], flatShading: true }))
      );
      box.userData.baseX = -8 + i * 1.8;
      box.userData.baseY = size / 2;
      box.userData.baseZ = -1.8 - (i % 3) * 1.1;
      box.userData.phase = i * 0.7;
      box.position.set(box.userData.baseX, box.userData.baseY, box.userData.baseZ);
      scene.add(box);
      rubble.push(box);
    }

    objectsRef.current = { watt, rubble };
  }, []);

  const onUpdateFrame = useCallback(
    (ctx: PS1SceneContext, t: number) => {
      const objs = objectsRef.current;
      if (!objs) return;
      const { watt, rubble } = objs;

      if (t < snapSec) {
        watt.setFace('confused');
        watt.idle(t);
      } else if (t < deadpanSec) {
        const dt = t - snapSec;
        watt.setFace('scared');
        watt.setPosition(-Math.min(0.8, dt * 0.25) * Math.sin(dt * 2) * 0.5, 0, Math.abs(Math.sin(t * 5)) * 0.15);
        watt.panic(t);
      } else if (t < questionSec) {
        watt.setFace('deadpan');
        watt.setPosition(0, 0, 0);
        watt.setPose('deadpan', t);
      } else {
        watt.setFace('smug');
        watt.setIdea(1.0);
        watt.setPosition(0, 0, 0);
        watt.idle(t);
      }

      const slamDt = t >= snapSec && t < deadpanSec ? t - snapSec : 0;
      for (const r of rubble) {
        const wx = (((r.userData.baseX - slamDt * 5.2) + 12) % 24) - 12;
        r.position.set(
          wx,
          r.userData.baseY + (slamDt > 0 ? Math.abs(Math.sin(t * 3 + r.userData.phase)) * 0.45 : 0),
          r.userData.baseZ
        );
        r.rotation.z = slamDt * 2.5;
      }

      updateCameraDirector(ctx.camera, t, cameraSchedule, watt.root.position, rubble);
    },
    [cameraSchedule, snapSec, deadpanSec, questionSec]
  );

  return (
    <PS1Stage
      skyColor={skyColor}
      fogColor={fogColor}
      hemisphereIntensity={1.6}
      crtOpacity={0.18}
      onBuildScene={onBuildScene}
      onUpdateFrame={onUpdateFrame}
    >
      <AudioTrack audioPath={audioPath} words={words} sfxCues={sfxCues} />
      <ChapterCard chapterNumber={5} title={title} />
      <TelemetryHUD words={words} side="right" widgets={hudWidgets} />
      <KineticCaptions words={words} fallbackLine="Where would you hide with a 10-second warning?" />
    </PS1Stage>
  );
};
