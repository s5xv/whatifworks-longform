import React, { useEffect, useRef } from 'react';

export const WATT_2D_PALETTE = {
  head: '#2878FF',
  headSh: '#1f63d6',
  ink: '#222633',
  eye: '#ffffff',
  pupil: '#111111',
  accent: '#80C7FF',
  body: '#2b3040',
} as const;

export type Watt2DPose = 'idle' | 'explain' | 'shocked' | 'flying' | 'deadpan';
export type Watt2DFaceName = 'neutral' | 'smug' | 'confused' | 'scared' | 'idea' | 'deadpan';
export type Watt2DOutfit = 'none' | 'astronaut' | 'scientist' | 'villain';

interface FaceSpec {
  browAng: number;
  browUp?: number;
  pupil: number;
  mouth: 'crook' | 'smirk' | 'wobble' | 'o' | 'grin' | 'flat';
  eyes?: 'wide' | 'half';
  look?: [number, number];
}

const WATT_FACES: Record<Watt2DFaceName, FaceSpec> = {
  neutral: { browAng: -0.12, pupil: 0.42, mouth: 'crook' },
  smug: { browAng: -0.28, pupil: 0.38, mouth: 'smirk', look: [0.3, 0.05] },
  confused: { browAng: 0.18, pupil: 0.5, mouth: 'wobble', look: [-0.35, 0] },
  scared: { browAng: 0.3, browUp: 0.6, pupil: 0.3, mouth: 'o', eyes: 'wide' },
  idea: { browAng: -0.35, browUp: 0.8, pupil: 0.45, mouth: 'grin' },
  deadpan: { browAng: 0, pupil: 0.4, mouth: 'flat', eyes: 'half' },
};

export interface DrawWatt2DOptions {
  x: number;
  y: number;
  s?: number;
  t?: number;
  pose?: Watt2DPose;
  face?: Watt2DFaceName;
  outfit?: Watt2DOutfit;
  flip?: 1 | -1;
  lean?: number;
  bob?: number;
  squash?: number;
  headTilt?: number;
  idea?: number;
  blink?: number;
  shadow?: boolean;
  shadowScale?: number;
  rimGlow?: boolean | string;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

function limbPts(
  x0: number,
  y0: number,
  side: number,
  a1: number,
  a2: number,
  l1: number,
  l2: number
): [[number, number], [number, number], [number, number], number] {
  const s1 = a1 * side;
  const s2 = (a1 + a2) * side;
  const x1 = x0 + Math.sin(s1) * l1;
  const y1 = y0 + Math.cos(s1) * l1;
  const x2 = x1 + Math.sin(s2) * l2;
  const y2 = y1 + Math.cos(s2) * l2;
  return [[x0, y0], [x1, y1], [x2, y2], s2];
}

function wattHeadPath(ctx: CanvasRenderingContext2D) {
  const cx = 0;
  const cy = -0.78;
  const rx = 0.205;
  const ry = 0.19;
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.92, cy + ry * 0.28);
  ctx.bezierCurveTo(cx - rx * 1.06, cy - ry * 0.55, cx - rx * 0.85, cy - ry * 1.02, cx - rx * 0.45, cy - ry * 1.0);
  ctx.bezierCurveTo(cx - rx * 0.34, cy - ry * 1.14, cx - rx * 0.2, cy - ry * 1.14, cx - rx * 0.12, cy - ry * 1.0);
  ctx.bezierCurveTo(cx + rx * 0.3, cy - ry * 1.06, cx + rx * 1.02, cy - ry * 0.62, cx + rx * 1.0, cy + ry * 0.02);
  ctx.bezierCurveTo(cx + rx * 0.98, cy + ry * 0.72, cx + rx * 0.5, cy + ry * 1.0, cx + rx * 0.12, cy + ry * 1.02);
  ctx.bezierCurveTo(cx - rx * 0.4, cy + ry * 1.04, cx - rx * 0.95, cy + ry * 0.6, cx - rx * 0.92, cy + ry * 0.28);
  ctx.closePath();
}

function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.28, y - r * 0.28);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x + r * 0.28, y + r * 0.28);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.28, y + r * 0.28);
  ctx.lineTo(x - r, y);
  ctx.lineTo(x - r * 0.28, y - r * 0.28);
  ctx.closePath();
  ctx.fillStyle = WATT_2D_PALETTE.accent;
  ctx.fill();
}

function resolvePose(pose: Watt2DPose, t: number) {
  switch (pose) {
    case 'explain':
      return {
        face: 'idea' as Watt2DFaceName,
        lean: Math.sin(t * 2.4) * 0.05,
        bob: Math.abs(Math.sin(t * 3.5)) * -0.025,
        headTilt: Math.sin(t * 2.2) * 0.07,
        legs: { L: [0.14, -0.05] as [number, number], R: [0.14, -0.05] as [number, number] },
        arms: {
          L: [0.45 + Math.sin(t * 4.0) * 0.12, -0.35] as [number, number],
          R: [1.55 + Math.sin(t * 5.2) * 0.25, -0.55] as [number, number],
        },
        idea: 1.0,
      };
    case 'shocked':
      return {
        face: 'scared' as Watt2DFaceName,
        lean: -0.09 + Math.sin(t * 28) * 0.03,
        bob: Math.sin(t * 24) * 0.015,
        headTilt: Math.sin(t * 20) * 0.08,
        legs: { L: [0.24, -0.18] as [number, number], R: [0.24, -0.18] as [number, number] },
        arms: {
          L: [2.4 + Math.sin(t * 18) * 0.35, -0.4] as [number, number],
          R: [2.4 + Math.cos(t * 18) * 0.35, -0.4] as [number, number],
        },
        idea: 0,
      };
    case 'flying':
      return {
        face: 'scared' as Watt2DFaceName,
        lean: 0.72 + Math.sin(t * 12) * 0.08,
        bob: Math.sin(t * 8) * 0.04,
        headTilt: -0.25,
        legs: {
          L: [-0.6 + Math.sin(t * 16) * 0.35, -0.3] as [number, number],
          R: [-0.3 + Math.cos(t * 16) * 0.35, -0.3] as [number, number],
        },
        arms: {
          L: [2.2 + Math.sin(t * 20) * 0.45, -0.25] as [number, number],
          R: [2.5 + Math.cos(t * 20) * 0.45, -0.25] as [number, number],
        },
        idea: 0,
      };
    case 'deadpan':
      return {
        face: 'deadpan' as Watt2DFaceName,
        lean: 0,
        bob: Math.sin(t * 1.8) * 0.008,
        headTilt: 0.03,
        legs: { L: [0.1, -0.04] as [number, number], R: [0.1, -0.04] as [number, number] },
        arms: { L: [0.25, -0.1] as [number, number], R: [0.25, -0.1] as [number, number] },
        idea: 0,
      };
    case 'idle':
    default:
      return {
        face: 'neutral' as Watt2DFaceName,
        lean: Math.sin(t * 1.5) * 0.02,
        bob: Math.sin(t * 2.6) * 0.012,
        headTilt: Math.sin(t * 1.3) * 0.03,
        legs: { L: [0.12, -0.05] as [number, number], R: [0.12, -0.05] as [number, number] },
        arms: { L: [0.35, -0.15] as [number, number], R: [0.35, -0.15] as [number, number] },
        idea: 0,
      };
  }
}

/**
 * Draws the exact 2D stick-figure Watt matching `stick-figure/engine/template/web/watt.js`.
 */
export function drawWatt2D(ctx: CanvasRenderingContext2D, opts: DrawWatt2DOptions): void {
  const t = opts.t ?? 0;
  const s = opts.s ?? 380;
  const flip = opts.flip ?? 1;
  const poseData = resolvePose(opts.pose ?? 'idle', t);
  const lean = opts.lean ?? poseData.lean;
  const bob = opts.bob ?? poseData.bob;
  const squash = opts.squash ?? 1;
  const headTilt = opts.headTilt ?? poseData.headTilt;
  const faceName = opts.face ?? poseData.face;
  const ideaPop = clamp(opts.idea ?? poseData.idea);

  // Automatic organic eye blink every ~3.4s
  const blinkCycle = t % 3.4;
  const autoBlink = blinkCycle > 3.24 ? Math.sin(((blinkCycle - 3.24) / 0.16) * Math.PI) : 0;
  const blink = clamp(opts.blink ?? autoBlink);

  const ink = WATT_2D_PALETTE.ink;
  const lw = 0.017;
  const limbW = 0.028;

  ctx.save();
  ctx.translate(opts.x, opts.y);

  // Ground contact shadow
  if (opts.shadow !== false) {
    ctx.save();
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.2 * (opts.shadowScale ?? 1), 0.035 * (opts.shadowScale ?? 1), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(40, 20, 30, 0.22)';
    ctx.fill();
    ctx.restore();
  }

  ctx.scale(s * flip, s * squash);
  ctx.rotate(lean);
  ctx.translate(0, bob);

  const hipY = -0.3;
  const shY = -0.535;
  const legP = {
    L: limbPts(-0.055, hipY, -1, poseData.legs.L[0], poseData.legs.L[1], 0.155, 0.155),
    R: limbPts(0.055, hipY, 1, poseData.legs.R[0], poseData.legs.R[1], 0.155, 0.155),
  };
  const handP = {
    L: limbPts(-0.1, shY, -1, poseData.arms.L[0], poseData.arms.L[1], 0.14, 0.13),
    R: limbPts(0.1, shY, 1, poseData.arms.R[0], poseData.arms.R[1], 0.14, 0.13),
  };

  // Optional rim glow behind body
  if (opts.rimGlow) {
    const rimCol = typeof opts.rimGlow === 'string' ? opts.rimGlow : WATT_2D_PALETTE.accent;
    ctx.save();
    ctx.lineWidth = limbW + 0.018;
    ctx.strokeStyle = rimCol;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const k of ['L', 'R'] as const) {
      const p = legP[k];
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      ctx.lineTo(p[1][0], p[1][1]);
      ctx.lineTo(p[2][0], p[2][1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Villain cape (flowing behind legs & torso)
  if (opts.outfit === 'villain') {
    const billow = Math.sin(t * 4.2) * 0.035;
    // Outer dark cape
    ctx.beginPath();
    ctx.moveTo(-0.11, -0.57);
    ctx.quadraticCurveTo(-0.28 - billow, -0.34, -0.34 - billow * 1.4, -0.04);
    ctx.quadraticCurveTo(0, 0.02 + Math.abs(billow) * 0.3, 0.28 + billow * 0.6, -0.05);
    ctx.quadraticCurveTo(0.22 + billow * 0.4, -0.34, 0.11, -0.57);
    ctx.closePath();
    ctx.fillStyle = '#1b1f2e';
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = ink;
    ctx.stroke();

    // Inner crimson lining peek on left edge
    ctx.beginPath();
    ctx.moveTo(-0.11, -0.57);
    ctx.quadraticCurveTo(-0.22 - billow * 0.7, -0.32, -0.26 - billow, -0.05);
    ctx.lineTo(-0.16, -0.08);
    ctx.quadraticCurveTo(-0.14, -0.32, -0.08, -0.56);
    ctx.closePath();
    ctx.fillStyle = '#c62828';
    ctx.fill();
  }

  // Legs + shoes
  for (const [k, side] of [['L', -1], ['R', 1]] as const) {
    const p = legP[k];
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    ctx.lineTo(p[1][0], p[1][1]);
    ctx.lineTo(p[2][0], p[2][1]);
    ctx.lineWidth = limbW;
    ctx.strokeStyle = ink;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(p[2][0] + side * 0.022, p[2][1] + 0.004, 0.042, 0.022, 0, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();
  }

  // Bean torso (#2b3040)
  const drawTorsoPath = () => {
    ctx.beginPath();
    ctx.roundRect(-0.115, -0.62, 0.23, 0.34, [0.1, 0.1, 0.12, 0.12]);
  };
  drawTorsoPath();
  ctx.fillStyle = WATT_2D_PALETTE.body;
  ctx.fill();
  ctx.save();
  drawTorsoPath();
  ctx.clip();
  const tg = ctx.createLinearGradient(-0.115, -0.6, 0.115, -0.3);
  tg.addColorStop(0, 'rgba(255,255,255,0.07)');
  tg.addColorStop(0.55, 'rgba(0,0,0,0)');
  tg.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = tg;
  ctx.fillRect(-0.13, -0.63, 0.26, 0.37);
  ctx.restore();
  drawTorsoPath();
  ctx.lineWidth = lw;
  ctx.strokeStyle = ink;
  ctx.stroke();

  // Scientist lab coat outfit option
  if (opts.outfit === 'scientist') {
    ctx.beginPath();
    ctx.roundRect(-0.125, -0.61, 0.25, 0.33, 0.04);
    ctx.fillStyle = '#f6f8fc';
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -0.61);
    ctx.lineTo(0, -0.28);
    ctx.stroke();
  }

  // Villain high collar & gold clasp
  if (opts.outfit === 'villain') {
    // Crimson/obsidian spiked collar behind neck
    ctx.beginPath();
    ctx.moveTo(-0.11, -0.56);
    ctx.lineTo(-0.19, -0.71);
    ctx.lineTo(-0.06, -0.62);
    ctx.lineTo(0.06, -0.62);
    ctx.lineTo(0.19, -0.71);
    ctx.lineTo(0.11, -0.56);
    ctx.closePath();
    ctx.fillStyle = '#c62828';
    ctx.fill();
    ctx.lineWidth = lw * 0.9;
    ctx.strokeStyle = ink;
    ctx.stroke();

    // Gold collar clasp
    ctx.beginPath();
    ctx.arc(0, -0.56, 0.026, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd54f';
    ctx.fill();
    ctx.lineWidth = 0.01;
    ctx.strokeStyle = ink;
    ctx.stroke();
  }

  // Arms + 2-finger hands
  for (const k of ['L', 'R'] as const) {
    const p = handP[k];
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    ctx.lineTo(p[1][0], p[1][1]);
    ctx.lineTo(p[2][0], p[2][1]);
    ctx.lineWidth = limbW;
    ctx.strokeStyle = ink;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(p[2][0], p[2][1], 0.032, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();

    const ang = p[3];
    for (const d of [-0.28, 0.1]) {
      const a = ang + d;
      ctx.beginPath();
      ctx.moveTo(p[2][0] + Math.sin(a) * 0.012, p[2][1] + Math.cos(a) * 0.012);
      ctx.lineTo(p[2][0] + Math.sin(a) * 0.04, p[2][1] + Math.cos(a) * 0.04);
      ctx.lineWidth = 0.014;
      ctx.strokeStyle = ink;
      ctx.stroke();
    }
  }

  // Asymmetric Blue Head + Face
  ctx.save();
  ctx.translate(0, -0.78);
  ctx.rotate(headTilt);
  ctx.translate(0, 0.78);

  wattHeadPath(ctx);
  ctx.fillStyle = WATT_2D_PALETTE.head;
  ctx.fill();
  ctx.save();
  wattHeadPath(ctx);
  ctx.clip();
  const hg = ctx.createLinearGradient(-0.2, -0.95, 0.21, -0.66);
  hg.addColorStop(0, 'rgba(255,255,255,0.12)');
  hg.addColorStop(0.45, 'rgba(255,255,255,0)');
  hg.addColorStop(0.78, 'rgba(0,0,0,0.05)');
  hg.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = hg;
  ctx.fillRect(-0.22, -0.98, 0.45, 0.42);
  ctx.restore();
  wattHeadPath(ctx);
  ctx.lineWidth = lw;
  ctx.strokeStyle = ink;
  ctx.stroke();

  // Eyes (right eye ~8% larger)
  const f = WATT_FACES[faceName] ?? WATT_FACES.neutral;
  const ex = 0.075;
  const ey = -0.775;
  const wide = f.eyes === 'wide';
  const half = f.eyes === 'half';
  for (const [side, r0] of [[-1, 0.042], [1, 0.0455]] as const) {
    const r = r0 * (wide ? 1.12 : 1);
    const x = side * ex;
    ctx.save();
    if (half) {
      ctx.beginPath();
      ctx.rect(x - r - 0.01, ey - r, r * 2 + 0.02, r);
      ctx.clip();
    }
    ctx.beginPath();
    ctx.ellipse(x, ey, r, r * (1 - 0.85 * blink), 0, 0, Math.PI * 2);
    ctx.fillStyle = WATT_2D_PALETTE.eye;
    ctx.fill();
    ctx.lineWidth = 0.012;
    ctx.strokeStyle = ink;
    ctx.stroke();

    if (blink < 0.85) {
      const look = f.look ?? [0, 0];
      const pr = f.pupil * r * (wide ? 0.75 : 1);
      ctx.beginPath();
      ctx.arc(x + look[0] * r * 0.45, ey + look[1] * r * 0.45, pr, 0, Math.PI * 2);
      ctx.fillStyle = WATT_2D_PALETTE.pupil;
      ctx.fill();
    }
    ctx.restore();
  }

  // Single thick tilted brow
  const by = ey - 0.075 - (f.browUp ?? 0) * 0.03;
  ctx.save();
  ctx.translate(0, by);
  ctx.rotate(f.browAng);
  ctx.beginPath();
  ctx.moveTo(-0.085, 0);
  ctx.lineTo(0.085, 0);
  ctx.lineWidth = 0.022;
  ctx.lineCap = 'round';
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.restore();

  // Tiny crooked mouth
  const mx = 0.008;
  const my = -0.638;
  ctx.lineWidth = 0.012;
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  ctx.fillStyle = ink;
  if (f.mouth === 'flat') {
    ctx.beginPath();
    ctx.moveTo(mx - 0.045, my);
    ctx.lineTo(mx + 0.045, my);
    ctx.stroke();
  } else if (f.mouth === 'o') {
    ctx.beginPath();
    ctx.ellipse(mx, my, 0.026, 0.032, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (f.mouth === 'wobble') {
    ctx.beginPath();
    ctx.moveTo(mx - 0.05, my);
    ctx.quadraticCurveTo(mx - 0.025, my + 0.015, mx, my - 0.002);
    ctx.quadraticCurveTo(mx + 0.025, my - 0.018, mx + 0.05, my + 0.002);
    ctx.stroke();
  } else if (f.mouth === 'grin') {
    ctx.beginPath();
    ctx.moveTo(mx - 0.055, my - 0.008);
    ctx.quadraticCurveTo(mx, my + 0.055, mx + 0.055, my - 0.008);
    ctx.quadraticCurveTo(mx, my + 0.012, mx - 0.055, my - 0.008);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = WATT_2D_PALETTE.eye;
    ctx.fillRect(mx - 0.038, my + 0.004, 0.076, 0.011);
  } else {
    const lift = f.mouth === 'smirk' ? 0.022 : 0.012;
    ctx.beginPath();
    ctx.moveTo(mx - 0.05, my);
    ctx.quadraticCurveTo(mx, my + 0.018, mx + 0.05, my - lift);
    ctx.stroke();
  }

  ctx.restore();

  // Floating #80C7FF Idea Diamond
  if (ideaPop > 0.01) {
    ctx.save();
    ctx.translate(0, -1.2 - 0.06 * ideaPop);
    ctx.rotate(t * 1.2);
    const r = 0.075 * ideaPop;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.25);
    ctx.lineTo(r * 0.78, -r * 0.15);
    ctx.lineTo(0, r * 0.95);
    ctx.lineTo(-r * 0.78, -r * 0.15);
    ctx.closePath();
    ctx.fillStyle = WATT_2D_PALETTE.accent;
    ctx.fill();
    ctx.lineWidth = 0.014;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.restore();

    if (ideaPop > 0.05) {
      ctx.save();
      ctx.globalAlpha = ideaPop;
      drawSparkle(ctx, -0.16, -1.26, 0.035 * ideaPop);
      drawSparkle(ctx, 0.15, -1.14, 0.028 * ideaPop);
      ctx.restore();
    }
  }

  ctx.restore();
}

export interface Watt2DSpriteProps {
  x?: number;
  y?: number;
  size?: number;
  pose?: Watt2DPose;
  face?: Watt2DFaceName;
  outfit?: Watt2DOutfit;
  t?: number;
}

/**
 * Optional standalone React Canvas wrapper for Watt2D.
 */
export const Watt2DSprite: React.FC<Watt2DSpriteProps> = ({
  x = 240,
  y = 460,
  size = 340,
  pose = 'idle',
  face,
  outfit = 'none',
  t = 0,
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    drawWatt2D(ctx, { x, y, s: size, pose, face, outfit, t });
  }, [x, y, size, pose, face, outfit, t]);
  return <canvas ref={ref} width={480} height={520} style={{ pointerEvents: 'none' }} />;
};
