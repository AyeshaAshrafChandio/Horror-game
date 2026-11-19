import { useEffect, useRef, useState } from 'react';
import { EndScreen } from './components/EndScreen';
import { GameHUD } from './components/GameHUD';
import { MobileControls } from './components/MobileControls';
import { TitleScreen } from './components/TitleScreen';
import { HorrorEngine } from './game/HorrorEngine';
import { DifficultyMode, GameHUDState, RunSummary } from './game/types';

const INITIAL_HUD: GameHUDState = {
  phase: 'title',
  difficulty: 'standard',
  breakersActivated: 0,
  totalBreakers: 4,
  battery: 100,
  flashlightOn: true,
  stamina: 100,
  crouching: false,
  sectorName: 'Lift Vestibule',
  dreadLevel: 0,
  stalkerState: 'patrol',
  pointerLocked: false,
  elapsedSeconds: 0,
  notesCollected: 0,
  totalNotes: 5,
  activePrompt: null,
  activeNote: null,
  statusBanner: null,
  webglError: null,
};

function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(pointer: coarse)').matches ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth < 768
  );
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<HorrorEngine | null>(null);

  const [hud, setHud] = useState<GameHUDState>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [touchControlsEnabled, setTouchControlsEnabled] = useState<boolean>(() => detectTouchDevice());
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new HorrorEngine(
      mount,
      (nextHud) => setHud(nextHud),
      (summary) => setRunSummary(summary)
    );
    engine.setTouchControlsActive(touchControlsEnabled);
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setTouchControlsActive(touchControlsEnabled);
  }, [touchControlsEnabled]);

  const handleToggleMute = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const next = !muted;
    engine.setMuted(next);
    setMuted(next);
  };

  const handleToggleTouchControls = () => {
    setTouchControlsEnabled((prev) => !prev);
  };

  const handleSelectDifficulty = (mode: DifficultyMode) => {
    engineRef.current?.setDifficulty(mode);
  };

  const handleStart = () => {
    setRunSummary(null);
    engineRef.current?.startNewGame(hud.difficulty);
  };

  const handleReturnTitle = () => {
    setRunSummary(null);
    engineRef.current?.returnToTitle();
  };

  return (
    <div className="relative w-full h-full bg-[#060708] overflow-hidden touch-none">
      {/* Dedicated isolated WebGL mount */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Graceful WebGL Fallback */}
      {hud.webglError && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-6 bg-[#07080a]">
          <div className="max-w-md bg-[#0e1014] border border-white/15 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-stone-100">Graphics Context Unavailable</h2>
            <p className="mt-2 text-sm text-stone-300">{hud.webglError}</p>
          </div>
        </div>
      )}

      {!hud.webglError && hud.phase === 'title' && (
        <TitleScreen
          difficulty={hud.difficulty}
          muted={muted}
          touchControlsEnabled={touchControlsEnabled}
          onSelectDifficulty={handleSelectDifficulty}
          onToggleTouchControls={handleToggleTouchControls}
          onStart={handleStart}
          onToggleMute={handleToggleMute}
        />
      )}

      {!hud.webglError &&
        (hud.phase === 'playing' || hud.phase === 'paused' || hud.phase === 'note' || hud.phase === 'caught') && (
          <GameHUD
            hud={hud}
            muted={muted}
            touchControlsEnabled={touchControlsEnabled}
            onToggleTouchControls={handleToggleTouchControls}
            onToggleMute={handleToggleMute}
            onPause={() => engineRef.current?.pauseGame()}
            onResume={() => engineRef.current?.resumeGame()}
            onRestart={handleStart}
            onQuitToTitle={handleReturnTitle}
            onLockPointer={() => engineRef.current?.requestPointerLockSafe()}
            onInteract={() => engineRef.current?.interact()}
          />
        )}

      {!hud.webglError && hud.phase === 'playing' && touchControlsEnabled && (
        <MobileControls
          flashlightOn={hud.flashlightOn}
          crouching={hud.crouching}
          activePrompt={hud.activePrompt}
          onMove={(x, y) => engineRef.current?.setTouchMove(x, y)}
          onLookDelta={(dx, dy) => engineRef.current?.addLookDelta(dx, dy)}
          onSprintChange={(active) => engineRef.current?.setTouchSprint(active)}
          onToggleFlashlight={() => engineRef.current?.toggleFlashlight()}
          onToggleCrouch={() => engineRef.current?.toggleCrouch()}
          onInteract={() => engineRef.current?.interact()}
        />
      )}

      {!hud.webglError && runSummary && (hud.phase === 'caught' || hud.phase === 'escaped') && (
        <EndScreen
          summary={runSummary}
          onRetry={handleStart}
          onReturnTitle={handleReturnTitle}
        />
      )}
    </div>
  );
}
