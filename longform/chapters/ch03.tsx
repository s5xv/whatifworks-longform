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

export const Chapter03: React.FC<ChapterComponentProps> = ({
  title = 'Chapter 3: Megatsunamis & Shifting Oceans',
  skyColor = '#3e96dc',
  fogColor = '#72baf0',
  audioPath,
  wordsPath,
  words: wordsProp = [],
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const durationSec = durationInFrames / fps;
  const loadedWords = useChapterWords(wordsPath);
  const words = wordsProp.length > 0 ? wordsProp : loadedWords;

  const surgeSec = useMemo(() => cueAt(words, 'megatsunamis', 18.0), [words]);
  const gagSec = useMemo(() => cueAt(words, 'Antarctica', Math.max(38, durationSec - 10)), [words, durationSec]);

  const cameraSchedule = useMemo(
    () =>
      createCameraSchedule(
        durationSec,
        [
          cueCameraAt(words, 'oceans', 'wide', 7.5, { fallbackStartSec: 0 }),
          cueCameraAt(words, 'bulge', 'dollyIn', 8.0, { fallbackStartSec: 8.0 }),
          cueCameraAt(words, 'megatsunamis', 'impactShake', 7.0, { fallbackStartSec: 18.0, intensity: 1.25 }),
          cueCameraAt(words, 'poles', 'overhead', 8.5, { fallbackStartSec: 27.0 }),
          cueCameraAt(words, 'beachfront', 'closeup', 9.0, { fallbackStartSec: Math.max(38, durationSec - 12) }),
        ],
        7.5
      ),
    [durationSec, words]
  );

  const sfxCues = useMemo(
    () => [
      buildSfxCue(words, 'centrifugal', 'whoosh', { fallbackSec: 7.0, volume: 0.55 }),
      buildSfxCue(words, 'megatsunamis', 'impact', { fallbackSec: 18.0, volume: 0.75 }),
      buildSfxCue(words, 'poles', 'alarm', { fallbackSec: 26.0, volume: 0.5 }),
      buildSfxCue(words, 'Antarctica', 'chime', { fallbackSec: Math.max(38, durationSec - 10), volume: 0.55 }),
    ],
    [words, durationSec]
  );

  const hudWidgets = useMemo<TelemetryWidgetSpec[]>(
    () => [
      {
        id: 'bulge',
        kind: 'gauge',
        label: 'Equator Bulge',
        unit: 'mi',
        min: 0,
        max: 13,
        decimals: 1,
        triggerSec: 0.5,
        keyframes: [
          { timeSec: 0.5, value: 13.0, severity: 'normal' },
          { word: 'vanishes', timeSec: 14.0, value: 0.0, severity: 'critical' },
        ],
      },
      {
        id: 'wave',
        kind: 'counter',
        label: 'Surge Height',
        unit: 'ft',
        min: 0,
        max: 6000,
        decimals: 0,
        triggerSec: 2.0,
        keyframes: [
          { timeSec: 2.0, value: 12, severity: 'normal' },
          { word: 'megatsunamis', timeSec: 18.0, value: 5280, severity: 'critical' },
        ],
      },
      {
        id: 'flow',
        kind: 'badge',
        label: 'Ocean Flow',
        badgeText: 'POLEWARD',
        severity: 'warn',
        triggerSec: 4.0,
      },
    ],
    []
  );

  const objectsRef = useRef<{
    watt: WattInstance;
    ocean: THREE.Mesh;
    duck: THREE.Group;
    props: THREE.Object3D[];
  } | null>(null);

  const onBuildScene = useCallback((ctx: PS1SceneContext) => {
    const { scene, ps1 } = ctx;

    const sandMat = ps1(new THREE.MeshLambertMaterial({ color: 0xe6cf96, flatShading: true }));
    const island = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.6, 0.6, 10), sandMat);
    island.position.set(0, -0.25, 0);
    scene.add(island);

    const woodMat = ps1(new THREE.MeshLambertMaterial({ color: 0x8c6239, flatShading: true }));
    const pier = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 3.6), woodMat);
    pier.position.set(0, 0.05, -1.2);
    scene.add(pier);

    const oceanMat = ps1(new THREE.MeshLambertMaterial({ color: 0x1e88e5, flatShading: true }));
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(70, 70, 18, 18), oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, -0.35, -8);
    scene.add(ocean);

    const watt = createWatt({ ps1Shader: ps1 });
    watt.setPosition(0, 0, 0);
    scene.add(watt.root);

    const duck = new THREE.Group();
    const yellowMat = ps1(new THREE.MeshLambertMaterial({ color: 0xffeb3b, flatShading: true }));
    const orangeMat = ps1(new THREE.MeshLambertMaterial({ color: 0xff7043, flatShading: true }));
    const duckBody = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.42, 0.8), yellowMat);
    const duckHead = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), yellowMat);
    duckHead.position.set(0, 0.35, 0.22);
    const duckBeak = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.2), orangeMat);
    duckBeak.position.set(0, 0.32, 0.48);
    duck.add(duckBody, duckHead, duckBeak);
    duck.position.set(1.6, 0.1, -2.0);
    scene.add(duck);

    const props: THREE.Object3D[] = [duck];
    const foamMat = ps1(new THREE.MeshLambertMaterial({ color: 0xdbf0ff, flatShading: true }));
    for (let i = 0; i < 10; i++) {
      const crest = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7 + (i % 3) * 0.4, 1.1), foamMat);
      crest.userData.baseX = -11 + i * 2.4;
      crest.userData.baseZ = -4.5 - (i % 3) * 1.8;
      crest.userData.phase = i * 0.6;
      crest.position.set(crest.userData.baseX, -0.1, crest.userData.baseZ);
      scene.add(crest);
      props.push(crest);
    }

    objectsRef.current = { watt, ocean, duck, props };
  }, []);

  const onUpdateFrame = useCallback(
    (ctx: PS1SceneContext, t: number) => {
      const objs = objectsRef.current;
      if (!objs) return;
      const { watt, ocean, duck, props } = objs;

      if (t < surgeSec) {
        watt.setFace('confused');
        watt.walk(t, 0.7);
      } else if (t < gagSec) {
        watt.setFace('scared');
        watt.panic(t);
      } else {
        watt.setFace('deadpan');
        watt.setPose('deadpan', t);
      }

      const surgeFactor = Math.max(0, Math.min(1, (t - surgeSec * 0.7) / 6.0));
      ocean.position.y = -0.35 + surgeFactor * 0.32 + Math.sin(t * 2.2) * 0.08;

      const duckDrift = Math.max(0, t - gagSec + 4);
      duck.position.set(
        1.6 + Math.sin(t * 1.4) * 0.3,
        0.15 + surgeFactor * 0.4 + Math.sin(t * 3.0) * 0.12,
        -2.0 - duckDrift * 1.1
      );
      duck.rotation.y = Math.sin(t * 1.2) * 0.4;

      for (let i = 1; i < props.length; i++) {
        const c = props[i];
        c.position.y = -0.1 + surgeFactor * 0.9 + Math.sin(t * 2.6 + c.userData.phase) * 0.3;
      }

      updateCameraDirector(ctx.camera, t, cameraSchedule, watt.root.position, props);
    },
    [cameraSchedule, surgeSec, gagSec]
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
      <ChapterCard chapterNumber={3} title={title} />
      <TelemetryHUD words={words} side="right" widgets={hudWidgets} />
      <KineticCaptions words={words} fallbackLine="Mile-high megatsunamis surge toward the poles." />
    </PS1Stage>
  );
};
