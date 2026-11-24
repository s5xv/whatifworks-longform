import * as THREE from 'three';

export const MIN_FOREGROUND_CLEARANCE = 1.3;

const _seg = new THREE.Vector3();
const _toProp = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _push = new THREE.Vector3();

/**
 * Enforces foreground clearance (>= 1.3 units) from Watt, the camera, and the
 * camera-to-Watt sightline corridor so floating props never cross in front of Watt's face.
 */
export function enforceForegroundClearance(
  propPos: THREE.Vector3,
  cameraPos: THREE.Vector3,
  wattPos: THREE.Vector3,
  minClearance: number = MIN_FOREGROUND_CLEARANCE
): void {
  // 1. Keep props out of the camera-to-Watt sightline cylinder
  _seg.subVectors(wattPos, cameraPos);
  const segLenSq = _seg.lengthSq();
  if (segLenSq > 1e-6) {
    _toProp.subVectors(propPos, cameraPos);
    const proj = Math.max(0, Math.min(1, _toProp.dot(_seg) / segLenSq));
    _closest.copy(cameraPos).addScaledVector(_seg, proj);
    _push.subVectors(propPos, _closest);
    const distToRay = _push.length();
    if (distToRay < minClearance) {
      if (distToRay < 1e-4) {
        _push.set(propPos.x >= 0 ? 1 : -1, 0, -0.5).normalize();
      } else {
        _push.normalize();
      }
      propPos.copy(_closest).addScaledVector(_push, minClearance);
    }
  }

  // 2. Enforce radial clearance from Watt's center/head
  const distToWatt = propPos.distanceTo(wattPos);
  if (distToWatt < minClearance) {
    _push.subVectors(propPos, wattPos);
    if (_push.lengthSq() < 1e-6) _push.set(1, 0, -1);
    _push.normalize();
    propPos.copy(wattPos).addScaledVector(_push, minClearance);
  }

  // 3. Enforce radial clearance from the camera lens
  const distToCam = propPos.distanceTo(cameraPos);
  if (distToCam < minClearance) {
    _push.subVectors(propPos, cameraPos);
    if (_push.lengthSq() < 1e-6) _push.set(0, 0, -1);
    _push.normalize();
    propPos.copy(cameraPos).addScaledVector(_push, minClearance);
  }
}
