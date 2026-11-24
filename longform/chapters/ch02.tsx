import React, { useCallback, useRef } from 'react';
import * as THREE from 'three';
import { PS1Stage, PS1SceneContext } from '../components/PS1Stage';
import { KineticCaptions, WordTiming } from '../components/KineticCaptions';
import { createWatt, WattInstance } from '../three/watt-model';

export interface Chapter02Props {
  title?: string;
  skyColor?: string;
  fogColor?: string;
  words?: WordTiming[];
}

export const Chapter02: React.FC<Chapter02Props> = ({
  title = 'Chapter 2',
  skyColor = '#3c6cb8',
  fogColor = '#5888d4',
  words = [],
}) => {
  const objectsRef = useRef<{
    watt: WattInstance;
    ringGroup: THREE.Group;
  } | null>(null);

  const onBuildScene = useCallback((ctx: PS1SceneContext) => {
    const { scene, ps1 } = ctx;

    // Bright high-altitude platform
    const platformMat = ps1(new THREE.MeshLambertMaterial({ color: 0x8baad9, flatShading: true }));
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.0, 0.4, 12), platformMat);
    platform.position.y = -0.2;
    scene.add(platform);

    const watt = createWatt({ ps1Shader: ps1 });
    watt.setPosition(0, 0, 0);
    scene.add(watt.root);

    // Orbiting low-poly debris ring
    const ringGroup = new THREE.Group();
    const rockMat = ps1(new THREE.MeshLambertMaterial({ color: 0xc2d4ee, flatShading: true }));
    const accentMat = ps1(new THREE.MeshLambertMaterial({ color: 0x80c7ff, flatShading: true, emissive: 0x1a3e6b }));
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.24 + (i % 3) * 0.1, 0),
        i % 4 === 0 ? accentMat : rockMat
      );
      const ang = (i / 16) * Math.PI * 2;
      const rad = 4.2 + (i % 2) * 0.9;
      m.position.set(Math.cos(ang) * rad, 1.2 + Math.sin(ang * 2) * 0.7, Math.sin(ang) * rad);
      ringGroup.add(m);
    }
    scene.add(ringGroup);

    objectsRef.current = { watt, ringGroup };
  }, []);

  const onUpdateFrame = useCallback((ctx: PS1SceneContext, t: number) => {
    const objs = objectsRef.current;
    if (!objs) return;
    const { watt, ringGroup } = objs;

    ringGroup.rotation.y = t * 0.35;

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
