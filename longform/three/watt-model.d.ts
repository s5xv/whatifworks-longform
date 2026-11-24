import type { WattInstance } from './types';
export type { WattInstance };
export const GROUND_Y: number;
export const WATT: Record<string, number>;
export const WATT_FACES: Record<string, unknown>;
export function createWatt(options?: { ps1Shader?: <T extends import('three').Material>(m: T) => T }): WattInstance;
