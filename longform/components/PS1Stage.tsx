import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { applyPS1Material } from '../three/ps1-shader';

export const PS1_INTERNAL_WIDTH = 1920;
export const PS1_INTERNAL_HEIGHT = 1080;

export const DAYLIGHT_RULES = {
  MIN_HEMISPHERE_INTENSITY: 1.4,
  MIN_MEAN_BRIGHTNESS: 55,
  MAX_CRT_OVERLAY_OPACITY: 0.25,
} as const;

export interface PS1SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  hemiLight: THREE.HemisphereLight;
  keyLight: THREE.DirectionalLight;
  rimLight: THREE.DirectionalLight;
  ps1: <T extends THREE.Material>(mat: T) => T;
}

export interface PS1StageProps {
  skyColor?: string;
  fogColor?: string;
  hemisphereIntensity?: number;
  crtOpacity?: number;
  onBuildScene: (ctx: PS1SceneContext) => void;
  onUpdateFrame: (ctx: PS1SceneContext, t: number, frame: number, durationSec: number) => void;
  children?: React.ReactNode;
}

export const PS1Stage: React.FC<PS1StageProps> = ({
  skyColor = '#4f86d8',
  fogColor = '#6ca0e8',
  hemisphereIntensity = 1.55,
  crtOpacity = 0.18,
  onBuildScene,
  onUpdateFrame,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    ctx: PS1SceneContext;
  } | null>(null);

  // Enforce bright PS1 daylight rules at runtime
  const safeHemiIntensity = Math.max(DAYLIGHT_RULES.MIN_HEMISPHERE_INTENSITY, hemisphereIntensity);
  const safeCrtOpacity = Math.min(DAYLIGHT_RULES.MAX_CRT_OVERLAY_OPACITY, Math.max(0, crtOpacity));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(PS1_INTERNAL_WIDTH, PS1_INTERNAL_HEIGHT, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(skyColor);
    scene.fog = new THREE.FogExp2(fogColor, 0.022);

    const camera = new THREE.PerspectiveCamera(48, PS1_INTERNAL_WIDTH / PS1_INTERNAL_HEIGHT, 0.1, 140);
    camera.position.set(0, 1.55, 4.4);
    camera.lookAt(0, 1.0, 0);

    const hemiLight = new THREE.HemisphereLight(0xf4f8ff, 0x526180, safeHemiIntensity);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff6e5, 2.5);
    keyLight.position.set(4.5, 7.5, 5.0);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x80c7ff, 1.7);
    rimLight.position.set(-4.0, 3.5, -4.5);
    scene.add(rimLight);

    const ps1 = <T extends THREE.Material>(mat: T): T =>
      applyPS1Material(mat, { disableSnap: true, colorLevels: 63 });

    const ctx: PS1SceneContext = { scene, camera, hemiLight, keyLight, rimLight, ps1 };
    onBuildScene(ctx);
    stateRef.current = { renderer, ctx };

    return () => {
      renderer.dispose();
      stateRef.current = null;
    };
  }, [skyColor, fogColor, safeHemiIntensity]);

  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    // Clamp in case chapter logic modifies light dynamically
    st.ctx.hemiLight.intensity = Math.max(DAYLIGHT_RULES.MIN_HEMISPHERE_INTENSITY, st.ctx.hemiLight.intensity);
    const t = frame / fps;
    const durationSec = durationInFrames / fps;
    onUpdateFrame(st.ctx, t, frame, durationSec);
    st.renderer.render(st.ctx.scene, st.ctx.camera);
  }, [frame, fps, durationInFrames, onUpdateFrame]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: skyColor,
      }}
    >
      <canvas
        ref={canvasRef}
        width={PS1_INTERNAL_WIDTH}
        height={PS1_INTERNAL_HEIGHT}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
      <div
        id="crt-overlay"
        data-max-opacity={DAYLIGHT_RULES.MAX_CRT_OVERLAY_OPACITY}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: safeCrtOpacity,
          background:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 3px), radial-gradient(circle at 50% 50%, rgba(255,255,255,0) 68%, rgba(16,24,48,0.28) 100%)',
        }}
      />
      {children}
    </div>
  );
};
