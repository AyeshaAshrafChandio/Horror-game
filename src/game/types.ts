export type GamePhase = 'title' | 'playing' | 'paused' | 'note' | 'caught' | 'escaped';

export type DifficultyMode = 'standard' | 'nightmare';

export interface FieldNoteData {
  id: string;
  title: string;
  author: string;
  timestamp: string;
  body: string;
}

export interface InteractPrompt {
  id: string;
  kind: 'breaker' | 'battery' | 'note' | 'elevator';
  label: string;
  actionHint: string;
  lockedReason?: string;
}

export interface GameHUDState {
  phase: GamePhase;
  difficulty: DifficultyMode;
  breakersActivated: number;
  totalBreakers: number;
  battery: number; // 0..100
  flashlightOn: boolean;
  stamina: number; // 0..100
  crouching: boolean;
  sectorName: string;
  dreadLevel: number; // 0..1 proximity & line-of-sight threat
  stalkerState: 'patrol' | 'investigate' | 'hunt';
  pointerLocked: boolean;
  elapsedSeconds: number;
  notesCollected: number;
  totalNotes: number;
  activePrompt: InteractPrompt | null;
  activeNote: FieldNoteData | null;
  statusBanner: string | null;
  webglError: string | null;
}

export interface RunSummary {
  outcome: 'caught' | 'escaped';
  elapsedSeconds: number;
  breakersActivated: number;
  totalBreakers: number;
  notesCollected: number;
  totalNotes: number;
  difficulty: DifficultyMode;
}
