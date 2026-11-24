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

export const Chapter04: React.FC<ChapterComponentProps> = ({
  title = 'Chapter 4: Six-Month Days & Scorching Heat',
  skyColor = '#e09f4a',
  fogColor = '#f0bd73',
  audioPath,
  wordsPath,
  words: wordsProp = [],
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const durationSec = durationInFrames / fps;
  const loadedWords = useChapterWords(wordsPath);
  const words = wordsProp.length > 0 ? wordsProp : loadedWords;

  const heatSec = useMemo(() => cueAt(words, 'six-month', 18.0), [words]);
  const solarSec = useMemo(() => cueAt(words, 'solar', Math.max(38, durationSec - 10)), [words, durationSec]);

  const cameraSchedule = useMemo(
    () =>
      createCameraSchedule(
        durationSec,
        [
          cueCameraAt(words, 'thermostat', 'wide', 7.5, { fallbackStartSec: 0 }),
          cueCameraAt(words, 'midday', 'dollyIn', 8.0, { fallbackStartSec: 8.0 }),
          cueCameraAt(words, 'six-month', 'orbit', 8.0, { fallbackStartSec: 18.0 }),
          cueCameraAt(words, 'amber', 'impactShake', 6.5, { fallbackStartSec: 28.0, intensity: 1.05 }),
          cueCameraAt(words, 'solar', 'closeup', 8.5, { fallbackStartSec: Math.max(38, durationSec - 10) }),
        ],
        7.5
      ),
    [durationSec, words]
  );

  const sfxCues = useMemo(
    () => [
      buildSfxCue(words, 'sun', 'chime', { fallbackSec: 6.0, volume: 0.55 }),
      buildSfxCue(words, 'six-month', 'alarm', { fallbackSec: 18.0, volume: 0.52 }),
      buildSfxCue(words, 'dust', 'whoosh', { fallbackSec: 27.0, volume: 0.6 }),
      buildSfxCue(words, 'solar', 'impact', { fallbackSec: Math.max(38, durationSec - 10), volume: 0.68 }),
    ],
    [words, durationSec]
  );

  const hudWidgets = useMemo<TelemetryWidgetSpec[]>(
    () => [
      {
        id: 'temp',
        kind: 'gauge',
        label: 'Surface Temp',
        unit: '°F',
        min: 50,
        max: 165,
        decimals: 0,
        triggerSec: 0.5,
        keyframes: [
          { timeSec: 0.5, value: 72, severity: 'normal' },
          { word: 'six-month', timeSec: 18.0, value: 138, severity: 'warn' },
          { word: 'amber', timeSec: 30.0, value: 156, severity: 'critical' },
        ],
      },
      {
        id: 'daylight',
        kind: 'counter',
        label: 'Daylight Lock',
        unit: 'hr',
        min: 0,
        max: 4380,
        decimals: 0,
        triggerSec: 2.0,
        keyframes: [
          { timeSec: 2.0, value: 12, severity: 'normal' },
          { word: 'six-month', timeSec: 20.0, value: 4380, severity: 'critical' },
        ],
      },
      {
        id: 'solar',
        kind: 'badge',
        label: 'Solar Load',
        badgeText: 'EXTREME',
        severity: 'critical',
        triggerSec: 4.0,
      },
    ],
    []
  );

  const objectsRef = useRef<{
    watt: WattInstance;
    sunDisc: THREE.Mesh;
    solarPanel: THREE.Group;
    dustProps: THREE.Object3D[];
  } | null>(null);

  const onBuildScene = useCallback((ctx: PS1SceneContext) => {
    const { scene, ps1 } = ctx;

    const sandMat = ps1(new THREE.MeshLambertMaterial({ color: 0xd99b52, flatShading: true }));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60, 14, 14), sandMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const mesaMat = ps1(new THREE.MeshLambertMaterial({ color: 0xb87035, flatShading: true }));
    for (let i = 0; i < 6; i++) {
      const mesa = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 2.4 + (i % 3) * 1.1, 7), mesaMat);
      mesa.position.set(-10 + i * 4.2, 1.2, -9.0 - (i % 2) * 3.0);
      scene.add(mesa);
    }

    const sunMat = ps1(new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
    const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(3.2, 16), sunMat);
    sunDisc.position.set(2.5, 6.2, -22);
    scene.add(sunDisc);

    const watt = createWatt({ ps1Shader: ps1 });
    watt.setPosition(0, 0, 0);
    scene.add(watt.root);

    const solarPanel = new THREE.Group();
    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 1.0, 6),
      ps1(new THREE.MeshLambertMaterial({ color: 0x607d8b, flatShading: true }))
    );
    stand.position.y = 0.5;
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.08, 0.8),
      ps1(new THREE.MeshLambertMaterial({ color: 0x1e3a8a, emissive: 0x0d2152, flatShading: true }))
    );
    panel.position.y = 1.02;
    panel.rotation.x = 0.35;
    solarPanel.add(stand, panel);
    solarPanel.position.set(-1.9, 0, -1.5);
    scene.add(solarPanel);

    const dustProps: THREE.Object3D[] = [solarPanel];
    const dustMat = ps1(new THREE.MeshLambertMaterial({ color: 0xf2c679, flatShading: true }));
    for (let i = 0; i < 10; i++) {
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32 + (i % 3) * 0.12, 0), dustMat);
      puff.userData.baseX = -12 + i * 2.5;
      puff.userData.baseY = 0.7 + (i % 3) * 0.55;
      puff.userData.baseZ = -2.2 - (i % 3) * 1.2;
      puff.userData.speed = 4.2 + (i % 4) * 1.1;
      puff.position.set(puff.userData.baseX, puff.userData.baseY, puff.userData.baseZ);
      scene.add(puff);
      dustProps.push(puff);
    }

    objectsRef.current = { watt, sunDisc, solarPanel, dustProps };
  }, []);

  const onUpdateFrame = useCallback(
    (ctx: PS1SceneContext, t: number) => {
      const objs = objectsRef.current;
      if (!objs) return;
      const { watt, sunDisc, solarPanel, dustProps } = objs;

      if (t < heatSec) {
        watt.setFace('confused');
        watt.idle(t);
      } else if (t < solarSec) {
        watt.setFace('scared');
        watt.panic(t);
      } else {
        watt.setFace('deadpan');
        watt.setPose('deadpan', t);
      }

      const pulse = 1 + Math.sin(t * 2.5) * 0.05;
      sunDisc.scale.set(pulse, pulse, 1);

      if (t > solarSec + 2.0) {
        const dt = t - (solarSec + 2.0);
        solarPanel.position.set(-1.9 + dt * 6.5, dt * 1.2, -1.5);
        solarPanel.rotation.z = -dt * 3.5;
      } else {
        solarPanel.position.set(-1.9, 0, -1.5);
        solarPanel.rotation.z = 0;
      }

      for (let i = 1; i < dustProps.length; i++) {
        const d = dustProps[i];
        const wx = (((d.userData.baseX + t * d.userData.speed) + 14) % 28) - 14;
        d.position.set(wx, d.userData.baseY + Math.sin(t * 3 + i) * 0.25, d.userData.baseZ);
        d.rotation.y = t * 1.4;
      }

      updateCameraDirector(ctx.camera, t, cameraSchedule, watt.root.position, dustProps);
    },
    [cameraSchedule, heatSec, solarSec]
  );

  return (
    <PS1Stage
      skyColor={skyColor}
      fogColor={fogColor}
      hemisphereIntensity={1.65}
      crtOpacity={0.16}
      onBuildScene={onBuildScene}
      onUpdateFrame={onUpdateFrame}
    >
      <AudioTrack audioPath={audioPath} words={words} sfxCues={sfxCues} />
      <ChapterCard chapterNumber={4} title={title} />
      <TelemetryHUD words={words} side="left" widgets={hudWidgets} />
      <KineticCaptions words={words} fallbackLine="Locked midday heat spikes surface temperatures." />
    </PS1Stage>
  );
};
