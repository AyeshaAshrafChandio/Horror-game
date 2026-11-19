import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HorrorAudioEngine } from './audio';
import {
  BreakerEntity,
  ExitElevatorEntity,
  HollowWatcherRig,
  createBatteryPickup,
  createBreakerBox,
  createCryoPod,
  createExitElevator,
  createFieldNoteMesh,
  createHollowWatcher,
} from './entities';
import {
  BATTERY_PLACEMENTS,
  BREAKER_PLACEMENTS,
  BUNKER_GRID,
  CELL_SIZE,
  ELEVATOR_CELL,
  EMERGENCY_LIGHTS,
  GRID_SIZE,
  GridCoord,
  NOTE_PLACEMENTS,
  PLAYER_SPAWN,
  STALKER_SPAWN,
  WALL_HEIGHT,
  cellToWorld,
  findNextPathCell,
  getAllOpenCells,
  getSectorName,
  hasLineOfSight,
  isWall,
  worldToCell,
} from './map';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import { DifficultyMode, FieldNoteData, GameHUDState, GamePhase, InteractPrompt, RunSummary } from './types';

// Pre-allocated math helpers for zero-GC animation loop
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _screenCenter = new THREE.Vector2(0, 0);
const _raycaster = new THREE.Raycaster();

export class HorrorEngine {
  private container: HTMLElement;
  private onHudUpdate: (hud: GameHUDState) => void;
  private onRunEnd: (summary: RunSummary) => void;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private textures!: ProceduralTextureSet;
  private audio = new HorrorAudioEngine();
  private isSoftwareGl = false;

  private frameId = 0;
  private disposed = false;
  private lastTimestamp = 0;
  private clockElapsed = 0;
  private hudEmitAccum = 0;

  // Game State
  private phase: GamePhase = 'title';
  private difficulty: DifficultyMode = 'standard';
  private runElapsed = 0;
  private bannerTimer = 0;
  private statusBanner: string | null = null;
  private caughtAnimTimer = 0;

  // Player State
  private playerPos = new THREE.Vector3();
  private yaw = Math.PI; // Facing +Z down corridor
  private pitch = 0;
  private eyeHeight = 1.68;
  private bobPhase = 0;
  private stamina = 100;
  private battery = 100;
  private flashlightOn = true;
  private crouching = false;
  private pointerLocked = false;
  private isDraggingLook = false;
  private lastDragX = 0;
  private lastDragY = 0;

  // Flashlight & Flicker Lights
  private flashlight!: THREE.SpotLight;
  private flashlightTarget = new THREE.Object3D();
  private emergencyPointLights: Array<{ light: THREE.PointLight; baseIntensity: number; seed: number }> = [];

  // Interactive Entities
  private breakers: BreakerEntity[] = [];
  private batteries = new Map<string, { group: THREE.Group; collider: THREE.Mesh; collected: boolean }>();
  private notes = new Map<string, { group: THREE.Group; collider: THREE.Mesh; data: FieldNoteData; collected: boolean }>();
  private interactColliders: THREE.Object3D[] = [];
  private elevator!: ExitElevatorEntity;
  private activePrompt: InteractPrompt | null = null;
  private activeNote: FieldNoteData | null = null;

  // Stalker AI
  private watcher!: HollowWatcherRig;
  private stalkerPos = new THREE.Vector3();
  private stalkerYaw = 0;
  private stalkerState: 'patrol' | 'investigate' | 'hunt' = 'patrol';
  private stalkerTargetCell: GridCoord = { row: 11, col: 9 };
  private stalkerAlertCooldown = 0;
  private stalkerInvestigateTimer = 0;
  private openCells: GridCoord[] = [];
  private dreadLevel = 0;

  // Input
  private keys: Record<string, boolean> = {};
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchSprint = false;
  private touchControlsActive = false;
  private webglError: string | null = null;

  constructor(
    container: HTMLElement,
    onHudUpdate: (hud: GameHUDState) => void,
    onRunEnd: (summary: RunSummary) => void
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onRunEnd = onRunEnd;
    this.openCells = getAllOpenCells();

    this.initScene();
    if (!this.webglError) {
      this.bindEvents();
      this.resetEntities();
      this.lastTimestamp = performance.now();
      this.scheduleNextFrame();
    }
    this.emitHud();
  }

  private detectSoftwareGl(): boolean {
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private initScene(): void {
    this.isSoftwareGl = this.detectSoftwareGl();

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      this.webglError = 'WebGL rendering is unavailable in this browser.';
      return;
    }

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050608);
    this.scene.fog = new THREE.FogExp2(0x050608, 0.085);

    this.camera = new THREE.PerspectiveCamera(70, width / height, 0.08, 60);
    this.camera.rotation.order = 'YXZ';

    // Studio environment reflection for metallic conduits, breaker boxes, and wet floors
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Subtle cool-dim hemisphere fill so shadows retain architectural depth
    const hemi = new THREE.HemisphereLight(0x283548, 0x0c0b0d, 0.28);
    this.scene.add(hemi);

    // Player Flashlight
    this.flashlight = new THREE.SpotLight(0xfff1d6, 14, 28, Math.PI / 4.4, 0.52, 1.5);
    this.flashlight.castShadow = !this.isSoftwareGl;
    this.flashlight.shadow.mapSize.width = 1024;
    this.flashlight.shadow.mapSize.height = 1024;
    this.flashlight.shadow.camera.near = 0.2;
    this.flashlight.shadow.camera.far = 28;
    this.flashlight.shadow.bias = -0.0005;
    this.scene.add(this.flashlight);
    this.scene.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);

    this.buildBunkerArchitecture();
    this.buildEntities();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private buildBunkerArchitecture(): void {
    const totalSpan = GRID_SIZE * CELL_SIZE;

    // Floor
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.textures.floorColor,
      roughnessMap: this.textures.floorRoughness,
      roughness: 0.78,
      metalness: 0.18,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(totalSpan, totalSpan), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Ceiling
    const ceilMat = new THREE.MeshStandardMaterial({
      map: this.textures.ceilingColor,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(totalSpan, totalSpan), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = WALL_HEIGHT;
    this.scene.add(ceiling);

    // Instanced Concrete Walls
    const wallCells: GridCoord[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (BUNKER_GRID[r][c] === '#') {
          wallCells.push({ row: r, col: c });
        }
      }
    }

    const wallMat = new THREE.MeshStandardMaterial({
      map: this.textures.wallColor,
      roughnessMap: this.textures.wallRoughness,
      roughness: 0.85,
      metalness: 0.08,
    });

    const wallGeo = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
    const wallInstances = new THREE.InstancedMesh(wallGeo, wallMat, wallCells.length);
    wallInstances.castShadow = true;
    wallInstances.receiveShadow = true;

    const dummy = new THREE.Object3D();
    wallCells.forEach((cell, idx) => {
      const { x, z } = cellToWorld(cell.row, cell.col);
      dummy.position.set(x, WALL_HEIGHT / 2, z);
      dummy.updateMatrix();
      wallInstances.setMatrixAt(idx, dummy.matrix);
    });
    wallInstances.instanceMatrix.needsUpdate = true;
    wallInstances.computeBoundingSphere();
    this.scene.add(wallInstances);

    // Overhead conduit pipes running along central shaft & service spine
    const pipeMat = new THREE.MeshStandardMaterial({
      color: 0x2f353b,
      roughness: 0.4,
      metalness: 0.78,
    });
    const spinePipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, totalSpan - 8, 10),
      pipeMat
    );
    spinePipe.rotation.z = Math.PI / 2;
    const spineZ = cellToWorld(11, 9).z;
    spinePipe.position.set(0, WALL_HEIGHT - 0.28, spineZ);
    this.scene.add(spinePipe);

    const centralPipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, totalSpan - 8, 10),
      pipeMat
    );
    centralPipe.rotation.x = Math.PI / 2;
    centralPipe.position.set(0, WALL_HEIGHT - 0.3, 0);
    this.scene.add(centralPipe);

    // Cryo Hall containment pods
    const cryoPositions: GridCoord[] = [
      { row: 1, col: 14 },
      { row: 1, col: 16 },
      { row: 3, col: 14 },
    ];
    for (const cp of cryoPositions) {
      const pod = createCryoPod();
      const { x, z } = cellToWorld(cp.row, cp.col);
      pod.position.set(x + 1.1, 0, z - 0.9);
      this.scene.add(pod);
    }

    // Emergency wall sconces
    const sconceBulbMat = new THREE.MeshStandardMaterial({
      color: 0xfca5a5,
      emissive: 0xb91c1c,
      emissiveIntensity: 1.5,
    });

    for (let i = 0; i < EMERGENCY_LIGHTS.length; i++) {
      const spec = EMERGENCY_LIGHTS[i];
      const { x, z } = cellToWorld(spec.row, spec.col);
      const light = new THREE.PointLight(spec.color, spec.intensity, 12, 2);
      light.position.set(x, WALL_HEIGHT - 0.55, z);
      this.scene.add(light);

      const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.32), sconceBulbMat);
      fixture.position.set(x, WALL_HEIGHT - 0.08, z);
      this.scene.add(fixture);

      this.emergencyPointLights.push({
        light,
        baseIntensity: spec.intensity,
        seed: i * 17.3 + 1.1,
      });
    }
  }

  private buildEntities(): void {
    // Exit Elevator at North Vestibule
    this.elevator = createExitElevator(this.textures.metalDoorColor);
    const elevWorld = cellToWorld(ELEVATOR_CELL.row, ELEVATOR_CELL.col);
    this.elevator.group.position.set(elevWorld.x, 0, elevWorld.z - 1.65);
    this.scene.add(this.elevator.group);
    this.interactColliders.push(this.elevator.colliderMesh);

    // 4 Breakers
    for (const bp of BREAKER_PLACEMENTS) {
      const breaker = createBreakerBox(bp.id, bp.sector);
      const { x, z } = cellToWorld(bp.row, bp.col);
      const offset = 1.45;
      if (bp.facing === 'east') {
        breaker.group.position.set(x - offset, 0, z);
        breaker.group.rotation.y = Math.PI / 2;
      } else if (bp.facing === 'west') {
        breaker.group.position.set(x + offset, 0, z);
        breaker.group.rotation.y = -Math.PI / 2;
      } else if (bp.facing === 'south') {
        breaker.group.position.set(x, 0, z - offset);
      } else {
        breaker.group.position.set(x, 0, z + offset);
        breaker.group.rotation.y = Math.PI;
      }
      this.scene.add(breaker.group);
      this.breakers.push(breaker);
      this.interactColliders.push(breaker.colliderMesh);
    }

    // 6 Batteries
    for (const bat of BATTERY_PLACEMENTS) {
      const { group, colliderMesh } = createBatteryPickup(bat.id);
      const { x, z } = cellToWorld(bat.row, bat.col);
      group.position.set(x + 0.65, 0, z + 0.55);
      this.scene.add(group);
      this.batteries.set(bat.id, { group, collider: colliderMesh, collected: false });
      this.interactColliders.push(colliderMesh);
    }

    // 5 Field Notes
    for (const np of NOTE_PLACEMENTS) {
      const { group, colliderMesh } = createFieldNoteMesh(np.id, this.textures.notePaperColor);
      const { x, z } = cellToWorld(np.row, np.col);
      group.position.set(x - 0.8, 0, z - 0.6);
      this.scene.add(group);
      this.notes.set(np.id, { group, collider: colliderMesh, data: np.note, collected: false });
      this.interactColliders.push(colliderMesh);
    }

    // Hollow Watcher Stalker
    this.watcher = createHollowWatcher(this.textures.contactShadow);
    this.scene.add(this.watcher.group);
  }

  private resetEntities(): void {
    const pStart = cellToWorld(PLAYER_SPAWN.row, PLAYER_SPAWN.col);
    this.playerPos.set(pStart.x, 0, pStart.z);
    this.yaw = Math.PI; // Looking South down central corridor
    this.pitch = 0;
    this.eyeHeight = 1.68;
    this.stamina = 100;
    this.battery = 100;
    this.flashlightOn = true;
    this.crouching = false;
    this.runElapsed = 0;
    this.dreadLevel = 0;
    this.activePrompt = null;
    this.activeNote = null;
    this.caughtAnimTimer = 0;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.touchSprint = false;

    for (const b of this.breakers) {
      b.setActivated(false);
    }
    this.elevator.setPowered(false);

    this.batteries.forEach((bat) => {
      bat.collected = false;
      bat.group.visible = true;
    });

    this.notes.forEach((n) => {
      n.collected = false;
      n.group.visible = true;
    });

    const sStart = cellToWorld(STALKER_SPAWN.row, STALKER_SPAWN.col);
    this.stalkerPos.set(sStart.x, 0, sStart.z);
    this.stalkerYaw = 0;
    this.stalkerState = 'patrol';
    this.stalkerTargetCell = { row: 11, col: 9 };
    this.stalkerAlertCooldown = 0;
    this.stalkerInvestigateTimer = 0;
    this.watcher.group.position.copy(this.stalkerPos);
  }

  public startNewGame(difficulty: DifficultyMode): void {
    this.audio.unlock();
    this.difficulty = difficulty;
    this.resetEntities();
    this.phase = 'playing';
    this.showBanner('Restore all 4 corner breakers to power the North Exit Lift.', 5.5);
    this.requestPointerLockSafe();
    this.emitHud();
  }

  public setDifficulty(difficulty: DifficultyMode): void {
    this.difficulty = difficulty;
    this.emitHud();
  }

  public resumeGame(): void {
    this.audio.unlock();
    if (this.phase === 'paused' || this.phase === 'note') {
      this.activeNote = null;
      this.phase = 'playing';
      this.requestPointerLockSafe();
      this.emitHud();
    }
  }

  public pauseGame(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.exitPointerLockSafe();
      this.emitHud();
    }
  }

  public returnToTitle(): void {
    this.exitPointerLockSafe();
    this.resetEntities();
    this.phase = 'title';
    this.emitHud();
  }

  public setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  public isMuted(): boolean {
    return this.audio.isMuted();
  }

  public setTouchControlsActive(active: boolean): void {
    this.touchControlsActive = active;
    if (active) {
      this.exitPointerLockSafe();
    } else {
      this.touchMoveX = 0;
      this.touchMoveY = 0;
      this.touchSprint = false;
    }
  }

  public setTouchMove(x: number, y: number): void {
    this.audio.unlock();
    this.touchMoveX = THREE.MathUtils.clamp(x, -1, 1);
    this.touchMoveY = THREE.MathUtils.clamp(y, -1, 1);
  }

  public setTouchSprint(active: boolean): void {
    this.touchSprint = active;
  }

  public addLookDelta(dx: number, dy: number): void {
    if (this.phase !== 'playing') return;
    this.audio.unlock();
    this.yaw -= dx * 0.005;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0042, -1.25, 1.25);
  }

  public toggleFlashlight(): void {
    if (this.phase !== 'playing') return;
    this.audio.unlock();
    if (this.battery > 0) {
      this.flashlightOn = !this.flashlightOn;
      this.audio.playFlashlightClick(this.flashlightOn);
      this.emitHud();
    }
  }

  public toggleCrouch(): void {
    if (this.phase !== 'playing') return;
    this.audio.unlock();
    this.crouching = !this.crouching;
    this.emitHud();
  }

  public interact(): void {
    if (this.phase !== 'playing') return;
    this.audio.unlock();
    this.tryInteract();
  }

  public requestPointerLockSafe(): void {
    if (this.touchControlsActive) return;
    try {
      const canvas = this.renderer?.domElement;
      if (canvas && document.pointerLockElement !== canvas) {
        const res = canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      }
    } catch {
      // Fallback drag look remains active
    }
  }

  private exitPointerLockSafe(): void {
    try {
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    } catch {
      // Ignore
    }
  }

  private showBanner(text: string, duration = 4): void {
    this.statusBanner = text;
    this.bannerTimer = duration;
    this.emitHud();
  }

  private bindEvents(): void {
    const canvas = this.renderer.domElement;

    const onResize = () => {
      if (this.disposed) return;
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      this.keys[e.code] = true;

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.phase === 'note') {
          this.resumeGame();
        } else if (this.phase === 'playing') {
          this.pauseGame();
        } else if (this.phase === 'paused') {
          this.resumeGame();
        }
        return;
      }

      if (this.phase !== 'playing') return;

      if (e.code === 'KeyF') {
        if (this.battery > 0) {
          this.flashlightOn = !this.flashlightOn;
          this.audio.playFlashlightClick(this.flashlightOn);
          this.emitHud();
        }
      } else if (e.code === 'KeyC') {
        this.crouching = !this.crouching;
        this.emitHud();
      } else if (e.code === 'KeyE') {
        this.tryInteract();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keys[e.code] = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (this.phase !== 'playing') return;
      if (document.pointerLockElement === canvas) {
        this.yaw -= e.movementX * 0.0022;
        this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.002, -1.25, 1.25);
      } else if (this.isDraggingLook) {
        const dx = e.clientX - this.lastDragX;
        const dy = e.clientY - this.lastDragY;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
        this.yaw -= dx * 0.0042;
        this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0036, -1.25, 1.25);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (this.phase !== 'playing') return;
      this.audio.unlock();
      if (e.target === canvas) {
        this.isDraggingLook = true;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
        if (document.pointerLockElement !== canvas) {
          this.requestPointerLockSafe();
        }
        if (this.activePrompt) {
          this.tryInteract();
        }
      }
    };

    const onMouseUp = () => {
      this.isDraggingLook = false;
    };

    const onPointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      this.emitHud();
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
      this.webglError = 'Graphics context was interrupted. Attempting recovery...';
      this.emitHud();
    };

    const onContextRestored = () => {
      this.webglError = null;
      this.emitHud();
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    this.unbindEvents = () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
    };
  }

  private unbindEvents: () => void = () => {};

  private tryInteract(): void {
    if (!this.activePrompt) return;
    const { kind, id } = this.activePrompt;

    if (kind === 'breaker') {
      const breaker = this.breakers.find((b) => b.id === id);
      if (breaker && !breaker.activated) {
        breaker.setActivated(true);
        this.audio.playBreakerSwitch();
        const activatedCount = this.breakers.filter((b) => b.activated).length;

        // Switching a breaker creates loud electrical surge that draws Stalker to investigate
        if (this.stalkerState !== 'hunt') {
          this.stalkerState = 'investigate';
          this.stalkerTargetCell = worldToCell(this.playerPos.x, this.playerPos.z);
          this.stalkerInvestigateTimer = 8;
        }

        if (activatedCount === this.breakers.length) {
          this.elevator.setPowered(true);
          this.showBanner('All 4 breakers restored. Return north to the Exit Lift.', 6);
        } else {
          this.showBanner(`${breaker.sector} breaker restored (${activatedCount}/${this.breakers.length}).`, 4);
        }
        this.emitHud();
      }
    } else if (kind === 'battery') {
      const bat = this.batteries.get(id);
      if (bat && !bat.collected) {
        bat.collected = true;
        bat.group.visible = false;
        this.battery = Math.min(100, this.battery + 45);
        this.audio.playPickup('battery');
        this.showBanner('Lithium cell recovered (+45% battery).', 3);
        this.emitHud();
      }
    } else if (kind === 'note') {
      const noteEntry = this.notes.get(id);
      if (noteEntry) {
        noteEntry.collected = true;
        noteEntry.group.visible = false;
        this.audio.playPickup('note');
        this.activeNote = noteEntry.data;
        this.phase = 'note';
        this.exitPointerLockSafe();
        this.emitHud();
      }
    } else if (kind === 'elevator') {
      const activatedCount = this.breakers.filter((b) => b.activated).length;
      if (activatedCount < this.breakers.length) {
        this.showBanner(`Exit Lift unpowered. ${this.breakers.length - activatedCount} breakers remaining.`, 3.5);
      } else {
        this.audio.playEscapeChime();
        this.phase = 'escaped';
        this.exitPointerLockSafe();
        this.emitHud();
        this.onRunEnd({
          outcome: 'escaped',
          elapsedSeconds: this.runElapsed,
          breakersActivated: activatedCount,
          totalBreakers: this.breakers.length,
          notesCollected: Array.from(this.notes.values()).filter((n) => n.collected).length,
          totalNotes: this.notes.size,
          difficulty: this.difficulty,
        });
      }
    }
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.disposed) {
          this.frameId = requestAnimationFrame(this.tick);
        }
      });
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void): void {
    try {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (this.disposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            this.frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            this.frameId = window.setTimeout(cb, 80);
          }
        };
        this.frameId = window.setTimeout(poll, 5);
        return;
      }
    } catch {
      // Fallback
    }
    this.frameId = window.setTimeout(cb, 80);
  }

  private tick = (timestamp: number): void => {
    if (this.disposed) return;
    const rawDelta = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    const dt = Math.min(rawDelta, 0.08);
    this.clockElapsed += dt;

    this.updateScene(dt);
    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  };

  private updateScene(dt: number): void {
    // Flicker bunker emergency lights subtly
    for (const item of this.emergencyPointLights) {
      const flicker =
        Math.sin(this.clockElapsed * 7.5 + item.seed) * 0.08 +
        (Math.sin(this.clockElapsed * 31 + item.seed) > 0.94 ? -0.45 : 0);
      item.light.intensity = Math.max(0.2, item.baseIntensity + flicker);
    }

    // Gentle battery hover pulse
    this.batteries.forEach((bat) => {
      if (!bat.collected) {
        const visual = bat.collider.userData.visual as THREE.Object3D | undefined;
        if (visual) {
          visual.rotation.y += dt * 1.4;
        }
      }
    });

    if (this.phase === 'title') {
      // Atmospheric slow camera orbit in the North Lift Vestibule
      const orbitAngle = Math.sin(this.clockElapsed * 0.14) * 0.45;
      const base = cellToWorld(3, 9);
      this.camera.position.set(base.x + Math.sin(this.clockElapsed * 0.18) * 1.4, 1.85, base.z + 1.5);
      this.camera.rotation.set(-0.04, Math.PI + orbitAngle, 0);
      this.flashlight.position.copy(this.camera.position);
      this.flashlightTarget.position.set(
        this.camera.position.x - Math.sin(Math.PI + orbitAngle) * 6,
        1.4,
        this.camera.position.z - Math.cos(Math.PI + orbitAngle) * 6
      );
      this.flashlight.intensity = 10;
      this.watcher.group.position.set(0, 0, cellToWorld(7, 9).z);
      this.watcher.animate(this.clockElapsed, 1.2, false);
      return;
    }

    if (this.phase === 'caught') {
      this.caughtAnimTimer += dt;
      // Lock gaze onto the Hollow Watcher's skull during final scare
      _camLook.set(this.stalkerPos.x, 2.05, this.stalkerPos.z);
      this.camera.lookAt(_camLook);
      this.camera.position.x += (Math.random() - 0.5) * 0.045;
      this.camera.position.y += (Math.random() - 0.5) * 0.045;
      this.watcher.animate(this.clockElapsed, 0, true);
      return;
    }

    if (this.phase !== 'playing') {
      return;
    }

    this.runElapsed += dt;

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.statusBanner = null;
      }
    }

    // Keyboard turn fallback (Q / E? Wait: E is interact! Let's use ArrowLeft / ArrowRight for turning if user isn't dragging)
    if (this.keys['ArrowLeft']) this.yaw += dt * 2.1;
    if (this.keys['ArrowRight']) this.yaw -= dt * 2.1;

    // Movement (Keyboard + Mobile Analog Joystick)
    const keyForward =
      (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0) -
      (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0);
    const keyStrafe =
      (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);

    const forwardInput = THREE.MathUtils.clamp(keyForward + this.touchMoveY, -1, 1);
    const strafeInput = THREE.MathUtils.clamp(keyStrafe + this.touchMoveX, -1, 1);

    const inputMag = Math.hypot(forwardInput, strafeInput);
    const wantsMove = inputMag > 0.08;
    const autoJoystickSprint = Math.hypot(this.touchMoveX, this.touchMoveY) > 0.88;
    const wantsSprint =
      (this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.touchSprint || autoJoystickSprint) &&
      !this.crouching &&
      wantsMove &&
      this.stamina > 2;

    if (wantsSprint) {
      this.stamina = Math.max(0, this.stamina - dt * 24);
    } else {
      this.stamina = Math.min(100, this.stamina + dt * (wantsMove ? 10 : 18));
    }

    const baseSpeed = wantsSprint ? 6.2 : this.crouching ? 2.1 : 3.7;
    const moveSpeed = baseSpeed * Math.min(1, inputMag);

    if (wantsMove) {
      _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
      _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
      _moveDir.set(0, 0, 0).addScaledVector(_forward, forwardInput).addScaledVector(_right, strafeInput);
      if (_moveDir.lengthSq() > 0) {
        _moveDir.normalize().multiplyScalar(moveSpeed * dt);
        this.movePlayerWithCollision(_moveDir.x, _moveDir.z);
      }
      this.bobPhase += dt * (wantsSprint ? 13 : this.crouching ? 6 : 8.5);
    }

    // Smooth crouch height & head-bob
    const targetEye = this.crouching ? 1.05 : 1.68;
    this.eyeHeight = THREE.MathUtils.damp(this.eyeHeight, targetEye, 10, dt);
    const bobOffset = wantsMove ? Math.sin(this.bobPhase) * (wantsSprint ? 0.055 : 0.03) : 0;

    this.camera.position.set(this.playerPos.x, this.eyeHeight + bobOffset, this.playerPos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);

    // Flashlight Battery & Flicker
    if (this.flashlightOn) {
      const drainRate = this.difficulty === 'nightmare' ? 1.45 : 0.95;
      this.battery = Math.max(0, this.battery - dt * drainRate);
      if (this.battery <= 0) {
        this.flashlightOn = false;
        this.audio.playFlashlightClick(false);
        this.showBanner('Flashlight battery depleted.', 3);
      }
    }

    if (this.flashlightOn) {
      let intensity = 14.5;
      if (this.battery < 20) {
        const sputter = Math.sin(this.clockElapsed * 29) * Math.cos(this.clockElapsed * 17);
        intensity = sputter > 0.2 ? 3.5 : 13;
      }
      if (this.dreadLevel > 0.65 && Math.sin(this.clockElapsed * 37) > 0.72) {
        intensity *= 0.25;
      }
      this.flashlight.intensity = intensity;
    } else {
      this.flashlight.intensity = 0;
    }

    // Aim flashlight slightly offset like a hand-held torch
    _forward.set(0, 0, -1).applyEuler(this.camera.rotation);
    this.flashlight.position.set(
      this.camera.position.x + Math.cos(this.yaw) * 0.14,
      this.camera.position.y - 0.12,
      this.camera.position.z - Math.sin(this.yaw) * 0.14
    );
    this.flashlightTarget.position.copy(this.flashlight.position).addScaledVector(_forward, 10);

    // Raycast interaction check
    this.updateInteractionPrompt();

    // Update Stalker AI
    const stalkerDist = this.updateStalkerAI(dt, wantsSprint);

    // Dread calculation (proximity + looking at watcher)
    const proxFactor = THREE.MathUtils.clamp(1 - (stalkerDist - 2) / 18, 0, 1);
    const los = stalkerDist < 20 && hasLineOfSight(this.playerPos.x, this.playerPos.z, this.stalkerPos.x, this.stalkerPos.z);
    const targetDread = this.stalkerState === 'hunt' ? Math.max(0.65, proxFactor) : los ? proxFactor * 0.85 : proxFactor * 0.45;
    this.dreadLevel = THREE.MathUtils.damp(this.dreadLevel, targetDread, 4.5, dt);

    // Audio Update
    this.audio.update(
      this.clockElapsed,
      this.dreadLevel,
      wantsMove,
      wantsSprint,
      this.crouching,
      stalkerDist,
      this.stalkerState === 'hunt',
      true
    );

    // Periodic HUD update (~15 Hz so React stays lightweight)
    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.065) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private movePlayerWithCollision(dx: number, dz: number): void {
    const radius = 0.46;
    const nextX = this.playerPos.x + dx;
    if (!this.collidesWithWall(nextX, this.playerPos.z, radius)) {
      this.playerPos.x = nextX;
    }
    const nextZ = this.playerPos.z + dz;
    if (!this.collidesWithWall(this.playerPos.x, nextZ, radius)) {
      this.playerPos.z = nextZ;
    }
  }

  private collidesWithWall(wx: number, wz: number, radius: number): boolean {
    const offsets = [
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
      [radius * 0.7, radius * 0.7],
      [-radius * 0.7, radius * 0.7],
      [radius * 0.7, -radius * 0.7],
      [-radius * 0.7, -radius * 0.7],
    ];
    for (let i = 0; i < offsets.length; i++) {
      const cell = worldToCell(wx + offsets[i][0], wz + offsets[i][1]);
      if (isWall(cell.row, cell.col)) return true;
    }
    return false;
  }

  private updateInteractionPrompt(): void {
    _raycaster.setFromCamera(_screenCenter, this.camera);
    _raycaster.far = 3.2;
    const hits = _raycaster.intersectObjects(this.interactColliders, false);

    let nextPrompt: InteractPrompt | null = null;
    for (const hit of hits) {
      const { interactType, interactId } = hit.object.userData as {
        interactType?: string;
        interactId?: string;
      };
      if (!interactType || !interactId) continue;

      if (interactType === 'breaker') {
        const b = this.breakers.find((item) => item.id === interactId);
        if (b && !b.activated) {
          nextPrompt = {
            id: interactId,
            kind: 'breaker',
            label: `${b.sector} Breaker`,
            actionHint: '[E] Restore Power',
          };
          break;
        }
      } else if (interactType === 'battery') {
        const bat = this.batteries.get(interactId);
        if (bat && !bat.collected) {
          nextPrompt = {
            id: interactId,
            kind: 'battery',
            label: 'Lithium Battery Cell',
            actionHint: '[E] Collect (+45%)',
          };
          break;
        }
      } else if (interactType === 'note') {
        const note = this.notes.get(interactId);
        if (note && !note.collected) {
          nextPrompt = {
            id: interactId,
            kind: 'note',
            label: note.data.title,
            actionHint: '[E] Read Log',
          };
          break;
        }
      } else if (interactType === 'elevator') {
        const done = this.breakers.filter((b) => b.activated).length;
        const ready = done === this.breakers.length;
        nextPrompt = {
          id: interactId,
          kind: 'elevator',
          label: 'Freight Exit Lift',
          actionHint: ready ? '[E] Ascend to Surface' : 'Power Offline',
          lockedReason: ready ? undefined : `${this.breakers.length - done} breakers remaining`,
        };
        break;
      }
    }

    const changed =
      nextPrompt?.id !== this.activePrompt?.id ||
      nextPrompt?.actionHint !== this.activePrompt?.actionHint;
    this.activePrompt = nextPrompt;
    if (changed) this.emitHud();
  }

  private updateStalkerAI(dt: number, playerSprinting: boolean): number {
    const dx = this.playerPos.x - this.stalkerPos.x;
    const dz = this.playerPos.z - this.stalkerPos.z;
    const dist = Math.hypot(dx, dz);

    const hasLOS = dist < 24 && hasLineOfSight(this.stalkerPos.x, this.stalkerPos.z, this.playerPos.x, this.playerPos.z);

    // Detection radius depends on flashlight & crouch stealth
    const sightRange = this.flashlightOn
      ? this.difficulty === 'nightmare' ? 23 : 19
      : this.crouching
      ? 7.5
      : 12.5;

    const noiseRange = playerSprinting ? 17 : this.flashlightOn ? 9.5 : 0;

    if (this.stalkerAlertCooldown > 0) this.stalkerAlertCooldown -= dt;

    if (hasLOS && dist < sightRange) {
      if (this.stalkerState !== 'hunt' && this.stalkerAlertCooldown <= 0) {
        this.audio.playAlertSting();
        this.stalkerAlertCooldown = 6;
      }
      this.stalkerState = 'hunt';
      this.stalkerTargetCell = worldToCell(this.playerPos.x, this.playerPos.z);
      this.stalkerInvestigateTimer = 5.5;
    } else if (dist < noiseRange && this.stalkerState !== 'hunt') {
      this.stalkerState = 'investigate';
      this.stalkerTargetCell = worldToCell(this.playerPos.x, this.playerPos.z);
      this.stalkerInvestigateTimer = 6.5;
    } else if (this.stalkerState === 'hunt' || this.stalkerState === 'investigate') {
      this.stalkerInvestigateTimer -= dt;
      if (this.stalkerInvestigateTimer <= 0) {
        this.stalkerState = 'patrol';
        this.stalkerTargetCell = this.pickPatrolCell();
      }
    }

    const stalkerCell = worldToCell(this.stalkerPos.x, this.stalkerPos.z);

    // Determine next waypoint
    let targetWorldX = this.playerPos.x;
    let targetWorldZ = this.playerPos.z;

    if (!(this.stalkerState === 'hunt' && hasLOS)) {
      if (
        stalkerCell.row === this.stalkerTargetCell.row &&
        stalkerCell.col === this.stalkerTargetCell.col
      ) {
        if (this.stalkerState === 'patrol') {
          this.stalkerTargetCell = this.pickPatrolCell();
        } else {
          this.stalkerState = 'patrol';
          this.stalkerTargetCell = this.pickPatrolCell();
        }
      }
      const nextStep = findNextPathCell(stalkerCell, this.stalkerTargetCell);
      const nextWorld = cellToWorld(nextStep.row, nextStep.col);
      targetWorldX = nextWorld.x;
      targetWorldZ = nextWorld.z;
    }

    const basePatrolSpeed = this.difficulty === 'nightmare' ? 2.85 : 2.25;
    const baseHuntSpeed = this.difficulty === 'nightmare' ? 4.85 : 4.25;
    // Escalate slightly as more breakers are restored
    const activated = this.breakers.filter((b) => b.activated).length;
    const speed =
      (this.stalkerState === 'hunt' ? baseHuntSpeed : this.stalkerState === 'investigate' ? 3.2 : basePatrolSpeed) +
      activated * 0.14;

    const toTargetX = targetWorldX - this.stalkerPos.x;
    const toTargetZ = targetWorldZ - this.stalkerPos.z;
    const stepDist = Math.hypot(toTargetX, toTargetZ);

    if (stepDist > 0.05) {
      const vx = (toTargetX / stepDist) * speed;
      const vz = (toTargetZ / stepDist) * speed;
      this.stalkerPos.x += vx * dt;
      this.stalkerPos.z += vz * dt;

      const desiredYaw = Math.atan2(vx, vz);
      let diff = desiredYaw - this.stalkerYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.stalkerYaw += diff * Math.min(1, dt * 7);
    }

    this.watcher.group.position.copy(this.stalkerPos);
    this.watcher.group.rotation.y = this.stalkerYaw;
    this.watcher.animate(this.clockElapsed, speed, this.stalkerState === 'hunt');

    // Caught check
    if (dist < 1.35) {
      this.triggerCaughtSequence();
    }

    return dist;
  }

  private pickPatrolCell(): GridCoord {
    const pCell = worldToCell(this.playerPos.x, this.playerPos.z);
    // Prefer patrol points reasonably spread across the bunker
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = this.openCells[Math.floor(Math.random() * this.openCells.length)];
      const d = Math.abs(candidate.row - pCell.row) + Math.abs(candidate.col - pCell.col);
      if (d >= 4) return candidate;
    }
    return this.openCells[Math.floor(Math.random() * this.openCells.length)];
  }

  private triggerCaughtSequence(): void {
    this.phase = 'caught';
    this.caughtAnimTimer = 0;
    this.audio.playCaughtScream();
    this.exitPointerLockSafe();
    this.emitHud();

    window.setTimeout(() => {
      if (this.disposed) return;
      const activated = this.breakers.filter((b) => b.activated).length;
      this.onRunEnd({
        outcome: 'caught',
        elapsedSeconds: this.runElapsed,
        breakersActivated: activated,
        totalBreakers: this.breakers.length,
        notesCollected: Array.from(this.notes.values()).filter((n) => n.collected).length,
        totalNotes: this.notes.size,
        difficulty: this.difficulty,
      });
    }, 950);
  }

  private emitHud(): void {
    const playerCell = worldToCell(this.playerPos.x, this.playerPos.z);
    this.onHudUpdate({
      phase: this.phase,
      difficulty: this.difficulty,
      breakersActivated: this.breakers.filter((b) => b.activated).length,
      totalBreakers: this.breakers.length,
      battery: Math.round(this.battery),
      flashlightOn: this.flashlightOn,
      stamina: Math.round(this.stamina),
      crouching: this.crouching,
      sectorName: getSectorName(playerCell.row, playerCell.col),
      dreadLevel: this.dreadLevel,
      stalkerState: this.stalkerState,
      pointerLocked: this.pointerLocked,
      elapsedSeconds: Math.floor(this.runElapsed),
      notesCollected: Array.from(this.notes.values()).filter((n) => n.collected).length,
      totalNotes: this.notes.size,
      activePrompt: this.activePrompt,
      activeNote: this.activeNote,
      statusBanner: this.statusBanner,
      webglError: this.webglError,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.unbindEvents();
    this.audio.dispose();
    this.textures?.dispose();
    this.scene?.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
    this.renderer?.dispose();
    if (this.renderer?.domElement?.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
