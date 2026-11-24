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

export const Chapter01: React.FC<ChapterComponentProps> = ({
  title = 'Chapter 1: The Instant Brake',
  skyColor = '#5da2e8',
  fogColor = '#84bcf2',
  audioPath,
  wordsPath,
  words: wordsProp = [],
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const durationSec = durationInFrames / fps;
  const loadedWords = useChapterWords(wordsPath);
  const words = wordsProp.length > 0 ? wordsProp : loadedWords;

  const stopSec = useMemo(() => cueAt(words, 'stopped', 2.0), [words]);
  const poleSec = useMemo(() => cueAt(words, 'North', Math.max(40, durationSec - 12)), [words, durationSec]);

  const cameraSchedule = useMemo(
    () =>
      createCameraSchedule(
        durationSec,
        [
          cueCameraAt(words, 'suddenly', 'wide', 7.0, { fallbackStartSec: 0 }),
          cueCameraAt(words, 'equator', 'dollyIn', 8.0, { fallbackStartSec: 8.0 }),
          cueCameraAt(words, 'inertia', 'orbit', 8.0, { fallbackStartSec: 18.0 }),
          cueCameraAt(words, 'bedrock', 'impactShake', 6.5, { fallbackStartSec: 28.0, intensity: 1.15 }),
          cueCameraAt(words, 'North', 'closeup', 9.0, { fallbackStartSec: Math.max(38, durationSec - 12) }),
        ],
        8.0
      ),
    [durationSec, words]
  );

  const sfxCues = useMemo(
    () => [
      buildSfxCue(words, 'stopped', 'whoosh', { fallbackSec: 2.0, volume: 0.6 }),
      buildSfxCue(words, 'bedrock', 'impact', { fallbackSec: 28.0, volume: 0.72 }),
      buildSfxCue(words, 'North', 'chime', { fallbackSec: Math.max(38, durationSec - 12), volume: 0.55 }),
    ],
    [words, durationSec]
  );

  const hudWidgets = useMemo<TelemetryWidgetSpec[]>(
    () => [
      {
        id: 'rotation',
        kind: 'gauge',
        label: 'Earth Spin',
        unit: 'mph',
        min: 0,
        max: 1040,
        decimals: 0,
        triggerSec: 0.3,
        keyframes: [
          { timeSec: 0.3, value: 1040, severity: 'normal' },
          { word: 'stopped', timeSec: 2.2, value: 0, severity: 'critical' },
          { timeSec: durationSec - 1, value: 0, severity: 'critical' },
        ],
      },
      {
        id: 'inertia',
        kind: 'counter',
        label: 'Your Velocity',
        unit: 'mph',
        min: 0,
        max: 1100,
        decimals: 0,
        triggerSec: 1.0,
        keyframes: [
          { timeSec: 1.0, value: 0, severity: 'normal' },
          { word: 'supersonic', timeSec: 4.5, value: 1040, severity: 'critical' },
          { timeSec: durationSec - 1, value: 1040, severity: 'critical' },
        ],
      },
      {
        id: 'anchor',
        kind: 'badge',
        label: 'Bedrock Lock',
        badgeText: 'UNBOLTED',
        severity: 'warn',
        triggerSec: 2.5,
      },
    ],
    [durationSec]
  );

  const objectsRef = useRef<{
    watt: WattInstance;
    movingProps: THREE.Object3D[];
    mug: THREE.Group;
    signPost: THREE.Group;
  } | null>(null);

  const onBuildScene = useCallback((ctx: PS1SceneContext) => {
    const { scene, ps1 } = ctx;

    // Bright coastal city plaza: grass strip, concrete boardwalk, distant ocean
    const grassMat = ps1(new THREE.MeshLambertMaterial({ color: 0x76a85c, flatShading: true }));
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(50, 50, 14, 14), grassMat);
    grass.rotation.x = -Math.PI / 2;
    scene.add(grass);

    const roadMat = ps1(new THREE.MeshLambertMaterial({ color: 0x9aa6b8, flatShading: true }));
    const road = new THREE.Mesh(new THREE.BoxGeometry(50, 0.08, 6.5), roadMat);
    road.position.set(0, 0.02, 0.2);
    scene.add(road);

    const oceanMat = ps1(new THREE.MeshLambertMaterial({ color: 0x3a8be0, flatShading: true }));
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(60, 26), oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, 0.01, -18);
    scene.add(ocean);

    // Distant low-poly city skyline along z = -6.5 .. -10
    const bldgColors = [0xcad6e8, 0xb0c2db, 0xdce4f0, 0xa2b6d1];
    for (let i = 0; i < 12; i++) {
      const w = 1.4 + (i % 3) * 0.5;
      const h = 2.6 + ((i * 7) % 5) * 1.1;
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, 1.6),
        ps1(new THREE.MeshLambertMaterial({ color: bldgColors[i % bldgColors.length], flatShading: true }))
      );
      b.position.set(-14 + i * 2.55, h / 2, -6.5 - (i % 2) * 2.2);
      scene.add(b);
    }

    const watt = createWatt({ ps1Shader: ps1 });
    watt.setPosition(0, 0, 0);
    scene.add(watt.root);

    // Bolted Equator sign post (stays anchored to bedrock)
    const signPost = new THREE.Group();
    const poleMat = ps1(new THREE.MeshLambertMaterial({ color: 0x5c6675, flatShading: true }));
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 6), poleMat);
    pole.position.y = 1.1;
    signPost.add(pole);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.48, 0.08),
      ps1(new THREE.MeshLambertMaterial({ color: 0xffca28, flatShading: true }))
    );
    board.position.set(0, 2.0, 0);
    signPost.add(board);
    signPost.position.set(-2.1, 0, -1.6);
    scene.add(signPost);

    // Comedy gag: oversized coffee mug that launches east
    const mug = new THREE.Group();
    const mugBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.2, 0.36, 8),
      ps1(new THREE.MeshLambertMaterial({ color: 0xfff5e6, flatShading: true }))
    );
    const coffeeTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.04, 8),
      ps1(new THREE.MeshLambertMaterial({ color: 0x4e342e, flatShading: true }))
    );
    coffeeTop.position.y = 0.17;
    mug.add(mugBody, coffeeTop);
    mug.position.set(1.1, 1.05, -0.4);
    mug.userData.baseX = 1.1;
    mug.userData.baseY = 1.05;
    mug.userData.baseZ = -0.4;
    scene.add(mug);

    // Unbolted street props (benches, crates, cones, lamp) staged behind z <= -1.2
    const movingProps: THREE.Object3D[] = [mug];
    const propColors = [0xff8a65, 0x4fc3f7, 0xffd54f, 0xaed581, 0xe57373];
    for (let i = 0; i < 8; i++) {
      const size = 0.42 + (i % 3) * 0.15;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(size * 1.4, size, size),
        ps1(new THREE.MeshLambertMaterial({ color: propColors[i % propColors.length], flatShading: true }))
      );
      const bx = -7.0 + i * 2.1;
      const bz = -1.6 - (i % 3) * 1.1;
      box.position.set(bx, size / 2, bz);
      box.userData.baseX = bx;
      box.userData.baseY = size / 2;
      box.userData.baseZ = bz;
      box.userData.speed = 3.2 + (i % 4) * 1.1;
      box.userData.phase = i * 0.8;
      scene.add(box);
      movingProps.push(box);
    }

    objectsRef.current = { watt, movingProps, mug, signPost };
  }, []);

  const onUpdateFrame = useCallback(
    (ctx: PS1SceneContext, t: number) => {
      const objs = objectsRef.current;
      if (!objs) return;
      const { watt, movingProps, mug } = objs;

      if (t < stopSec) {
        watt.setFace('smug');
        watt.setIdea(0);
        watt.setPosition(0, 0, 0);
        watt.idle(t);
      } else if (t < poleSec) {
        const dt = t - stopSec;
        watt.setFace(dt < 6 ? 'scared' : 'confused');
        const leanX = Math.min(0.65, dt * 0.25) * Math.sin(t * 2.2) * 0.25 + 0.25;
        watt.setPosition(leanX, 0, Math.abs(Math.sin(t * 5.0)) * 0.18);
        watt.panic(t);
      } else {
        watt.setFace('deadpan');
        watt.setPosition(0, 0, 0);
        watt.root.rotation.y = (t - poleSec) * 0.9;
        watt.setPose('deadpan', t);
      }

      const launchDt = Math.max(0, t - stopSec);
      for (const p of movingProps) {
        if (p === mug) {
          const mx = mug.userData.baseX + launchDt * 7.5;
          mug.position.set(
            ((mx + 12) % 24) - 12,
            mug.userData.baseY + Math.sin(t * 6) * 0.15,
            mug.userData.baseZ
          );
          mug.rotation.z = -launchDt * 4.5;
        } else {
          const spd = p.userData.speed || 3.5;
          const rawX = p.userData.baseX + launchDt * spd;
          const wrappedX = ((rawX + 12) % 24) - 12;
          p.position.set(
            wrappedX,
            p.userData.baseY + (launchDt > 0 ? Math.abs(Math.sin(t * 3 + p.userData.phase)) * 0.8 : 0),
            p.userData.baseZ
          );
          p.rotation.z = -launchDt * 2.2;
        }
      }

      updateCameraDirector(ctx.camera, t, cameraSchedule, watt.root.position, movingProps);
    },
    [cameraSchedule, stopSec, poleSec]
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
      <ChapterCard chapterNumber={1} title={title} />
      <TelemetryHUD words={words} side="right" widgets={hudWidgets} />
      <KineticCaptions words={words} fallbackLine="You would instantly fly east at 1,040 mph." />
    </PS1Stage>
  );
};
