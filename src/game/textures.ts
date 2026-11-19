import * as THREE from 'three';

export interface ProceduralTextureSet {
  wallColor: THREE.CanvasTexture;
  wallRoughness: THREE.CanvasTexture;
  floorColor: THREE.CanvasTexture;
  floorRoughness: THREE.CanvasTexture;
  ceilingColor: THREE.CanvasTexture;
  metalDoorColor: THREE.CanvasTexture;
  notePaperColor: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const rand = seededRand(40917);

  // 1. Concrete Wall Color & Roughness (512x512)
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = 512;
  wallCanvas.height = 512;
  const wCtx = wallCanvas.getContext('2d')!;

  wCtx.fillStyle = '#2c3034';
  wCtx.fillRect(0, 0, 512, 512);

  // Concrete mottling
  for (let i = 0; i < 3600; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 2 + rand() * 14;
    const shade = Math.floor(32 + rand() * 26);
    wCtx.fillStyle = `rgba(${shade}, ${shade + 2}, ${shade + 4}, 0.16)`;
    wCtx.fillRect(x, y, r, r);
  }

  // Vertical damp streaks & rust stains
  for (let i = 0; i < 24; i++) {
    const x = rand() * 512;
    const w = 4 + rand() * 16;
    const h = 120 + rand() * 340;
    const grad = wCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(20, 14, 10, 0.35)');
    grad.addColorStop(0.6, 'rgba(38, 22, 14, 0.18)');
    grad.addColorStop(1, 'rgba(20, 14, 10, 0)');
    wCtx.fillStyle = grad;
    wCtx.fillRect(x, 0, w, h);
  }

  // Lower baseboard grime band
  const grimeGrad = wCtx.createLinearGradient(0, 380, 0, 512);
  grimeGrad.addColorStop(0, 'rgba(12, 13, 14, 0)');
  grimeGrad.addColorStop(1, 'rgba(10, 11, 12, 0.72)');
  wCtx.fillStyle = grimeGrad;
  wCtx.fillRect(0, 380, 512, 132);

  // Panel seams
  wCtx.strokeStyle = 'rgba(10, 12, 14, 0.65)';
  wCtx.lineWidth = 3;
  for (let x = 0; x <= 512; x += 128) {
    wCtx.beginPath();
    wCtx.moveTo(x, 0);
    wCtx.lineTo(x, 512);
    wCtx.stroke();
  }
  wCtx.beginPath();
  wCtx.moveTo(0, 256);
  wCtx.lineTo(512, 256);
  wCtx.stroke();

  // Subtle faded bunker stripe
  wCtx.fillStyle = 'rgba(130, 88, 36, 0.28)';
  wCtx.fillRect(0, 240, 512, 12);

  const wallColor = new THREE.CanvasTexture(wallCanvas);
  wallColor.colorSpace = THREE.SRGBColorSpace;
  wallColor.wrapS = THREE.RepeatWrapping;
  wallColor.wrapT = THREE.RepeatWrapping;
  wallColor.anisotropy = maxAnisotropy;

  // Wall roughness (linear)
  const wallRoughCanvas = document.createElement('canvas');
  wallRoughCanvas.width = 256;
  wallRoughCanvas.height = 256;
  const wrCtx = wallRoughCanvas.getContext('2d')!;
  wrCtx.fillStyle = '#d4d4d4';
  wrCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    const v = Math.floor(155 + rand() * 90);
    wrCtx.fillStyle = `rgb(${v},${v},${v})`;
    wrCtx.fillRect(rand() * 256, rand() * 256, 4 + rand() * 10, 4 + rand() * 10);
  }
  const wallRoughness = new THREE.CanvasTexture(wallRoughCanvas);
  wallRoughness.wrapS = THREE.RepeatWrapping;
  wallRoughness.wrapT = THREE.RepeatWrapping;

  // 2. Industrial Floor Tiles & Grime (512x512)
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 512;
  floorCanvas.height = 512;
  const fCtx = floorCanvas.getContext('2d')!;
  fCtx.fillStyle = '#1e2124';
  fCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 3000; i++) {
    const shade = Math.floor(20 + rand() * 22);
    fCtx.fillStyle = `rgba(${shade}, ${shade + 2}, ${shade + 3}, 0.2)`;
    fCtx.fillRect(rand() * 512, rand() * 512, 3 + rand() * 12, 3 + rand() * 12);
  }

  // Tile joints
  fCtx.strokeStyle = 'rgba(8, 9, 10, 0.78)';
  fCtx.lineWidth = 4;
  for (let g = 0; g <= 512; g += 128) {
    fCtx.beginPath();
    fCtx.moveTo(g, 0);
    fCtx.lineTo(g, 512);
    fCtx.stroke();
    fCtx.beginPath();
    fCtx.moveTo(0, g);
    fCtx.lineTo(512, g);
    fCtx.stroke();
  }

  // Subtle metallic tread dots
  fCtx.fillStyle = 'rgba(65, 72, 78, 0.22)';
  for (let x = 16; x < 512; x += 32) {
    for (let y = 16; y < 512; y += 32) {
      fCtx.fillRect(x - 2, y - 1, 4, 2);
    }
  }

  const floorColor = new THREE.CanvasTexture(floorCanvas);
  floorColor.colorSpace = THREE.SRGBColorSpace;
  floorColor.wrapS = THREE.RepeatWrapping;
  floorColor.wrapT = THREE.RepeatWrapping;
  floorColor.repeat.set(19, 19);
  floorColor.anisotropy = maxAnisotropy;

  // Floor roughness (damp patches = darker/shinier)
  const floorRoughCanvas = document.createElement('canvas');
  floorRoughCanvas.width = 256;
  floorRoughCanvas.height = 256;
  const frCtx = floorRoughCanvas.getContext('2d')!;
  frCtx.fillStyle = '#c8c8c8';
  frCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 28; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const rad = 16 + rand() * 36;
    const g = frCtx.createRadialGradient(x, y, 2, x, y, rad);
    g.addColorStop(0, 'rgba(45, 45, 45, 0.75)');
    g.addColorStop(1, 'rgba(180, 180, 180, 0)');
    frCtx.fillStyle = g;
    frCtx.beginPath();
    frCtx.arc(x, y, rad, 0, Math.PI * 2);
    frCtx.fill();
  }
  const floorRoughness = new THREE.CanvasTexture(floorRoughCanvas);
  floorRoughness.wrapS = THREE.RepeatWrapping;
  floorRoughness.wrapT = THREE.RepeatWrapping;
  floorRoughness.repeat.set(19, 19);

  // 3. Ceiling Panel Texture (256x256)
  const ceilCanvas = document.createElement('canvas');
  ceilCanvas.width = 256;
  ceilCanvas.height = 256;
  const cCtx = ceilCanvas.getContext('2d')!;
  cCtx.fillStyle = '#15171a';
  cCtx.fillRect(0, 0, 256, 256);
  cCtx.strokeStyle = '#0b0c0e';
  cCtx.lineWidth = 4;
  for (let i = 0; i <= 256; i += 64) {
    cCtx.strokeRect(i, 0, 64, 256);
    cCtx.strokeRect(0, i, 256, 64);
  }
  const ceilingColor = new THREE.CanvasTexture(ceilCanvas);
  ceilingColor.colorSpace = THREE.SRGBColorSpace;
  ceilingColor.wrapS = THREE.RepeatWrapping;
  ceilingColor.wrapT = THREE.RepeatWrapping;
  ceilingColor.repeat.set(19, 19);

  // 4. Metal Door / Elevator Gate Texture (256x256)
  const doorCanvas = document.createElement('canvas');
  doorCanvas.width = 256;
  doorCanvas.height = 256;
  const dCtx = doorCanvas.getContext('2d')!;
  dCtx.fillStyle = '#2e3338';
  dCtx.fillRect(0, 0, 256, 256);
  // Hazard stripe band at bottom
  dCtx.fillStyle = '#926018';
  dCtx.fillRect(0, 208, 256, 24);
  dCtx.fillStyle = '#16181a';
  for (let x = -32; x < 280; x += 32) {
    dCtx.beginPath();
    dCtx.moveTo(x, 208);
    dCtx.lineTo(x + 16, 208);
    dCtx.lineTo(x + 4, 232);
    dCtx.lineTo(x - 12, 232);
    dCtx.closePath();
    dCtx.fill();
  }
  dCtx.strokeStyle = '#17191c';
  dCtx.lineWidth = 6;
  dCtx.strokeRect(12, 12, 232, 232);
  const metalDoorColor = new THREE.CanvasTexture(doorCanvas);
  metalDoorColor.colorSpace = THREE.SRGBColorSpace;
  metalDoorColor.anisotropy = maxAnisotropy;

  // 5. Field Note Paper Texture (256x256)
  const noteCanvas = document.createElement('canvas');
  noteCanvas.width = 256;
  noteCanvas.height = 256;
  const nCtx = noteCanvas.getContext('2d')!;
  nCtx.fillStyle = '#d8cfb8';
  nCtx.fillRect(0, 0, 256, 256);
  nCtx.fillStyle = 'rgba(40, 35, 30, 0.55)';
  for (let y = 36; y < 220; y += 16) {
    nCtx.fillRect(28, y, 130 + rand() * 70, 3);
  }
  const notePaperColor = new THREE.CanvasTexture(noteCanvas);
  notePaperColor.colorSpace = THREE.SRGBColorSpace;

  // 6. Soft Contact Shadow Texture (128x128)
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sCtx = shadowCanvas.getContext('2d')!;
  const sg = sCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  sg.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  sg.addColorStop(0.6, 'rgba(0, 0, 0, 0.28)');
  sg.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sCtx.fillStyle = sg;
  sCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shadowCanvas);

  return {
    wallColor,
    wallRoughness,
    floorColor,
    floorRoughness,
    ceilingColor,
    metalDoorColor,
    notePaperColor,
    contactShadow,
    dispose: () => {
      wallColor.dispose();
      wallRoughness.dispose();
      floorColor.dispose();
      floorRoughness.dispose();
      ceilingColor.dispose();
      metalDoorColor.dispose();
      notePaperColor.dispose();
      contactShadow.dispose();
    },
  };
}
