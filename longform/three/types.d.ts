import * as THREE from 'three';

export type WattFaceName = 'neutral' | 'smug' | 'confused' | 'scared' | 'idea' | 'deadpan';
export type WattPoseName =
  | 'idle'
  | 'walk'
  | 'run'
  | 'panic'
  | 'bounce'
  | 'sit'
  | 'crawl'
  | 'eat'
  | 'powerup'
  | 'celebrate'
  | 'deadpan';

export interface WattInstance {
  root: THREE.Group;
  GROUND_Y: number;
  setPosition: (x: number, z: number, y?: number) => void;
  setFace: (name: WattFaceName) => void;
  setBlink: (v: number) => void;
  setIdea: (v: number) => void;
  setPose: (poseName: WattPoseName, t: number) => void;
  idle: (t: number) => void;
  walk: (t: number, spd?: number) => void;
  run: (t: number, spd?: number) => void;
  panic: (t: number) => void;
  bounce: (t: number) => void;
  jump: (progress: number, height?: number) => void;
  updateShadow: () => void;
  nodes: {
    torsoGroup: THREE.Group;
    headGroup: THREE.Group;
    headMesh: THREE.Mesh;
    faceDecal: THREE.Mesh;
    diamondGroup: THREE.Group;
    propSocket: THREE.Group;
  };
}

export const WATT: Record<string, number>;
export function createWatt(options?: { ps1Shader?: <T extends THREE.Material>(m: T) => T }): WattInstance;
export function applyPS1Material<T extends THREE.Material>(
  mat: T,
  opts?: { disableSnap?: boolean; snapX?: number; snapY?: number; colorLevels?: number }
): T;
