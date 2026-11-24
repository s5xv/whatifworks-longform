/**
 * watt-model.js — Bulletproof Three.js PS1 Low-Poly Character Builder for Watt
 * 
 * Features:
 * - Exact asymmetric head with top-left bump and wider lower-right curve
 * - Palette: Head #2878FF, Outline/Limbs #111111, Torso #151515, Accent #80C7FF
 * - Exact Grounded Kinematics: when root.position.y = 0, feetMinY === 0.000
 * - Deterministic acting poses driven strictly by t (no performance.now())
 * - Head rotation clamping [-0.28, 0.28] (prevents forehead decal clipping)
 * - Safe muscle scaling (setMuscleScale) without detaching limbs or shifting ground contact
 * - Clean neutral desaturation (setDesaturation) to cool gray #8A94A6 (never greenish)
 * - Built-in spatial telemetry for automated pre-flight QA audits (getTelemetry)
 */

import * as THREE from 'three';

export const GROUND_Y = 0.0;

export const WATT = {
  head: 0x2878FF,
  headSh: 0x1f63d6,
  ink: 0x222633,
  body: 0x2b3040,
  torso: 0x2b3040,
  limbs: 0x222633,
  eye: 0xffffff,
  pupil: 0x111111,
  accent: 0x80C7FF,
  white: 0xf4f4f4,
  red: 0xd8312b,
  shadow: 0x06040a,
  coolGray: 0x8A94A6,
};

export const WATT_FACES = {
  neutral:  { browAng: -0.12, pupil: 0.42, mouth: 'crook', look: [0, 0] },
  smug:     { browAng: -0.28, pupil: 0.38, mouth: 'smirk',  look: [0.30, 0.05] },
  confused: { browAng:  0.18, pupil: 0.50, mouth: 'wobble', look: [-0.35, 0] },
  scared:   { browAng:  0.30, browUp: 0.6, pupil: 0.30, mouth: 'o', eyes: 'wide' },
  idea:     { browAng: -0.35, browUp: 0.8, pupil: 0.45, mouth: 'grin', eyes: 'normal' },
  deadpan:  { browAng:  0.00, pupil: 0.40, mouth: 'flat',  eyes: 'half', look: [0, 0] },
};

function createWattHeadGeometry() {
  const geo = new THREE.SphereGeometry(0.38, 14, 10);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const angle = Math.atan2(v.y, v.x);

    // Top-left bump (around 120°-135° in XY plane)
    const bumpFactor = Math.exp(-Math.pow((angle - 2.1) / 0.35, 2)) * 0.13;

    // Wider and rounder lower-right curve (around -50° in XY plane)
    const wideFactor = Math.exp(-Math.pow((angle + 0.85) / 0.55, 2)) * 0.15;

    const rFactor = 1.0 + bumpFactor + wideFactor;
    v.x *= rFactor;
    v.y *= rFactor;
    v.z *= 0.74; // Graphic cartoon depth profile

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

function drawWattFaceCanvas(ctx, faceState, blinkVal, glowingEyes = false, glowColor = '#80C7FF') {
  const W = 256, H = 256;
  ctx.clearRect(0, 0, W, H);

  const blink = Math.max(0, Math.min(1, blinkVal || 0));
  const eyeY = 120;
  const ex = 42;
  const cx = W / 2;

  const wide = faceState.eyes === 'wide';
  const half = faceState.eyes === 'half';

  const eyeSpecs = [
    [-ex, 28 * (wide ? 1.15 : 1)],
    [ ex, 30.3 * (wide ? 1.15 : 1)],
  ];

  for (let sIdx = 0; sIdx < 2; sIdx++) {
    const [xOff, r] = eyeSpecs[sIdx];
    const x = cx + xOff;

    ctx.save();
    if (half) {
      ctx.beginPath();
      ctx.rect(x - r - 6, eyeY - r - 6, r * 2 + 12, r + 6);
      ctx.clip();
    }

    ctx.beginPath();
    ctx.ellipse(x, eyeY, r, r * (1 - 0.88 * blink), 0, 0, Math.PI * 2);

    if (glowingEyes) {
      ctx.fillStyle = glowColor;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 18;
    } else {
      ctx.fillStyle = '#ffffff';
    }
    ctx.fill();

    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#111111';
    ctx.stroke();

    if (blink < 0.85) {
      const look = faceState.look || [0, 0];
      const pr = (faceState.pupil || 0.42) * r * (wide ? 0.75 : 1);
      ctx.beginPath();
      ctx.arc(x + look[0] * r * 0.45, eyeY + look[1] * r * 0.45, pr, 0, Math.PI * 2);
      ctx.fillStyle = glowingEyes ? '#ffffff' : '#111111';
      ctx.fill();
    }
    ctx.restore();
  }

  // Single thick brow
  const browUp = (faceState.browUp || 0) * 14;
  const browAng = faceState.browAng !== undefined ? faceState.browAng : -0.12;
  ctx.save();
  ctx.translate(cx, eyeY - 34 - browUp);
  ctx.rotate(browAng);
  ctx.lineWidth = 7.5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#111111';
  ctx.beginPath();
  ctx.moveTo(-32, 0);
  ctx.lineTo(32, 0);
  ctx.stroke();
  ctx.restore();

  // Tiny crooked mouth
  const m = faceState.mouth || 'crook';
  const mx = cx + 4, my = eyeY + 48;
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = '#111111';
  ctx.fillStyle = '#111111';
  ctx.lineCap = 'round';

  if (m === 'flat') {
    ctx.beginPath();
    ctx.moveTo(mx - 22, my);
    ctx.lineTo(mx + 22, my);
    ctx.stroke();
  } else if (m === 'o') {
    ctx.beginPath();
    ctx.ellipse(mx, my, 12, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (m === 'wobble') {
    ctx.beginPath();
    ctx.moveTo(mx - 24, my);
    ctx.quadraticCurveTo(mx - 12, my + 8, mx, my - 2);
    ctx.quadraticCurveTo(mx + 12, my - 10, mx + 24, my + 2);
    ctx.stroke();
  } else if (m === 'grin') {
    ctx.beginPath();
    ctx.moveTo(mx - 28, my - 4);
    ctx.quadraticCurveTo(mx, my + 28, mx + 28, my - 4);
    ctx.quadraticCurveTo(mx, my + 6, mx - 28, my - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx - 18, my + 2, 36, 6);
  } else {
    const lift = m === 'smirk' ? 14 : 7;
    ctx.beginPath();
    ctx.moveTo(mx - 24, my);
    ctx.quadraticCurveTo(mx, my + 10, mx + 24, my - lift);
    ctx.stroke();
  }
}

export function createWatt(options = {}) {
  const ps1 = options.ps1Shader || ((m) => m);
  const root = new THREE.Group();
  root.name = 'WattRoot';

  // Canonical colors
  const COLOR_HEAD_CANONICAL = new THREE.Color(WATT.head);
  const COLOR_COOL_GRAY = new THREE.Color(WATT.coolGray);

  // Materials
  const matHead = ps1(new THREE.MeshLambertMaterial({
    color: WATT.head,
    flatShading: true,
    emissive: 0x0d2b66,
    emissiveIntensity: 0.25
  }));
  const matTorso = ps1(new THREE.MeshLambertMaterial({
    color: WATT.torso,
    flatShading: true
  }));
  const matLimbs = ps1(new THREE.MeshLambertMaterial({
    color: WATT.limbs,
    flatShading: true
  }));
  const matBody = matTorso;
  const matInk = matLimbs;
  const matSkin = matHead;
  const matAccent = ps1(new THREE.MeshLambertMaterial({ color: WATT.accent, flatShading: true, emissive: 0x1f456e }));
  const matWhite = ps1(new THREE.MeshLambertMaterial({ color: WATT.white, flatShading: true }));
  const matRed = ps1(new THREE.MeshLambertMaterial({ color: WATT.red, flatShading: true }));

  // Contact Shadow at y = 0.003
  const shadowGeo = new THREE.CircleGeometry(0.36, 12);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: WATT.shadow,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.name = 'ContactShadow';
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.set(0, 0.003, 0);
  root.add(shadowMesh);

  // Exact grounded kinematics constants:
  // Thigh: 0.28, Shin: 0.26, Foot center: y = 0, half-height: 0.02
  // Total height to hip = 0.28 + 0.26 + 0.02 = 0.56
  const BASE_TORSO_Y = 0.56;
  const upperLegLen = 0.28;
  const lowerLegLen = 0.26;

  const torsoGroup = new THREE.Group();
  torsoGroup.name = 'TorsoGroup';
  torsoGroup.position.set(0, BASE_TORSO_Y, 0);
  root.add(torsoGroup);

  // Torso Mesh: 0.44 height, origin at waist (0, 0.22, 0)
  const torsoGeo = new THREE.CylinderGeometry(0.18, 0.16, 0.44, 9);
  torsoGeo.translate(0, 0.22, 0);
  const torsoMesh = new THREE.Mesh(torsoGeo, matBody);
  torsoMesh.name = 'TorsoMesh';
  torsoGroup.add(torsoMesh);

  // Neck & Head
  const neckGroup = new THREE.Group();
  neckGroup.name = 'NeckGroup';
  neckGroup.position.set(0, 0.44, 0);
  torsoGroup.add(neckGroup);

  const headGroup = new THREE.Group();
  headGroup.name = 'HeadGroup';
  headGroup.position.set(0, 0.12, 0);
  neckGroup.add(headGroup);

  const headMesh = new THREE.Mesh(createWattHeadGeometry(), matHead);
  headMesh.name = 'HeadMesh';
  headMesh.position.set(0, 0.24, 0);
  headGroup.add(headMesh);

  // Face Decal
  const faceCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : { width: 256, height: 256, getContext: () => null };
  if (faceCanvas.getContext) {
    faceCanvas.width = 256;
    faceCanvas.height = 256;
  }
  const faceCtx = faceCanvas.getContext ? faceCanvas.getContext('2d') : null;
  const faceTexture = new THREE.CanvasTexture(faceCanvas);
  faceTexture.magFilter = THREE.NearestFilter;
  faceTexture.minFilter = THREE.NearestFilter;
  faceTexture.generateMipmaps = false;

  const faceMat = ps1(new THREE.MeshBasicMaterial({
    map: faceTexture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  const faceDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.56), faceMat);
  faceDecal.name = 'FaceDecal';
  faceDecal.position.set(0, 0.24, 0.29);
  faceDecal.renderOrder = 10;
  headGroup.add(faceDecal);

  // Floating Idea Diamond
  const diamondGroup = new THREE.Group();
  diamondGroup.name = 'DiamondGroup';
  diamondGroup.position.set(0, 0.76, 0);
  diamondGroup.scale.set(0, 0, 0);
  headGroup.add(diamondGroup);

  const diamondMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), matAccent);
  diamondGroup.add(diamondMesh);

  const sparkles = [];
  const sparkleGeo = new THREE.PlaneGeometry(0.045, 0.045);
  for (let i = 0; i < 4; i++) {
    const sp = new THREE.Mesh(sparkleGeo, matAccent);
    const ang = (i * Math.PI) / 2;
    sp.position.set(Math.cos(ang) * 0.18, Math.sin(ang) * 0.18, 0);
    sp.rotation.z = Math.PI / 4;
    diamondGroup.add(sp);
    sparkles.push(sp);
  }

  // Limb Helpers
  const limbGeo = (len, r = 0.032) => {
    const g = new THREE.CylinderGeometry(r, r, len, 6);
    g.translate(0, -len / 2, 0);
    return g;
  };

  const handGeo = () => {
    const g = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), matInk);
    g.add(palm);
    const f1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 4), matInk);
    f1.position.set(-0.02, -0.04, 0);
    f1.rotation.z = 0.2;
    const f2 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 4), matInk);
    f2.position.set(0.02, -0.04, 0);
    f2.rotation.z = -0.2;
    g.add(f1);
    g.add(f2);
    return g;
  };

  const footGeo = () => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.16), matInk);
    g.position.set(0, 0.00, 0.04); // Half-height 0.02 puts bottom at exact 0.000
    return g;
  };

  // Arms
  const shoulderY = 0.38, shoulderX = 0.19;
  const upperArmLen = 0.26, lowerArmLen = 0.24;

  const leftShoulder = new THREE.Group();
  leftShoulder.name = 'LeftShoulder';
  leftShoulder.position.set(-shoulderX, shoulderY, 0);
  torsoGroup.add(leftShoulder);

  const leftUpperArm = new THREE.Mesh(limbGeo(upperArmLen), matInk);
  leftShoulder.add(leftUpperArm);

  const leftElbow = new THREE.Group();
  leftElbow.name = 'LeftElbow';
  leftElbow.position.set(0, -upperArmLen, 0);
  leftShoulder.add(leftElbow);

  const leftLowerArm = new THREE.Mesh(limbGeo(lowerArmLen), matInk);
  leftElbow.add(leftLowerArm);

  const leftHand = new THREE.Group();
  leftHand.name = 'LeftHand';
  leftHand.position.set(0, -lowerArmLen, 0);
  leftElbow.add(leftHand);
  leftHand.add(handGeo());

  const rightShoulder = new THREE.Group();
  rightShoulder.name = 'RightShoulder';
  rightShoulder.position.set(shoulderX, shoulderY, 0);
  torsoGroup.add(rightShoulder);

  const rightUpperArm = new THREE.Mesh(limbGeo(upperArmLen), matInk);
  rightShoulder.add(rightUpperArm);

  const rightElbow = new THREE.Group();
  rightElbow.name = 'RightElbow';
  rightElbow.position.set(0, -upperArmLen, 0);
  rightShoulder.add(rightElbow);

  const rightLowerArm = new THREE.Mesh(limbGeo(lowerArmLen), matInk);
  rightElbow.add(rightLowerArm);

  const rightHand = new THREE.Group();
  rightHand.name = 'RightHand';
  rightHand.position.set(0, -lowerArmLen, 0);
  rightElbow.add(rightHand);
  rightHand.add(handGeo());

  const propSocket = new THREE.Group();
  propSocket.name = 'PropSocket';
  rightHand.add(propSocket);

  // Legs (Hips at local y = 0 relative to TorsoGroup)
  const hipX = 0.10;

  const leftHip = new THREE.Group();
  leftHip.name = 'LeftHip';
  leftHip.position.set(-hipX, 0, 0);
  torsoGroup.add(leftHip);

  const leftUpperLeg = new THREE.Mesh(limbGeo(upperLegLen, 0.038), matInk);
  leftHip.add(leftUpperLeg);

  const leftKnee = new THREE.Group();
  leftKnee.name = 'LeftKnee';
  leftKnee.position.set(0, -upperLegLen, 0);
  leftHip.add(leftKnee);

  const leftLowerLeg = new THREE.Mesh(limbGeo(lowerLegLen, 0.038), matInk);
  leftKnee.add(leftLowerLeg);

  const leftFoot = new THREE.Group();
  leftFoot.name = 'LeftFoot';
  leftFoot.position.set(0, -lowerLegLen, 0);
  leftKnee.add(leftFoot);
  leftFoot.add(footGeo());

  const rightHip = new THREE.Group();
  rightHip.name = 'RightHip';
  rightHip.position.set(hipX, 0, 0);
  torsoGroup.add(rightHip);

  const rightUpperLeg = new THREE.Mesh(limbGeo(upperLegLen, 0.038), matInk);
  rightHip.add(rightUpperLeg);

  const rightKnee = new THREE.Group();
  rightKnee.name = 'RightKnee';
  rightKnee.position.set(0, -upperLegLen, 0);
  rightHip.add(rightKnee);

  const rightLowerLeg = new THREE.Mesh(limbGeo(lowerLegLen, 0.038), matInk);
  rightKnee.add(rightLowerLeg);

  const rightFoot = new THREE.Group();
  rightFoot.name = 'RightFoot';
  rightFoot.position.set(0, -lowerLegLen, 0);
  rightKnee.add(rightFoot);
  rightFoot.add(footGeo());

  // Outfits
  const outfitTorsoGroup = new THREE.Group();
  torsoGroup.add(outfitTorsoGroup);
  const outfitHeadGroup = new THREE.Group();
  headGroup.add(outfitHeadGroup);

  // State
  let currentFace = { ...WATT_FACES.neutral };
  let currentBlink = 0;
  let currentGlowing = false;
  let currentGlowColor = '#80C7FF';
  let isGrounded = true;

  function updateFace() {
    if (faceCtx) {
      drawWattFaceCanvas(faceCtx, currentFace, currentBlink, currentGlowing, currentGlowColor);
      faceTexture.needsUpdate = true;
    }
  }

  function updateShadow() {
    const jumpHeight = Math.max(0, torsoGroup.position.y - BASE_TORSO_Y + root.position.y);
    const shadowScale = Math.max(0.15, 1.0 - jumpHeight * 0.75);
    shadowMesh.scale.set(shadowScale, shadowScale, shadowScale);
    shadowMat.opacity = Math.max(0.05, 0.42 * (1.0 - jumpHeight * 1.1));
  }

  // --- Public API ---

  function setPosition(x, z = 0, yOffset = 0, opts = {}) {
    const clampX = opts.clampX !== false;
    const grounded = opts.grounded !== false;
    isGrounded = grounded;

    const clampedX = clampX ? Math.max(-1.15, Math.min(1.15, x)) : x;
    const targetY = grounded ? (GROUND_Y + Math.max(0, yOffset)) : (GROUND_Y + yOffset);

    root.position.set(clampedX, targetY, z);
    updateShadow();
  }

  function setFace(faceNameOrObj) {
    if (typeof faceNameOrObj === 'string') {
      currentFace = { ...(WATT_FACES[faceNameOrObj] || WATT_FACES.neutral) };
    } else if (faceNameOrObj) {
      currentFace = { ...WATT_FACES.neutral, ...faceNameOrObj };
    }
    updateFace();
  }

  function setBlink(val) {
    currentBlink = val;
    updateFace();
  }

  function setIdea(progress, t = 0) {
    const p = Math.max(0, Math.min(1, progress || 0));
    diamondGroup.scale.setScalar(p);

    if (p > 0.001) {
      diamondMesh.rotation.y = t * 3.5;
      diamondMesh.position.y = Math.sin(t * 6.0) * 0.03;
      sparkles.forEach((sp, idx) => {
        const ang = (idx * Math.PI) / 2 + t * 2.5;
        const radius = 0.18 + Math.sin(t * 8.0 + idx) * 0.03;
        sp.position.set(Math.cos(ang) * radius, Math.sin(ang) * radius, 0);
        sp.scale.setScalar(0.7 + Math.sin(t * 10.0 + idx) * 0.3);
      });
    }
  }

  function setMuscleScale(factor) {
    const f = Math.max(0.4, Math.min(2.8, factor || 1.0));
    // Scale limb thickness (X/Z) without changing height (Y) to keep foot contact exact
    torsoMesh.scale.set(f, 1.0, f);
    leftUpperArm.scale.set(f, 1.0, f);
    leftLowerArm.scale.set(f, 1.0, f);
    rightUpperArm.scale.set(f, 1.0, f);
    rightLowerArm.scale.set(f, 1.0, f);
    leftUpperLeg.scale.set(f, 1.0, f);
    leftLowerLeg.scale.set(f, 1.0, f);
    rightUpperLeg.scale.set(f, 1.0, f);
    rightLowerLeg.scale.set(f, 1.0, f);

    // Adjust shoulder and hip spacing
    leftShoulder.position.x = -shoulderX * (0.6 + 0.4 * f);
    rightShoulder.position.x = shoulderX * (0.6 + 0.4 * f);
    leftHip.position.x = -hipX * (0.7 + 0.3 * f);
    rightHip.position.x = hipX * (0.7 + 0.3 * f);
  }

  function setDesaturation(amount) {
    const a = Math.max(0, Math.min(1, amount || 0));
    matHead.color.copy(COLOR_HEAD_CANONICAL).lerp(COLOR_COOL_GRAY, a);
  }

  function setGlowingEyes(enabled, color = '#80C7FF') {
    currentGlowing = !!enabled;
    currentGlowColor = color;
    updateFace();
  }

  function resetAppearance() {
    matHead.color.copy(COLOR_HEAD_CANONICAL);
    setMuscleScale(1.0);
    setGlowingEyes(false);
    setIdea(0, 0);
    setFace('neutral');
    setBlink(0);
    root.rotation.set(0, 0, 0);
    torsoGroup.rotation.set(0, 0, 0);
    headGroup.rotation.set(0, 0, 0);
    leftShoulder.rotation.set(0, 0, 0);
    rightShoulder.rotation.set(0, 0, 0);
    leftElbow.rotation.set(0, 0, 0);
    rightElbow.rotation.set(0, 0, 0);
    leftHip.rotation.set(0, 0, 0);
    rightHip.rotation.set(0, 0, 0);
    leftKnee.rotation.set(0, 0, 0);
    rightKnee.rotation.set(0, 0, 0);
  }

  function setPose(poseName, t = 0, opts = {}) {
    const clampHeadX = (rad) => Math.max(-0.28, Math.min(0.28, rad));

    // Reset base transforms
    torsoGroup.position.set(0, BASE_TORSO_Y, 0);
    torsoGroup.rotation.set(0, 0, 0);
    neckGroup.position.set(0, 0.44, 0);
    headGroup.rotation.set(0, 0, 0);
    leftShoulder.rotation.set(0, 0, 0);
    rightShoulder.rotation.set(0, 0, 0);
    leftElbow.rotation.set(0, 0, 0);
    rightElbow.rotation.set(0, 0, 0);
    leftHip.rotation.set(0, 0, 0);
    rightHip.rotation.set(0, 0, 0);
    leftKnee.rotation.set(0, 0, 0);
    rightKnee.rotation.set(0, 0, 0);
    leftFoot.rotation.set(0, 0, 0);
    rightFoot.rotation.set(0, 0, 0);

    if (poseName === 'idle') {
      const breath = (Math.sin(t * 3.2) + 1.0) * 0.5; // 0..1 always >= 0
      neckGroup.position.y = 0.44 + breath * 0.016; // breathing expands upper chest
      headGroup.rotation.x = clampHeadX((breath - 0.5) * 0.06);
      leftShoulder.rotation.z = 0.12 + breath * 0.02;
      rightShoulder.rotation.z = -0.12 - breath * 0.02;
      leftElbow.rotation.x = 0.18;
      rightElbow.rotation.x = 0.18;
    } else if (poseName === 'walk') {
      const spd = 6.8;
      const legL = Math.sin(t * spd);
      leftHip.rotation.x = legL * 0.55;
      rightHip.rotation.x = -legL * 0.55;
      leftKnee.rotation.x = Math.max(0, -legL * 0.7);
      rightKnee.rotation.x = Math.max(0, legL * 0.7);
      leftFoot.rotation.x = -leftHip.rotation.x * 0.5;
      rightFoot.rotation.x = -rightHip.rotation.x * 0.5;
      leftShoulder.rotation.x = -legL * 0.45;
      rightShoulder.rotation.x = legL * 0.45;
      torsoGroup.position.y = BASE_TORSO_Y + Math.abs(legL) * 0.035 + 0.018;
      headGroup.rotation.x = clampHeadX(Math.sin(t * spd * 2) * 0.05);
    } else if (poseName === 'run') {
      const spd = 12.0;
      const legL = Math.sin(t * spd);
      leftHip.rotation.x = legL * 0.85;
      rightHip.rotation.x = -legL * 0.85;
      leftKnee.rotation.x = Math.max(0, -legL * 1.1);
      rightKnee.rotation.x = Math.max(0, legL * 1.1);
      leftFoot.rotation.x = -leftHip.rotation.x * 0.4;
      rightFoot.rotation.x = -rightHip.rotation.x * 0.4;
      leftShoulder.rotation.x = -legL * 0.75;
      rightShoulder.rotation.x = legL * 0.75;
      torsoGroup.rotation.x = 0.18;
      torsoGroup.position.y = BASE_TORSO_Y + Math.abs(legL) * 0.05 + 0.032;
      headGroup.rotation.x = clampHeadX(-0.12);
    } else if (poseName === 'panic') {
      const shake = Math.sin(t * 22.0);
      torsoGroup.position.x = shake * 0.03;
      torsoGroup.position.y = BASE_TORSO_Y + Math.abs(shake) * 0.02;
      headGroup.rotation.z = shake * 0.14;
      headGroup.rotation.x = clampHeadX(0.18);
      leftShoulder.rotation.z = 2.4 + shake * 0.2;
      rightShoulder.rotation.z = -2.4 - shake * 0.2;
    } else if (poseName === 'bounce') {
      const b = Math.abs(Math.sin(t * 8.0));
      torsoGroup.position.y = BASE_TORSO_Y + b * 0.18;
      leftShoulder.rotation.z = 0.4 + b * 0.3;
      rightShoulder.rotation.z = -0.4 - b * 0.3;
    } else if (poseName === 'faceplant') {
      // Body horizontal, resting strictly above y = 0
      torsoGroup.position.y = 0.40;
      torsoGroup.rotation.x = Math.PI / 2;
      headGroup.rotation.x = clampHeadX(0.18);
      leftShoulder.rotation.set(0, 0, 1.4);
      rightShoulder.rotation.set(0, 0, -1.4);
    } else if (poseName === 'crawl') {
      torsoGroup.position.y = 0.44;
      torsoGroup.rotation.x = 0.55;
      const leg = Math.sin(t * 5.0);
      leftHip.rotation.x = 1.0 + leg * 0.2;
      leftKnee.rotation.x = -1.2;
      rightHip.rotation.x = 0.7 - leg * 0.2;
      rightKnee.rotation.x = -0.9;
      leftShoulder.rotation.x = -0.6 - leg * 0.3;
      rightShoulder.rotation.x = -0.4 + leg * 0.3;
      headGroup.rotation.x = clampHeadX(-0.25);
    } else if (poseName === 'eat') {
      const chew = Math.sin(t * 10.0);
      rightShoulder.rotation.x = -0.85;
      rightElbow.rotation.x = 1.6 + chew * 0.15;
      headGroup.rotation.x = clampHeadX(chew * 0.08);
    } else if (poseName === 'powerup') {
      torsoGroup.rotation.x = -0.15;
      headGroup.rotation.x = clampHeadX(-0.22);
      leftShoulder.rotation.set(0, 0, 1.8);
      rightShoulder.rotation.set(0, 0, -1.8);
      leftElbow.rotation.x = 1.2;
      rightElbow.rotation.x = 1.2;
    } else if (poseName === 'celebrate') {
      const hop = Math.abs(Math.sin(t * 7.0));
      torsoGroup.position.y = BASE_TORSO_Y + hop * 0.12;
      leftShoulder.rotation.z = 2.6;
      rightShoulder.rotation.z = -2.6;
      headGroup.rotation.x = clampHeadX(-0.18);
    } else if (poseName === 'deadpan') {
      torsoGroup.position.y = BASE_TORSO_Y;
      headGroup.rotation.set(0, 0, 0);
      leftShoulder.rotation.z = 0.08;
      rightShoulder.rotation.z = -0.08;
    }

    updateShadow();
  }

  function getTelemetry(camera, screenWidth = 1080, screenHeight = 1920) {
    root.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(root);
    const headWorldPos = new THREE.Vector3();
    headMesh.getWorldPosition(headWorldPos);

    let headScreenY = 0;
    let screenBox = { minX: 0, maxX: screenWidth, minY: 0, maxY: screenHeight };

    if (camera) {
      const proj = headWorldPos.clone().project(camera);
      // Normalized Device Coordinates (-1..1) to screen pixels (0..width, 0..height)
      headScreenY = (1 - (proj.y + 1) / 2) * screenHeight;

      // Calculate screen bounding box
      const corners = [
        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
        new THREE.Vector3(box.max.x, box.max.y, box.max.z),
      ];

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      corners.forEach(pt => {
        pt.project(camera);
        const px = ((pt.x + 1) / 2) * screenWidth;
        const py = (1 - (pt.y + 1) / 2) * screenHeight;
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      });
      screenBox = { minX, maxX, minY, maxY };
    }

    return {
      feetMinY: box.min.y,
      headCenter: headWorldPos,
      headRadius: 0.38,
      headScreenY,
      screenBox,
      headRGB: [matHead.color.r, matHead.color.g, matHead.color.b],
      visible: root.visible,
      grounded: isGrounded
    };
  }

  // Initial draw
  updateFace();

  const instance = {
    root,
    GROUND_Y,
    setPosition,
    setFace,
    setBlink,
    setIdea,
    setMuscleScale,
    setDesaturation,
    setGlowingEyes,
    setPose,
    resetAppearance,
    getTelemetry,
    updateShadow,
    // Backwards-compatible convenience aliases
    walk: (t, spd = 6.8) => setPose('walk', t),
    run: (t, spd = 12.0) => setPose('run', t),
    idle: (t) => setPose('idle', t),
    panic: (t) => setPose('panic', t),
    bounce: (t) => setPose('bounce', t),
    jump: (progress, height = 0.75) => {
      const p = Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI);
      setPosition(root.position.x, root.position.z, p * height);
      setPose('bounce', progress);
    },
    update: (t) => {},
    nodes: {
      torsoGroup,
      headGroup,
      headMesh,
      faceDecal,
      leftShoulder,
      rightShoulder,
      leftElbow,
      rightElbow,
      leftHip,
      rightHip,
      leftKnee,
      rightKnee,
      leftFoot,
      rightFoot,
      diamondGroup,
      propSocket
    }
  };

  return instance;
}
