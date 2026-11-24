import React, { useCallback, useRef } from 'react';
import * as THREE from 'three';
import { Audio, staticFile } from 'remotion';
import { PS1Stage, PS1SceneContext } from '../components/PS1Stage';
import { KineticCaptions } from '../components/KineticCaptions';
import { useChapterWords } from '../components/useChapterWords';
import { createWatt, WattInstance } from '../three/watt-model';
import { enforceForegroundClearance, MIN_FOREGROUND_CLEARANCE } from '../three/clearance';
import { ChapterComponentProps } from './index';

export const Chapter02: React.FC<ChapterComponentProps> = ({
  title = 'Chapter 2',
  skyColor = '#3c6cb8',
  fogColor = '#5888d4',
  audioPath,
  wordsPath,
  words: wordsProp = [],
}) => {
  const loadedWords = useChapterWords(wordsPath);
  const words = wordsProp.length > 0 ? wordsProp : loadedWords;

  const objectsRef = useRef<{
    watt: WattInstance;
    debris: THREE.Mesh[];
    wattTarget: THREE.Vector3;
    scratchWorld: THREE.Vector3;
  } | null>(null);

  const onBuildScene = useCallback((ctx: PS1SceneContext) => {
    const { scene, ps1 } = ctx;

    const platformMat = ps1(new THREE.MeshLambertMaterial({ color: 0x8baad9, flatShading: true }));
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.0, 0.4, 12), platformMat);
    platform.position.y = -0.2;
    scene.add(platform);

    const watt = createWatt({ ps1Shader: ps1 });
    watt.setPosition(0, 0, 0);
    scene.add(watt.root);

    // Orbiting low-poly debris staged behind/around Watt with strict foreground clearance
    const debris: THREE.Mesh[] = [];
    const rockMat = ps1(new THREE.MeshLambertMaterial({ color: 0xc2d4ee, flatShading: true }));
    const accentMat = ps1(new THREE.MeshLambertMaterial({ color: 0x80c7ff, flatShading: true, emissive: 0x1a3e6b }));
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.24 + (i % 3) * 0.08, 0),
        i % 4 === 0 ? accentMat : rockMat
      );
      const ang = (i / 16) * Math.PI * 2;
      const rad = 4.4 + (i % 2) * 0.9;
      m.userData.baseAngle = ang;
      m.userData.radius = rad;
      m.userData.baseY = 1.4 + Math.sin(ang * 2) * 0.65;
      scene.add(m);
      debris.push(m);
    }

    objectsRef.current = {
      watt,
      debris,
      wattTarget: new THREE.Vector3(0, 1.0, 0),
      scratchWorld: new THREE.Vector3(),
    };
  }, []);

  const onUpdateFrame = useCallback((ctx: PS1SceneContext, t: number) => {
    const objs = objectsRef.current;
    if (!objs) return;
    const { watt, debris, wattTarget } = objs;

    if (t < 25.0) {
      watt.setFace('scared');
      watt.panic(t);
    } else if (t < 55.0) {
      watt.setFace('idea');
      watt.setIdea(1.0);
      watt.setPose('powerup', t);
    } else {
      watt.setFace('deadpan');
      watt.setIdea(0);
      watt.setPose('deadpan', t);
    }

    const shotIdx = Math.floor(t / 5.0) % 3;
    if (shotIdx === 0) {
      ctx.camera.position.set(0, 1.6, 4.6);
      ctx.camera.lookAt(0, 1.0, 0);
    } else if (shotIdx === 1) {
      ctx.camera.position.set(-2.6, 2.0, 3.8);
      ctx.camera.lookAt(0, 1.0, 0);
    } else {
      ctx.camera.position.set(2.5, 1.35, 3.7);
      ctx.camera.lookAt(0, 1.05, 0);
    }

    wattTarget.set(watt.root.position.x, watt.root.position.y + 1.05, watt.root.position.z);

    for (const m of debris) {
      const ang = m.userData.baseAngle + t * 0.35;
      const rad = m.userData.radius;
      // Bias ring z slightly behind Watt (-1.2) and enforce >= 1.3u foreground/camera clearance
      m.position.set(Math.cos(ang) * rad, m.userData.baseY, Math.sin(ang) * rad - 1.2);
      enforceForegroundClearance(m.position, ctx.camera.position, wattTarget, MIN_FOREGROUND_CLEARANCE);
      m.rotation.y = t * 0.6;
    }
  }, []);

  return (
    <PS1Stage
      skyColor={skyColor}
      fogColor={fogColor}
      hemisphereIntensity={1.5}
      crtOpacity={0.20}
      onBuildScene={onBuildScene}
      onUpdateFrame={onUpdateFrame}
    >
      {audioPath ? <Audio src={staticFile(audioPath)} /> : null}
      <div
        style={{
          position: 'absolute',
          top: 32,
          left: 42,
          padding: '8px 16px',
          borderRadius: 8,
          backgroundColor: 'rgba(14, 24, 48, 0.55)',
          color: '#80C7FF',
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '0.04em',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {title}
      </div>
      <KineticCaptions words={words} fallbackLine="Meanwhile, the entire atmosphere is escaping." />
    </PS1Stage>
  );
};
