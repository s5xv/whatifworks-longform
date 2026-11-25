import React, { useEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { Camera2DBeat, Camera2DState, computeCamera2DState } from './camera2D';

export const STAGE2D_WIDTH = 1920;
export const STAGE2D_HEIGHT = 1080;
export const STAGE2D_FLOOR_Y = 860;

export interface Stage2DProps {
  skyTop?: string;
  skyBottom?: string;
  horizonColor?: string;
  floorColor?: string;
  floorLineColor?: string;
  cameraSchedule?: Camera2DBeat[];
  onDrawBackground?: (
    ctx: CanvasRenderingContext2D,
    t: number,
    cam: Camera2DState
  ) => void;
  onDrawScene: (
    ctx: CanvasRenderingContext2D,
    t: number,
    frame: number,
    durationSec: number,
    cam: Camera2DState
  ) => void;
  children?: React.ReactNode;
}

export const Stage2D: React.FC<Stage2DProps> = ({
  skyTop = '#5da2e8',
  skyBottom = '#b7dcff',
  horizonColor = '#7cb3ea',
  floorColor = '#e6eef8',
  floorLineColor = '#4a6080',
  cameraSchedule = [],
  onDrawBackground,
  onDrawScene,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const t = frame / fps;
    const durationSec = durationInFrames / fps;
    const cam = computeCamera2DState(t, cameraSchedule);

    ctx.save();
    ctx.clearRect(0, 0, STAGE2D_WIDTH, STAGE2D_HEIGHT);

    // 1. Bright sky gradient (never dark/crushed)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, STAGE2D_FLOOR_Y);
    skyGrad.addColorStop(0, skyTop);
    skyGrad.addColorStop(1, skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, STAGE2D_WIDTH, STAGE2D_HEIGHT);

    // 2. Subtle parallax clouds & distant horizon hills
    ctx.save();
    ctx.translate(cam.tx * 0.25, cam.ty * 0.25);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 440 + t * (14 + i * 3)) % 2300) - 180;
      const cy = 140 + (i % 3) * 85;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 110, 36, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - 55, cy + 10, 68, 28, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 60, cy + 12, 72, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Parallax hills
    ctx.fillStyle = horizonColor;
    ctx.beginPath();
    ctx.moveTo(-200, STAGE2D_FLOOR_Y);
    for (let x = -200; x <= 2120; x += 240) {
      const h = 48 + Math.sin(x * 0.004) * 34 + Math.cos(x * 0.009) * 18;
      ctx.quadraticCurveTo(x + 120, STAGE2D_FLOOR_Y - h * 1.4, x + 240, STAGE2D_FLOOR_Y - h * 0.4);
    }
    ctx.lineTo(2120, STAGE2D_FLOOR_Y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (onDrawBackground) {
      onDrawBackground(ctx, t, cam);
    }

    // 3. Apply 2D Camera Transform around center (960, 540)
    ctx.save();
    ctx.translate(960 + cam.tx + cam.shakeX, 540 + cam.ty + cam.shakeY);
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(-960, -540);

    // Ground plane
    ctx.fillStyle = floorColor;
    ctx.fillRect(-400, STAGE2D_FLOOR_Y, STAGE2D_WIDTH + 800, 500);
    ctx.beginPath();
    ctx.moveTo(-400, STAGE2D_FLOOR_Y);
    ctx.lineTo(STAGE2D_WIDTH + 400, STAGE2D_FLOOR_Y);
    ctx.lineWidth = 4;
    ctx.strokeStyle = floorLineColor;
    ctx.stroke();

    // 4. Chapter-specific 2D vector diagrams, props, and Watt2D
    onDrawScene(ctx, t, frame, durationSec, cam);

    ctx.restore();
    ctx.restore();
  }, [
    frame,
    fps,
    durationInFrames,
    skyTop,
    skyBottom,
    horizonColor,
    floorColor,
    floorLineColor,
    cameraSchedule,
    onDrawBackground,
    onDrawScene,
  ]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: skyTop,
      }}
    >
      <canvas
        ref={canvasRef}
        width={STAGE2D_WIDTH}
        height={STAGE2D_HEIGHT}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
      {/* Subtle soft framing vignette (<= 0.12, never crushes pixels) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.12,
          background:
            'radial-gradient(circle at 50% 50%, rgba(255,255,255,0) 70%, rgba(18,28,54,0.45) 100%)',
        }}
      />
      {children}
    </div>
  );
};
