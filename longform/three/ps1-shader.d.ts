import type * as THREE from 'three';
export function applyPS1Material<T extends THREE.Material>(
  mat: T,
  opts?: { snapX?: number; snapY?: number; colorLevels?: number }
): T;
