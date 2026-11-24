import * as THREE from 'three';
import type { WordTiming } from '../components/KineticCaptions';
import { enforceForegroundClearance, MIN_FOREGROUND_CLEARANCE } from './clearance';
import { cueAt, cueRange } from './timing';

export type CameraPreset =
  | 'wide'
  | 'closeup'
  | 'orbit'
  | 'dollyIn'
  | 'overhead'
  | 'impactShake';

export interface CameraBeat {
  startSec: number;
  endSec?: number;
  preset: CameraPreset;
  target?: [number, number, number];
  intensity?: number;
}

const DEFAULT_PRESET_CYCLE: CameraPreset[] = [
  'wide',
  'dollyIn',
  'orbit',
  'closeup',
  'overhead',
  'wide',
];

const _wattTarget = new THREE.Vector3();

/**
 * Helper to anchor a camera beat to spoken words via `cueRange()`.
 */
export function cueCameraBeat(
  words: WordTiming[] | undefined,
  startQuery: string,
  endQuery: string,
  preset: CameraPreset,
  options?: {
    fallbackStartSec?: number;
    fallbackEndSec?: number;
    target?: [number, number, number];
    intensity?: number;
  }
): CameraBeat {
  const [startSec, endSec] = cueRange(
    words,
    startQuery,
    endQuery,
    options?.fallbackStartSec ?? 0,
    options?.fallbackEndSec ?? 8
  );
  return {
    startSec,
    endSec,
    preset,
    target: options?.target,
    intensity: options?.intensity,
  };
}

/**
 * Helper to trigger a camera beat at a single word via `cueAt()`.
 */
export function cueCameraAt(
  words: WordTiming[] | undefined,
  query: string,
  preset: CameraPreset,
  durationSec: number = 6.5,
  options?: {
    fallbackStartSec?: number;
    target?: [number, number, number];
    intensity?: number;
  }
): CameraBeat {
  const startSec = cueAt(words, query, options?.fallbackStartSec ?? 0);
  return {
    startSec,
    endSec: startSec + durationSec,
    preset,
    target: options?.target,
    intensity: options?.intensity,
  };
}

/**
 * Normalizes a camera beat list and enforces a cut or movement shift every
 * `maxShotSec` (default 8.0s, within the 6-10s retention window) so chapters
 * never sit on a single static angle.
 */
export function createCameraSchedule(
  durationSec: number,
  customBeats: CameraBeat[] = [],
  maxShotSec: number = 8.0
): CameraBeat[] {
  const clampedMax = Math.max(6.0, Math.min(10.0, maxShotSec));
  const sorted = [...customBeats]
    .filter((b) => Number.isFinite(b.startSec) && b.startSec < durationSec)
    .sort((a, b) => a.startSec - b.startSec);

  // Fill leading gap from 0s if needed
  const raw: CameraBeat[] = [];
  let cursor = 0;
  let cycleIdx = 0;

  for (const beat of sorted) {
    const bStart = Math.max(cursor, beat.startSec);
    if (bStart - cursor > 0.25) {
      raw.push({
        startSec: cursor,
        endSec: bStart,
        preset: DEFAULT_PRESET_CYCLE[cycleIdx++ % DEFAULT_PRESET_CYCLE.length],
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
      preset: DEFAULT_PRESET_CYCLE[cycleIdx++ % DEFAULT_PRESET_CYCLE.length],
    });
  }

  // Subdivide any segment longer than clampedMax (6-10s) into alternating presets
  const subdivided: CameraBeat[] = [];
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
      const preset =
        i === 0
          ? seg.preset
          : DEFAULT_PRESET_CYCLE[(cycleIdx + i) % DEFAULT_PRESET_CYCLE.length];
      subdivided.push({
        startSec: segStart + i * step,
        endSec: segStart + (i + 1) * step,
        preset,
        target: seg.target,
        intensity: seg.intensity,
      });
    }
    cycleIdx += chunks;
  }

  return subdivided;
}

/**
 * Updates `camera` for timestamp `t` using the active beat in `schedule`,
 * and optionally enforces `MIN_FOREGROUND_CLEARANCE` (>= 1.3u) on all `props`.
 */
export function updateCameraDirector(
  camera: THREE.PerspectiveCamera,
  t: number,
  schedule: CameraBeat[],
  wattPos?: THREE.Vector3,
  props?: THREE.Object3D[]
): CameraPreset {
  let active: CameraBeat = schedule[0] ?? { startSec: 0, endSec: 8, preset: 'wide' };
  for (let i = 0; i < schedule.length; i++) {
    const b = schedule[i];
    if (t >= b.startSec && (b.endSec === undefined || t < b.endSec)) {
      active = b;
      break;
    }
    if (t >= b.startSec) {
      active = b;
    }
  }

  const endSec = active.endSec ?? active.startSec + 8.0;
  const dur = Math.max(0.5, endSec - active.startSec);
  const localT = Math.max(0, t - active.startSec);
  const progress = Math.min(1, localT / dur);

  const wx = wattPos ? wattPos.x : 0;
  const wy = wattPos ? wattPos.y : 0;
  const wz = wattPos ? wattPos.z : 0;

  const tx = active.target ? active.target[0] : wx;
  const ty = active.target ? active.target[1] : wy + 1.05;
  const tz = active.target ? active.target[2] : wz;
  const intensity = active.intensity ?? 1.0;

  switch (active.preset) {
    case 'wide': {
      camera.position.set(
        tx + Math.sin(t * 0.35) * 0.75,
        ty + 0.65,
        tz + 5.2 - progress * 0.35
      );
      camera.lookAt(tx, ty, tz);
      break;
    }
    case 'closeup': {
      camera.position.set(
        tx + 0.55 - progress * 0.25,
        ty + 0.22,
        tz + 2.75
      );
      camera.lookAt(tx, ty + 0.08, tz);
      break;
    }
    case 'orbit': {
      const ang = -0.55 + progress * 1.1;
      const rad = 4.1;
      camera.position.set(
        tx + Math.sin(ang) * rad,
        ty + 0.55 + Math.sin(progress * Math.PI) * 0.35,
        tz + Math.cos(ang) * rad
      );
      camera.lookAt(tx, ty, tz);
      break;
    }
    case 'dollyIn': {
      const zDist = 4.8 - progress * 1.75;
      camera.position.set(tx - 0.35 * (1 - progress), ty + 0.45 - progress * 0.15, tz + zDist);
      camera.lookAt(tx, ty + 0.04, tz);
      break;
    }
    case 'overhead': {
      camera.position.set(
        tx + Math.sin(t * 0.4) * 0.8,
        ty + 3.1,
        tz + 3.6 - progress * 0.4
      );
      camera.lookAt(tx, ty - 0.15, tz);
      break;
    }
    case 'impactShake': {
      const decay = Math.exp(-localT * 2.2) * 0.18 * intensity;
      const sx = Math.sin(t * 48.0) * decay;
      const sy = Math.cos(t * 53.0) * decay;
      camera.position.set(tx + 0.25 + sx, ty + 0.45 + sy, tz + 3.6);
      camera.lookAt(tx + sx * 0.4, ty + sy * 0.4, tz);
      break;
    }
  }

  if (props && props.length > 0) {
    _wattTarget.set(wx, wy + 1.05, wz);
    for (const p of props) {
      enforceForegroundClearance(p.position, camera.position, _wattTarget, MIN_FOREGROUND_CLEARANCE);
    }
  }

  return active.preset;
}
