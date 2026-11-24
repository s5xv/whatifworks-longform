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

export const Chapter02: React.FC<ChapterComponentProps> = ({
  title = 'Chapter 2: Supersonic Winds',
  skyColor = '#487fd1',
  fogColor = '#73a4e6',
  audioPath,
  wordsPath,
  words: wordsProp = [],
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const durationSec = durationInFrames / fps;
  const loadedWords = useChapterWords(wordsPath);
  const words = wordsProp.length > 0 ? wordsProp : loadedWords;

  const shockSec = useMemo(() => cueAt(words, 'supersonic', 16.0), [words]);
  const subwaySec = useMemo(() => cueAt(words, 'subway', Math.max(38, durationSec - 14)), [words, durationSec]);

  const cameraSchedule = useMemo(
    () =>
      createCameraSchedule(
        durationSec,
        [
          cueCameraAt(words, 'blender', 'wide', 7.0, { fallbackStartSec: 0 }),
          cueCameraAt(words, 'atmosphere', 'dollyIn', 8.0, { fallbackStartSec: 8.0 }),
          cueCameraAt(words, 'supersonic', 'impactShake', 7.0, { fallbackStartSec: 17.0, intensity: 1.2 }),
          cueCameraAt(words, 'firestorms', 'orbit', 8.5, { fallbackStartSec: 26.0 }),
          cueCameraAt(words, 'subway', 'closeup', 9.0, { fallbackStartSec: Math.max(38, durationSec - 14) }),
        ],
        7.5
      ),
    [durationSec, words]
  );

  const sfxCues = useMemo(
    () => [
      buildSfxCue(words, 'atmosphere', 'alarm', { fallbackSec: 6.0, volume: 0.52 }),
      buildSfxCue(words, 'supersonic', 'whoosh', { fallbackSec: 16.0, volume: 0.65 }),
      buildSfxCue(words, 'cities', 'impact', { fallbackSec: 21.0, volume: 0.72 }),
      buildSfxCue(words, 'sonic', 'impact', { fallbackSec: Math.max(40, durationSec - 6), volume: 0.68 }),
    ],
    [words, durationSec]
  );

  const hudWidgets = useMemo<TelemetryWidgetSpec[]>(
    () => [
      {
        id: 'wind',
        kind: 'gauge',
        label: 'Wind Speed',
        unit: 'mph',
        min: 0,
        max: 1200,
        decimals: 0,
        triggerSec: 0.4,
        keyframes: [
          { timeSec: 0.4, value: 180, severity: 'warn' },
          { word: 'thousand', timeSec: 10.0, value: 1040, severity: 'critical' },
          { word: 'supersonic', timeSec: 18.0, value: 1125, severity: 'critical' },
        ],
      },
      {
        id: 'mach',
        kind: 'counter',
        label: 'Mach Factor',
        unit: 'M',
        min: 0,
        max: 1.6,
        decimals: 2,
        triggerSec: 1.5,
        keyframes: [
          { timeSec: 1.5, value: 0.24, severity: 'warn' },
          { word: 'sound', timeSec: 13.0, value: 1.36, severity: 'critical' },
        ],
      },
      {
        id: 'airspace',
        kind: 'badge',
        label: 'Airspace',
        badgeText: 'SUPERSONIC',
        severity: 'critical',
        triggerSec: 3.0,
      },
    ],
    []
  );

  const objectsRef = useRef<{
    watt: WattInstance;
    debris: THREE.Object3D[];
  } | null>(null);

  const onBuildScene = useCallback((ctx: PS1SceneContext) => {
    const { scene, ps1 } = ctx;

    const earthMat = ps1(new THREE.MeshLambertMaterial({ color: 0x7c876e, flatShading: true }));
    const earth = new THREE.Mesh(new THREE.PlaneGeometry(60, 60, 12, 12), earthMat);
    earth.rotation.x = -Math.PI / 2;
    scene.add(earth);

    const highwayMat = ps1(new THREE.MeshLambertMaterial({ color: 0x626b7a, flatShading: true }));
    const highway = new THREE.Mesh(new THREE.BoxGeometry(60, 0.1, 7.2), highwayMat);
    highway.position.set(0, 0.03, -0.5);
    scene.add(highway);

    const stripeMat = ps1(new THREE.MeshLambertMaterial({ color: 0xffd54f, flatShading: true }));
    for (let i = -8; i <= 8; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.18), stripeMat);
      stripe.position.set(i * 3.0, 0.04, -0.5);
      scene.add(stripe);
    }

    const watt = createWatt({ ps1Shader: ps1 });
    watt.setPosition(0, 0, 0);
    scene.add(watt.root);

    const debris: THREE.Object3D[] = [];
    const carColors = [0xef5350, 0x42a5f5, 0xffca28, 0x66bb6a, 0xff7043, 0xab47bc];
    for (let i = 0; i < 14; i++) {
      const isCar = i % 2 === 0;
      const group = new THREE.Group();
      const mat = ps1(new THREE.MeshLambertMaterial({ color: carColors[i % carColors.length], flatShading: true }));
      if (isCar) {
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.65), mat);
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.32, 0.56), mat);
        cabin.position.y = 0.34;
        group.add(body, cabin);
      } else {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.65, 0.65), mat);
        group.add(crate);
      }
      group.userData.baseX = -14 + i * 2.2;
      group.userData.baseY = 0.9 + (i % 4) * 0.65;
      group.userData.baseZ = -2.0 - (i % 4) * 1.3;
      group.userData.speed = 6.5 + (i % 5) * 1.8;
      group.userData.phase = i * 0.9;
      scene.add(group);
      debris.push(group);
    }

    objectsRef.current = { watt, debris };
  }, []);

  const onUpdateFrame = useCallback(
    (ctx: PS1SceneContext, t: number) => {
      const objs = objectsRef.current;
      if (!objs) return;
      const { watt, debris } = objs;

      if (t < shockSec) {
        watt.setFace('scared');
        watt.panic(t);
      } else if (t < subwaySec) {
        watt.setFace('scared');
        watt.setPosition(Math.sin(t * 6) * 0.15, 0, Math.abs(Math.sin(t * 7)) * 0.15);
        watt.panic(t);
      } else {
        watt.setFace('deadpan');
        watt.setPosition(0, 0, 0);
        watt.setPose('deadpan', t);
      }

      for (const d of debris) {
        const rawX = d.userData.baseX + t * d.userData.speed;
        const wx = ((rawX + 16) % 32) - 16;
        d.position.set(
          wx,
          d.userData.baseY + Math.sin(t * 2.5 + d.userData.phase) * 0.35,
          d.userData.baseZ
        );
        d.rotation.x = t * 1.8 + d.userData.phase;
        d.rotation.z = -t * 2.4;
      }

      updateCameraDirector(ctx.camera, t, cameraSchedule, watt.root.position, debris);
    },
    [cameraSchedule, shockSec, subwaySec]
  );

  return (
    <PS1Stage
      skyColor={skyColor}
      fogColor={fogColor}
      hemisphereIntensity={1.55}
      crtOpacity={0.18}
      onBuildScene={onBuildScene}
      onUpdateFrame={onUpdateFrame}
    >
      <AudioTrack audioPath={audioPath} words={words} sfxCues={sfxCues} />
      <ChapterCard chapterNumber={2} title={title} />
      <TelemetryHUD words={words} side="left" widgets={hudWidgets} />
      <KineticCaptions words={words} fallbackLine="1,000+ mph winds turn the sky into a blender." />
    </PS1Stage>
  );
};
