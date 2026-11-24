import React, { useCallback, useRef } from 'react';
import * as THREE from 'three';
import { PS1Stage, PS1SceneContext } from '../components/PS1Stage';
import { KineticCaptions, WordTiming } from '../components/KineticCaptions';
import { createWatt, WattInstance } from '../three/watt-model';

export interface ChapterProps {
  title?: string;
  skyColor?: string;
  fogColor?: string;
  words?: WordTiming[];
}

export const Chapter01: React.FC<ChapterProps> = ({
  title = 'Chapter 1',
  skyColor = '#4f86d8',
  fogColor = '#6ca0e8',
  words = [],
}) => {
  const objectsRef = useRef<{
    watt: WattInstance;
    props: THREE.Mesh[];
  } | null>(null);

  const onBuildScene = useCallback((ctx: PS1SceneContext) => {
    const { scene, ps1 } = ctx;

    // Bright daylight PS1 ground plane & grid
    const floorMat = ps1(new THREE.MeshLambertMaterial({ color: 0x7398c8, flatShading: true }));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40, 16, 16), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const grid = new THREE.GridHelper(32, 24, 0xd8ebff, 0x9abbe8);
    grid.position.y = 0.01;
    scene.add(grid);

    // Watt protagonist grounded on floor
    const watt = createWatt({ ps1Shader: ps1 });
    watt.setPosition(0, 0, 0);
    scene.add(watt.root);

    // Floating low-poly crates & street props for gravity flip beat
    const colors = [0xffb74d, 0x64b5f6, 0x81c784, 0xe57373, 0xfff176];
    const props: THREE.Mesh[] = [];
    for (let i = 0; i < 10; i++) {
      const mat = ps1(new THREE.MeshLambertMaterial({ color: colors[i % colors.length], flatShading: true }));
      const size = 0.35 + (i % 3) * 0.18;
      const box = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
      const angle = (i / 10) * Math.PI * 2;
      const radius = 2.6 + (i % 2) * 1.1;
      box.position.set(Math.cos(angle) * radius, size / 2, Math.sin(angle) * radius - 0.6);
      box.userData.baseY = size / 2;
      box.userData.phase = i * 0.7;
      scene.add(box);
      props.push(box);
    }

    objectsRef.current = { watt, props };
  }, []);

  const onUpdateFrame = useCallback((ctx: PS1SceneContext, t: number) => {
    const objs = objectsRef.current;
    if (!objs) return;
    const { watt, props } = objs;

    // Beat progression inside Chapter 1 (0..65s)
    if (t < 4.0) {
      watt.setFace('smug');
      watt.setIdea(0);
      watt.idle(t);
    } else if (t < 15.0) {
      watt.setFace('idea');
      watt.setIdea(Math.min(1, (t - 4.0) * 2));
      watt.walk(t);
    } else if (t < 35.0) {
      watt.setFace('confused');
      watt.setIdea(0);
      const lift = Math.max(0, Math.sin((t - 15.0) * 0.5) * 0.65);
      watt.setPosition(Math.sin(t * 0.7) * 0.6, 0, lift);
      watt.bounce(t);
    } else {
      watt.setFace('scared');
      watt.setPosition(0, 0, 0.35 + Math.sin(t * 3.0) * 0.15);
      watt.panic(t);
    }

    // Float props upward after t = 10s
    const floatFactor = Math.max(0, Math.min(1, (t - 10) / 12));
    for (const p of props) {
      p.position.y = p.userData.baseY + floatFactor * (1.8 + Math.sin(t * 1.4 + p.userData.phase) * 0.6);
      p.rotation.x = floatFactor * (t * 0.5 + p.userData.phase);
      p.rotation.y = floatFactor * (t * 0.7);
    }

    // Alternating 16:9 camera shots (maintains headroom & clear foreground)
    const shotIdx = Math.floor(t / 4.5) % 3;
    if (shotIdx === 0) {
      ctx.camera.position.set(Math.sin(t * 0.25) * 0.6, 1.55, 4.4);
      ctx.camera.lookAt(0, 1.0, 0);
    } else if (shotIdx === 1) {
      ctx.camera.position.set(2.4, 1.8, 3.6);
      ctx.camera.lookAt(0, 1.05, 0);
    } else {
      ctx.camera.position.set(-2.1, 1.2, 3.8);
      ctx.camera.lookAt(0, 1.1, 0);
    }
  }, []);

  return (
    <PS1Stage
      skyColor={skyColor}
      fogColor={fogColor}
      hemisphereIntensity={1.6}
      crtOpacity={0.18}
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
      <KineticCaptions words={words} fallbackLine="What if gravity flipped for 60 seconds?" />
    </PS1Stage>
  );
};
