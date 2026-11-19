import * as THREE from 'three';

export interface HollowWatcherRig {
  group: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  auraLight: THREE.PointLight;
  eyeMaterial: THREE.MeshStandardMaterial;
  animate: (elapsed: number, speed: number, hunting: boolean) => void;
}

// Composite 11-part procedural horror entity with bottom-center ground pivot
export function createHollowWatcher(contactShadowTex: THREE.Texture): HollowWatcherRig {
  const group = new THREE.Group();

  const fleshMat = new THREE.MeshStandardMaterial({
    color: 0x161417,
    roughness: 0.88,
    metalness: 0.08,
  });

  const chitinMat = new THREE.MeshStandardMaterial({
    color: 0x2a2426,
    roughness: 0.42,
    metalness: 0.22,
  });

  const boneMat = new THREE.MeshStandardMaterial({
    color: 0xb6aea0,
    roughness: 0.55,
    metalness: 0.05,
  });

  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffb703,
    emissive: 0xff3b1f,
    emissiveIntensity: 2.6,
    roughness: 0.2,
  });

  // Ground contact shadow
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.7),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  group.add(shadowPlane);

  // Pelvis
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.26, 8), chitinMat);
  pelvis.position.y = 1.08;
  group.add(pelvis);

  // Articulated Legs
  const createLeg = (side: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.17, 1.05, 0);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.56, 7), fleshMat);
    thigh.position.y = -0.28;
    thigh.rotation.x = -0.08;
    legPivot.add(thigh);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.035, 0.56, 7), chitinMat);
    shin.position.set(0, -0.78, 0.04);
    shin.rotation.x = 0.08;
    legPivot.add(shin);

    return legPivot;
  };

  const leftLeg = createLeg(-1);
  const rightLeg = createLeg(1);
  group.add(leftLeg, rightLeg);

  // Spine & Ribcage Torso
  const torso = new THREE.Group();
  torso.position.y = 1.2;
  group.add(torso);

  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.85, 8), fleshMat);
  spine.position.y = 0.42;
  spine.rotation.x = 0.16; // Predatory forward hunch
  torso.add(spine);

  // 3 staggered rib arches
  for (let i = 0; i < 3; i++) {
    const rib = new THREE.Mesh(
      new THREE.TorusGeometry(0.24 - i * 0.025, 0.032, 6, 12, Math.PI * 1.45),
      chitinMat
    );
    rib.position.set(0, 0.34 + i * 0.17, 0.06 + i * 0.02);
    rib.rotation.x = Math.PI / 2 + 0.18;
    rib.rotation.z = Math.PI * 0.28;
    torso.add(rib);
  }

  // Broad asymmetrical shoulder collar
  const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.18, 0.3), chitinMat);
  shoulders.position.set(0, 0.84, 0.1);
  shoulders.rotation.z = 0.06;
  torso.add(shoulders);

  // Long clawed arms
  const createArm = (side: number) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.44, 2.02, 0.1);

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.65, 7), fleshMat);
    upperArm.position.y = -0.32;
    armPivot.add(upperArm);

    const foreArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.028, 0.72, 7), chitinMat);
    foreArm.position.set(0, -0.92, 0.12);
    foreArm.rotation.x = -0.32;
    armPivot.add(foreArm);

    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.24, 5), boneMat);
    claw.position.set(0, -1.32, 0.24);
    claw.rotation.x = Math.PI - 0.35;
    armPivot.add(claw);

    return armPivot;
  };

  const leftArm = createArm(-1);
  const rightArm = createArm(1);
  group.add(leftArm, rightArm);

  // Hunched Head & Horned Skull Mask
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.18, 0.22);
  group.add(headGroup);

  const cranium = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), boneMat);
  cranium.scale.set(0.88, 1.22, 1.05);
  headGroup.add(cranium);

  const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 6), boneMat);
  jaw.position.set(0, -0.2, 0.04);
  jaw.rotation.x = Math.PI;
  headGroup.add(jaw);

  // Swept horns
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.38, 6), chitinMat);
    horn.position.set(side * 0.16, 0.25, -0.05);
    horn.rotation.z = -side * 0.45;
    horn.rotation.x = -0.3;
    headGroup.add(horn);
  }

  // Glowing recessed eyes
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), eyeMaterial);
    eye.position.set(side * 0.08, 0.03, 0.19);
    headGroup.add(eye);
  }

  const auraLight = new THREE.PointLight(0xdc2626, 1.4, 7, 2);
  auraLight.position.set(0, 2.1, 0.35);
  group.add(auraLight);

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh && obj !== shadowPlane) {
      obj.castShadow = true;
    }
  });

  const animate = (elapsed: number, speed: number, hunting: boolean) => {
    const strideFreq = hunting ? 9.5 : 4.6;
    const amp = Math.min(1, speed / 3.5);
    const swing = Math.sin(elapsed * strideFreq) * 0.55 * amp;

    leftLeg.rotation.x = swing;
    rightLeg.rotation.x = -swing;

    leftArm.rotation.x = -swing * 0.85 - (hunting ? 0.55 : 0.15);
    rightArm.rotation.x = swing * 0.85 - (hunting ? 0.55 : 0.15);
    leftArm.rotation.z = -0.1 - Math.sin(elapsed * 2.1) * 0.06;
    rightArm.rotation.z = 0.1 + Math.sin(elapsed * 2.1) * 0.06;

    // Twitching unnatural head tilt
    headGroup.rotation.z = Math.sin(elapsed * (hunting ? 7.5 : 1.7)) * (hunting ? 0.18 : 0.09);
    headGroup.rotation.x = (hunting ? 0.08 : 0.22) + Math.cos(elapsed * 2.4) * 0.06;

    eyeMaterial.emissiveIntensity = hunting ? 3.8 + Math.sin(elapsed * 22) * 0.7 : 2.2;
    auraLight.intensity = hunting ? 2.6 + Math.sin(elapsed * 16) * 0.5 : 0.9;
  };

  return {
    group,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    auraLight,
    eyeMaterial,
    animate,
  };
}

export interface BreakerEntity {
  id: string;
  sector: string;
  group: THREE.Group;
  colliderMesh: THREE.Mesh;
  leverPivot: THREE.Group;
  beaconLight: THREE.PointLight;
  bulbMat: THREE.MeshStandardMaterial;
  activated: boolean;
  setActivated: (state: boolean) => void;
}

export function createBreakerBox(id: string, sector: string): BreakerEntity {
  const group = new THREE.Group();

  const casingMat = new THREE.MeshStandardMaterial({
    color: 0x3b4148,
    roughness: 0.55,
    metalness: 0.65,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1e2226,
    roughness: 0.75,
    metalness: 0.4,
  });

  const handleMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.4,
    metalness: 0.2,
  });

  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });

  // Grounded steel pedestal + wall cabinet
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.35, 0.36), trimMat);
  pedestal.position.y = 0.675;
  group.add(pedestal);

  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.95, 0.42), casingMat);
  housing.position.y = 1.55;
  group.add(housing);

  // Conduit pipes flanking box
  for (const sx of [-0.24, 0.24]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.2, 8), casingMat);
    pipe.position.set(sx, 2.5, -0.05);
    group.add(pipe);
  }

  // Indicator bulb dome on top
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), bulbMat);
  bulb.position.set(0, 2.1, 0.14);
  group.add(bulb);

  const beaconLight = new THREE.PointLight(0xef4444, 1.6, 6.5, 2);
  beaconLight.position.set(0, 2.25, 0.35);
  group.add(beaconLight);

  // Heavy side lever
  const leverPivot = new THREE.Group();
  leverPivot.position.set(0.42, 1.55, 0.05);
  leverPivot.rotation.x = -0.65; // Down/Off position
  group.add(leverPivot);

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 8), casingMat);
  arm.position.y = 0.21;
  leverPivot.add(arm);

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 8), handleMat);
  grip.rotation.z = Math.PI / 2;
  grip.position.set(0.04, 0.42, 0);
  leverPivot.add(grip);

  // Simplified invisible interaction box
  const colliderMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 2.2, 0.8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  colliderMesh.position.y = 1.3;
  colliderMesh.userData = { interactType: 'breaker', interactId: id };
  group.add(colliderMesh);

  const setActivated = (state: boolean) => {
    entity.activated = state;
    leverPivot.rotation.x = state ? 0.65 : -0.65;
    if (state) {
      bulbMat.color.setHex(0x22c55e);
      bulbMat.emissive.setHex(0x16a34a);
      beaconLight.color.setHex(0x22c55e);
      beaconLight.intensity = 2.1;
    } else {
      bulbMat.color.setHex(0xef4444);
      bulbMat.emissive.setHex(0xdc2626);
      beaconLight.color.setHex(0xef4444);
      beaconLight.intensity = 1.6;
    }
  };

  const entity: BreakerEntity = {
    id,
    sector,
    group,
    colliderMesh,
    leverPivot,
    beaconLight,
    bulbMat,
    activated: false,
    setActivated,
  };

  return entity;
}

export function createBatteryPickup(id: string): { group: THREE.Group; colliderMesh: THREE.Mesh } {
  const group = new THREE.Group();

  // Small crate base so battery rests at reachable waist height
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.52, 0.65),
    new THREE.MeshStandardMaterial({ color: 0x2a2723, roughness: 0.88, metalness: 0.1 })
  );
  crate.position.y = 0.26;
  group.add(crate);

  const batteryGroup = new THREE.Group();
  batteryGroup.position.y = 0.56;
  group.add(batteryGroup);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.26, 12),
    new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.35, metalness: 0.75 })
  );
  body.position.y = 0.13;
  batteryGroup.add(body);

  const copperCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.088, 0.088, 0.06, 12),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.28, metalness: 0.85 })
  );
  copperCap.position.y = 0.25;
  batteryGroup.add(copperCap);

  const glowRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.09, 0.012, 8, 16),
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.8,
    })
  );
  glowRing.rotation.x = Math.PI / 2;
  glowRing.position.y = 0.19;
  batteryGroup.add(glowRing);

  const colliderMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.0, 0.8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  colliderMesh.position.y = 0.55;
  colliderMesh.userData = { interactType: 'battery', interactId: id, visual: batteryGroup };
  group.add(colliderMesh);

  return { group, colliderMesh };
}

export function createFieldNoteMesh(id: string, paperTex: THREE.Texture): { group: THREE.Group; colliderMesh: THREE.Mesh } {
  const group = new THREE.Group();

  // Metal table stand
  const stand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.18, 0.82, 8),
    new THREE.MeshStandardMaterial({ color: 0x26292e, roughness: 0.65, metalness: 0.55 })
  );
  stand.position.y = 0.41;
  group.add(stand);

  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.05, 0.46),
    new THREE.MeshStandardMaterial({ color: 0x33383e, roughness: 0.6, metalness: 0.5 })
  );
  tray.position.y = 0.84;
  tray.rotation.x = 0.14;
  group.add(tray);

  const paper = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.015, 0.4),
    new THREE.MeshStandardMaterial({
      map: paperTex,
      roughness: 0.85,
      emissive: 0x3b3324,
      emissiveIntensity: 0.35,
    })
  );
  paper.position.set(0, 0.875, 0);
  paper.rotation.x = 0.14;
  paper.rotation.y = 0.08;
  group.add(paper);

  const colliderMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 1.2, 0.75),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  colliderMesh.position.y = 0.65;
  colliderMesh.userData = { interactType: 'note', interactId: id, visual: paper };
  group.add(colliderMesh);

  return { group, colliderMesh };
}

export interface ExitElevatorEntity {
  group: THREE.Group;
  colliderMesh: THREE.Mesh;
  beaconLight: THREE.PointLight;
  beaconMat: THREE.MeshStandardMaterial;
  leftDoor: THREE.Mesh;
  rightDoor: THREE.Mesh;
  setPowered: (powered: boolean) => void;
}

export function createExitElevator(doorTex: THREE.Texture): ExitElevatorEntity {
  const group = new THREE.Group();

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x272b30,
    roughness: 0.45,
    metalness: 0.75,
  });

  const doorMat = new THREE.MeshStandardMaterial({
    map: doorTex,
    roughness: 0.5,
    metalness: 0.6,
  });

  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xb91c1c,
    emissiveIntensity: 2.2,
  });

  // Left/Right/Top steel frame pillars
  for (const sx of [-1.25, 1.25]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 3.2, 0.42), frameMat);
    pillar.position.set(sx, 1.6, 0);
    group.add(pillar);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.82, 0.42, 0.48), frameMat);
  lintel.position.set(0, 3.2, 0);
  group.add(lintel);

  // Double heavy doors
  const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.9, 0.12), doorMat);
  leftDoor.position.set(-0.55, 1.45, 0);
  group.add(leftDoor);

  const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.9, 0.12), doorMat);
  rightDoor.position.set(0.55, 1.45, 0);
  group.add(rightDoor);

  // Overhead signal lamp
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.22, 12), beaconMat);
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(0, 3.22, 0.26);
  group.add(lamp);

  const beaconLight = new THREE.PointLight(0xef4444, 2.2, 10, 2);
  beaconLight.position.set(0, 3.1, 0.8);
  group.add(beaconLight);

  const colliderMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 2.8, 0.9),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  colliderMesh.position.set(0, 1.4, 0.2);
  colliderMesh.userData = { interactType: 'elevator', interactId: 'exit-elevator' };
  group.add(colliderMesh);

  const setPowered = (powered: boolean) => {
    if (powered) {
      beaconMat.color.setHex(0x22c55e);
      beaconMat.emissive.setHex(0x16a34a);
      beaconLight.color.setHex(0x22c55e);
      beaconLight.intensity = 3.2;
      leftDoor.position.x = -1.02;
      rightDoor.position.x = 1.02;
    } else {
      beaconMat.color.setHex(0xef4444);
      beaconMat.emissive.setHex(0xb91c1c);
      beaconLight.color.setHex(0xef4444);
      beaconLight.intensity = 2.2;
      leftDoor.position.x = -0.55;
      rightDoor.position.x = 0.55;
    }
  };

  return {
    group,
    colliderMesh,
    beaconLight,
    beaconMat,
    leftDoor,
    rightDoor,
    setPowered,
  };
}

export function createCryoPod(): THREE.Group {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1f2428, roughness: 0.45, metalness: 0.75 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x164e63,
    emissive: 0x083344,
    emissiveIntensity: 0.9,
    roughness: 0.15,
    metalness: 0.2,
    transparent: true,
    opacity: 0.65,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.35, 14), baseMat);
  base.position.y = 0.175;
  group.add(base);

  const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 2.1, 14), glassMat);
  chamber.position.y = 1.38;
  group.add(chamber);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.52, 0.32, 14), baseMat);
  cap.position.y = 2.55;
  group.add(cap);

  return group;
}
