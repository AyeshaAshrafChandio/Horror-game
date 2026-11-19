import { FieldNoteData } from './types';

export const CELL_SIZE = 4;
export const WALL_HEIGHT = 4.2;
export const GRID_SIZE = 19;

// 19x19 subterranean bunker layout
// '#' = reinforced concrete wall
// '.' = walkable floor
export const BUNKER_GRID: string[] = [
  '###################', // 0
  '#.....#.....#.....#', // 1
  '#..#..#.....#..#..#', // 2
  '#.....#.....#.....#', // 3
  '###.#####.#####.###', // 4
  '#.....#.....#.....#', // 5
  '#.#.#...#.#...#.#.#', // 6
  '#...#.........#...#', // 7
  '###.###.#.#.###.###', // 8
  '#.......#.#.......#', // 9
  '#.#.###.....###.#.#', // 10
  '#.................#', // 11
  '###.###.#.#.###.###', // 12
  '#.....#.....#.....#', // 13
  '#..#..#..#..#..#..#', // 14
  '#.....#.....#.....#', // 15
  '#..#....#.#....#..#', // 16
  '#.....#.....#.....#', // 17
  '###################', // 18
];

export interface GridCoord {
  row: number;
  col: number;
}

export interface BreakerPlacement {
  id: string;
  sector: string;
  row: number;
  col: number;
  facing: 'north' | 'south' | 'east' | 'west';
}

export interface PickupPlacement {
  id: string;
  row: number;
  col: number;
}

export interface NotePlacement extends PickupPlacement {
  note: FieldNoteData;
}

export const PLAYER_SPAWN: GridCoord = { row: 3, col: 9 };
export const ELEVATOR_CELL: GridCoord = { row: 1, col: 9 };
export const STALKER_SPAWN: GridCoord = { row: 15, col: 9 };

export const BREAKER_PLACEMENTS: BreakerPlacement[] = [
  { id: 'breaker-nw', sector: 'Generator Bay', row: 1, col: 1, facing: 'east' },
  { id: 'breaker-ne', sector: 'Cryo Hall', row: 1, col: 17, facing: 'west' },
  { id: 'breaker-sw', sector: 'Specimen Lab', row: 17, col: 1, facing: 'east' },
  { id: 'breaker-se', sector: 'Archive Vault', row: 17, col: 17, facing: 'west' },
];

export const BATTERY_PLACEMENTS: PickupPlacement[] = [
  { id: 'bat-1', row: 5, col: 1 },
  { id: 'bat-2', row: 5, col: 17 },
  { id: 'bat-3', row: 9, col: 9 },
  { id: 'bat-4', row: 11, col: 5 },
  { id: 'bat-5', row: 11, col: 13 },
  { id: 'bat-6', row: 15, col: 15 },
];

export const NOTE_PLACEMENTS: NotePlacement[] = [
  {
    id: 'note-1',
    row: 3,
    col: 8,
    note: {
      id: 'note-1',
      title: 'Lockdown Protocol — Sublevel B4',
      author: 'H. Vance, Chief Technician',
      timestamp: '02:14',
      body: 'Main grid tripped during the acoustic test. The freight lift is dead until all four corner breakers are thrown: Generator Bay (NW), Cryo Hall (NE), Specimen Lab (SW), and Archive Vault (SE). Stay quiet—the resonance drew something out of Shaft 9.',
    },
  },
  {
    id: 'note-2',
    row: 3,
    col: 3,
    note: {
      id: 'note-2',
      title: 'Maintenance Log #19',
      author: 'D. Mercer, Electrician',
      timestamp: '02:39',
      body: 'It tracks beam scatter and heavy boots. Whenever you hear the iron scraping down the corridor, kill your torch with [F] and crouch behind a concrete pillar. If it loses sight of you, it drifts back into the lower rings.',
    },
  },
  {
    id: 'note-3',
    row: 3,
    col: 15,
    note: {
      id: 'note-3',
      title: 'Cryo Containment Breach',
      author: 'Dr. E. Lindqvist',
      timestamp: '02:51',
      body: 'Chamber 04 pressure dropped to zero. Whatever was suspended inside did not thaw—it unfolded. Its eyes react directly to focused lumens. Do not stare at it in an open hallway.',
    },
  },
  {
    id: 'note-4',
    row: 13,
    col: 3,
    note: {
      id: 'note-4',
      title: 'Specimen Observation Fragment',
      author: 'Unattributed',
      timestamp: '03:07',
      body: 'Left spare lithium cells along the central service spine and side alcoves. Conserve charge—once your battery dips below twenty percent, the filament starts fluttering and drawing its attention.',
    },
  },
  {
    id: 'note-5',
    row: 13,
    col: 15,
    note: {
      id: 'note-5',
      title: 'Final Evacuation Order',
      author: 'Station Oversight',
      timestamp: '03:18',
      body: 'Seal B4 from the surface once the lift arrives. Do not wait for stragglers. When the fourth breaker engages, the elevator beacon turns green—run straight north through the central shaft.',
    },
  },
];

export const EMERGENCY_LIGHTS: Array<{ row: number; col: number; color: number; intensity: number }> = [
  { row: 1, col: 9, color: 0xb91c1c, intensity: 2.2 }, // Exit lift red beacon
  { row: 2, col: 3, color: 0xd97706, intensity: 1.4 }, // Generator Bay amber
  { row: 2, col: 15, color: 0x0e7490, intensity: 1.6 }, // Cryo Hall cold cyan
  { row: 7, col: 9, color: 0x991b1b, intensity: 1.3 }, // Upper junction red
  { row: 11, col: 9, color: 0xb45309, intensity: 1.4 }, // Service spine center
  { row: 15, col: 3, color: 0x0f766e, intensity: 1.4 }, // Specimen Lab sickly teal
  { row: 15, col: 15, color: 0xb91c1c, intensity: 1.3 }, // Archive Vault dim red
];

export function cellToWorld(row: number, col: number): { x: number; z: number } {
  const half = (GRID_SIZE - 1) / 2;
  return {
    x: (col - half) * CELL_SIZE,
    z: (row - half) * CELL_SIZE,
  };
}

export function worldToCell(x: number, z: number): GridCoord {
  const half = (GRID_SIZE - 1) / 2;
  return {
    col: Math.round(x / CELL_SIZE + half),
    row: Math.round(z / CELL_SIZE + half),
  };
}

export function isWall(row: number, col: number): boolean {
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return true;
  return BUNKER_GRID[row][col] === '#';
}

export function getSectorName(row: number, col: number): string {
  if (row <= 3 && col >= 7 && col <= 11) return 'Lift Vestibule';
  if (row <= 3 && col <= 5) return 'Generator Bay';
  if (row <= 3 && col >= 13) return 'Cryo Hall';
  if (row >= 13 && col <= 5) return 'Specimen Lab';
  if (row >= 13 && col >= 13) return 'Archive Vault';
  if (row >= 13 && col >= 7 && col <= 11) return 'South Sump';
  if (row === 11) return 'Service Spine';
  return 'Sublevel Corridor';
}

export function getAllOpenCells(): GridCoord[] {
  const cells: GridCoord[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!isWall(r, c)) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

const DIRS: Array<[number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

// BFS grid pathfinding returning the immediate next cell toward target
export function findNextPathCell(from: GridCoord, to: GridCoord): GridCoord {
  if (from.row === to.row && from.col === to.col) return from;
  if (isWall(to.row, to.col)) return from;

  const total = GRID_SIZE * GRID_SIZE;
  const visited = new Uint8Array(total);
  const parent = new Int16Array(total).fill(-1);
  const queue = new Int16Array(total);
  let head = 0;
  let tail = 0;

  const startIdx = from.row * GRID_SIZE + from.col;
  const targetIdx = to.row * GRID_SIZE + to.col;

  visited[startIdx] = 1;
  queue[tail++] = startIdx;

  let found = false;
  while (head < tail) {
    const curr = queue[head++];
    if (curr === targetIdx) {
      found = true;
      break;
    }
    const r = Math.floor(curr / GRID_SIZE);
    const c = curr % GRID_SIZE;
    for (let i = 0; i < 4; i++) {
      const nr = r + DIRS[i][0];
      const nc = c + DIRS[i][1];
      if (isWall(nr, nc)) continue;
      const nIdx = nr * GRID_SIZE + nc;
      if (visited[nIdx]) continue;
      visited[nIdx] = 1;
      parent[nIdx] = curr;
      queue[tail++] = nIdx;
    }
  }

  if (!found) return from;

  let step = targetIdx;
  while (parent[step] !== -1 && parent[step] !== startIdx) {
    step = parent[step];
  }
  return {
    row: Math.floor(step / GRID_SIZE),
    col: step % GRID_SIZE,
  };
}

// Fast 2D DDA raymarch against bunker wall cells for AI line-of-sight
export function hasLineOfSight(x1: number, z1: number, x2: number, z2: number): boolean {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.25) return true;
  const steps = Math.ceil(dist / 0.45);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const cell = worldToCell(x1 + dx * t, z1 + dz * t);
    if (isWall(cell.row, cell.col)) return false;
  }
  return true;
}
