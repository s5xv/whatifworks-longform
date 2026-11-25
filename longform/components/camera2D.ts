import type { WordTiming } from './KineticCaptions';
import { cueAt, cueRange } from '../three/timing';

export type Camera2DPreset = 'wide' | 'zoomIn' | 'pan' | 'whipPan' | 'impactShake';

export interface Camera2DBeat {
  startSec: number;
  endSec?: number;
  preset: Camera2DPreset;
  zoom?: number;
  /** Focus point in 1920x1080 canvas coords (default: center 960, 540) */
  focusX?: number;
  focusY?: number;
  panX?: number;
  panY?: number;
  intensity?: number;
}

export interface Camera2DState {
  scale: number;
  tx: number;
  ty: number;
  shakeX: number;
  shakeY: number;
  preset: Camera2DPreset;
  localT: number;
  progress: number;
}

const DEFAULT_2D_CYCLE: Camera2DPreset[] = ['wide', 'zoomIn', 'pan', 'whipPan', 'wide', 'zoomIn'];

const easeOutCubic = (u: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, u)), 3);
const easeInOutSine = (u: number) => -(Math.cos(Math.PI * Math.max(0, Math.min(1, u))) - 1) / 2;

export function cueCamera2DBeat(
  words: WordTiming[] | undefined,
  startQuery: string,
  endQuery: string,
  preset: Camera2DPreset,
  options?: {
    fallbackStartSec?: number;
    fallbackEndSec?: number;
    zoom?: number;
    focusX?: number;
    focusY?: number;
    panX?: number;
    panY?: number;
    intensity?: number;
  }
): Camera2DBeat {
  const [startSec, endSec] = cueRange(
    words,
    startQuery,
    endQuery,
    options?.fallbackStartSec ?? 0,
    options?.fallbackEndSec ?? 5.5
  );
  return {
    startSec,
    endSec,
    preset,
    zoom: options?.zoom,
    focusX: options?.focusX,
    focusY: options?.focusY,
    panX: options?.panX,
    panY: options?.panY,
    intensity: options?.intensity,
  };
}

export function cueCamera2DAt(
  words: WordTiming[] | undefined,
  query: string,
  preset: Camera2DPreset,
  durationSec: number = 5.5,
  options?: {
    fallbackStartSec?: number;
    zoom?: number;
    focusX?: number;
    focusY?: number;
    panX?: number;
    panY?: number;
    intensity?: number;
  }
): Camera2DBeat {
  const startSec = cueAt(words, query, options?.fallbackStartSec ?? 0);
  return {
    startSec,
    endSec: startSec + durationSec,
    preset,
    zoom: options?.zoom,
    focusX: options?.focusX,
    focusY: options?.focusY,
    panX: options?.panX,
    panY: options?.panY,
    intensity: options?.intensity,
  };
}

/**
 * Enforces a 2D camera cut or movement shift every 4–7 seconds (default 5.5s).
 */
export function createCamera2DSchedule(
  durationSec: number,
  customBeats: Camera2DBeat[] = [],
  maxShotSec: number = 5.5
): Camera2DBeat[] {
  const clampedMax = Math.max(4.0, Math.min(7.0, maxShotSec));
  const sorted = [...customBeats]
    .filter((b) => Number.isFinite(b.startSec) && b.startSec < durationSec)
    .sort((a, b) => a.startSec - b.startSec);

  const raw: Camera2DBeat[] = [];
  let cursor = 0;
  let cycleIdx = 0;

  for (const beat of sorted) {
    const bStart = Math.max(cursor, beat.startSec);
    if (bStart - cursor > 0.25) {
      raw.push({
        startSec: cursor,
        endSec: bStart,
        preset: DEFAULT_2D_CYCLE[cycleIdx++ % DEFAULT_2D_CYCLE.length],
      });
    }
    const bEnd = beat.endSec ? Math.min(durationSec, Math.max(bStart + 0.5, beat.endSec)) : durationSec;
    raw.push({ ...beat, startSec: bStart, endSec: bEnd });
    cursor = bEnd;
  }

  if (durationSec - cursor > 0.25 || raw.length === 0) {
    raw.push({
      startSec: cursor,
      endSec: durationSec,
      preset: DEFAULT_2D_CYCLE[cycleIdx++ % DEFAULT_2D_CYCLE.length],
    });
  }

  const subdivided: Camera2DBeat[] = [];
  for (const seg of raw) {
    const segStart = seg.startSec;
    const segEnd = seg.endSec ?? durationSec;
    const len = segEnd - segStart;
    if (len <= clampedMax) {
      subdivided.push({ ...seg, endSec: segEnd });
      continue;
    }
    const chunks = Math.ceil(len / clampedMax);
    const step = len / chunks;
    for (let i = 0; i < chunks; i++) {
      const preset = i === 0 ? seg.preset : DEFAULT_2D_CYCLE[(cycleIdx + i) % DEFAULT_2D_CYCLE.length];
      subdivided.push({
        ...seg,
        startSec: segStart + i * step,
        endSec: segStart + (i + 1) * step,
        preset,
      });
    }
    cycleIdx += chunks;
  }

  return subdivided;
}

export function computeCamera2DState(t: number, schedule: Camera2DBeat[]): Camera2DState {
  let active: Camera2DBeat = schedule[0] ?? { startSec: 0, endSec: 5.5, preset: 'wide' };
  for (let i = 0; i < schedule.length; i++) {
    const b = schedule[i];
    if (t >= b.startSec && (b.endSec === undefined || t < b.endSec)) {
      active = b;
      break;
    }
    if (t >= b.startSec) active = b;
  }

  const dur = Math.max(0.4, (active.endSec ?? active.startSec + 5.5) - active.startSec);
  const localT = Math.max(0, t - active.startSec);
  const progress = Math.min(1, localT / dur);

  const fx = active.focusX ?? 960;
  const fy = active.focusY ?? 540;
  let scale = 1.0;
  let tx = 0;
  let ty = 0;
  let shakeX = 0;
  let shakeY = 0;

  switch (active.preset) {
    case 'wide': {
      scale = 1.0 + 0.03 * easeInOutSine(progress);
      tx = (960 - fx) * 0.15;
      ty = (540 - fy) * 0.15;
      break;
    }
    case 'zoomIn': {
      const targetZoom = active.zoom ?? 1.24;
      scale = 1.04 + (targetZoom - 1.04) * easeOutCubic(progress);
      tx = (960 - fx) * (scale - 1) * 0.55;
      ty = (540 - fy) * (scale - 1) * 0.55;
      break;
    }
    case 'pan': {
      scale = active.zoom ?? 1.1;
      const px = active.panX ?? 90;
      const py = active.panY ?? 0;
      const u = easeInOutSine(progress) - 0.5;
      tx = (960 - fx) * 0.3 - u * px;
      ty = (540 - fy) * 0.3 - u * py;
      break;
    }
    case 'whipPan': {
      const whip = Math.exp(-localT * 9.0);
      scale = (active.zoom ?? 1.14) + whip * 0.08;
      tx = (960 - fx) * 0.4 + whip * (active.panX ?? 180);
      ty = (540 - fy) * 0.35;
      break;
    }
    case 'impactShake': {
      const decay = Math.exp(-localT * 2.6) * 18 * (active.intensity ?? 1.0);
      scale = active.zoom ?? 1.12;
      tx = (960 - fx) * 0.3;
      ty = (540 - fy) * 0.3;
      shakeX = Math.sin(t * 52) * decay;
      shakeY = Math.cos(t * 59) * decay;
      break;
    }
  }

  return {
    scale,
    tx,
    ty,
    shakeX,
    shakeY,
    preset: active.preset,
    localT,
    progress,
  };
}
