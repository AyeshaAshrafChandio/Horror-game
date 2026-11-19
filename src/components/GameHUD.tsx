import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Gamepad2, Pause, Volume2, VolumeX } from 'lucide-react';
import { GameHUDState } from '../game/types';

interface GameHUDProps {
  hud: GameHUDState;
  muted: boolean;
  touchControlsEnabled: boolean;
  onToggleTouchControls: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onQuitToTitle: () => void;
  onLockPointer: () => void;
  onInteract: () => void;
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  muted,
  touchControlsEnabled,
  onToggleTouchControls,
  onToggleMute,
  onPause,
  onResume,
  onRestart,
  onQuitToTitle,
  onLockPointer,
  onInteract,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH' && hud.phase === 'playing') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hud.phase]);

  const dreadOpacity = Math.min(0.88, Math.pow(hud.dreadLevel, 1.3) * 0.9);
  const allBreakersReady = hud.breakersActivated >= hud.totalBreakers;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none select-none">
      {/* Atmospheric Vignette & Dynamic Dread Layer */}
      <div className="absolute inset-0 vignette-overlay pointer-events-none" />
      <div
        className="absolute inset-0 dread-vignette pointer-events-none transition-opacity duration-150"
        style={{ opacity: dreadOpacity }}
      />
      {hud.dreadLevel > 0.25 && (
        <div
          className="absolute inset-0 film-grain pointer-events-none"
          style={{ opacity: Math.min(0.45, (hud.dreadLevel - 0.25) * 0.6) }}
        />
      )}

      {/* Top HUD Bar */}
      <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-4 md:p-6">
        {/* Top-Left Sector & Objective */}
        <div className="bg-[#090b0e]/85 border border-white/10 rounded-md px-3 py-2 sm:px-4 sm:py-2.5">
          <div className="text-xs sm:text-sm font-semibold text-stone-100 tracking-wide">
            {hud.sectorName}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] sm:text-xs text-stone-400 font-mono tabular-nums">
            <span className={allBreakersReady ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
              Breakers {hud.breakersActivated}/{hud.totalBreakers}
            </span>
            <span aria-hidden="true">·</span>
            <span>Logs {hud.notesCollected}/{hud.totalNotes}</span>
            <span aria-hidden="true">·</span>
            <span>{formatClock(hud.elapsedSeconds)}</span>
          </div>
          {touchControlsEnabled && (
            <div className="mt-1.5 flex md:hidden items-center gap-3 text-[11px] font-mono tabular-nums text-stone-300">
              <span className={hud.battery <= 20 ? 'text-red-400' : 'text-amber-300'}>
                Torch {hud.battery}%
              </span>
              <span aria-hidden="true" className="text-stone-500">·</span>
              <span>Stamina {hud.stamina}%</span>
            </div>
          )}
        </div>

        {/* Top-Right Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={onToggleTouchControls}
            className={`inline-flex items-center gap-1.5 px-2.5 py-2 border rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-500 ${
              touchControlsEnabled
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                : 'bg-[#090b0e]/85 border-white/10 text-stone-300 hover:text-white hover:border-white/25'
            }`}
            aria-label={touchControlsEnabled ? 'Hide Mobile Controls' : 'Show Mobile Controls'}
          >
            <Gamepad2 className="w-4 h-4" />
            <span className="hidden sm:inline">{touchControlsEnabled ? 'Touch On' : 'Touch Off'}</span>
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            className="p-2.5 bg-[#090b0e]/85 border border-white/10 rounded-md text-stone-300 hover:text-white hover:border-white/25 transition-colors focus-visible:outline-2 focus-visible:outline-amber-500"
            aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onPause}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#090b0e]/85 border border-white/10 rounded-md text-xs font-medium text-stone-300 hover:text-white hover:border-white/25 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-500"
          >
            <Pause className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pause</span>
          </button>
        </div>
      </div>

      {/* Status Notification Banner */}
      {hud.statusBanner && hud.phase === 'playing' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-[#0b0d10]/90 border border-amber-500/30 rounded-md px-4 py-2 text-xs sm:text-sm text-stone-100 whitespace-nowrap max-w-[90vw] truncate">
          {hud.statusBanner}
        </div>
      )}

      {/* Center Reticle & Contextual Interaction Prompt */}
      {hud.phase === 'playing' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative flex flex-col items-center">
            <div
              className={`w-1.5 h-1.5 rounded-full transition-transform duration-150 ${
                hud.activePrompt ? 'scale-150 bg-amber-400' : 'bg-stone-200/70'
              }`}
            />
            {hud.activePrompt && (
              <button
                type="button"
                onClick={onInteract}
                className="mt-5 pointer-events-auto bg-[#090b0e]/90 border border-white/15 rounded-md px-3.5 py-2 text-center hover:border-amber-400/50 transition-colors"
              >
                <div className="text-xs font-medium text-stone-100">
                  {hud.activePrompt.label}
                </div>
                <div
                  className={`mt-0.5 text-xs font-mono ${
                    hud.activePrompt.lockedReason ? 'text-red-400' : 'text-amber-400'
                  }`}
                >
                  {hud.activePrompt.lockedReason ??
                    (touchControlsEnabled ? 'Tap here or Use button' : hud.activePrompt.actionHint)}
                </div>
              </button>
            )}
            {!touchControlsEnabled && !hud.pointerLocked && !hud.activePrompt && (
              <button
                type="button"
                onClick={onLockPointer}
                className="mt-8 pointer-events-auto px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200 bg-[#090b0e]/75 border border-white/10 rounded-md transition-colors"
              >
                Click viewport to lock mouse look · Drag or Arrow keys also supported
              </button>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Bottom Survival Dock */}
      {hud.phase === 'playing' && (
        <div
          className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex-col items-center pointer-events-auto max-w-[94vw] transition-all ${
            touchControlsEnabled ? 'hidden md:flex' : 'flex'
          }`}
        >
          {!touchControlsEnabled && (
            <button
              type="button"
              onClick={() => setDockCollapsed((v) => !v)}
              className="mb-1.5 inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-stone-400 hover:text-stone-200 bg-[#090b0e]/85 border border-white/10 rounded-md transition-colors whitespace-nowrap"
            >
              {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{dockCollapsed ? 'Show HUD (H)' : 'Hide HUD (H)'}</span>
            </button>
          )}

          {(!dockCollapsed || touchControlsEnabled) && (
            <div className="bg-[#090b0e]/88 border border-white/10 rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 flex flex-wrap items-center justify-center gap-3 sm:gap-5">
              {/* Flashlight Battery */}
              <div className="flex items-center gap-2.5 min-w-[140px]">
                <span className="text-xs text-stone-400">
                  Light ({hud.flashlightOn ? 'On' : 'Off'})
                </span>
                <div className="w-20 h-1.5 bg-stone-800 rounded-sm overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${
                      hud.battery <= 20 ? 'bg-red-500' : 'bg-amber-400'
                    }`}
                    style={{ width: `${hud.battery}%` }}
                  />
                </div>
                <span className="text-xs font-mono tabular-nums text-stone-200 w-9 text-right">
                  {hud.battery}%
                </span>
              </div>

              {/* Stamina */}
              <div className="flex items-center gap-2.5 min-w-[130px]">
                <span className="text-xs text-stone-400">Stamina</span>
                <div className="w-20 h-1.5 bg-stone-800 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-stone-200 transition-all duration-150"
                    style={{ width: `${hud.stamina}%` }}
                  />
                </div>
                <span className="text-xs font-mono tabular-nums text-stone-200 w-9 text-right">
                  {hud.stamina}%
                </span>
              </div>

              {/* Posture & Quick Hints */}
              <div className="hidden sm:flex items-center gap-2.5 text-xs text-stone-400">
                <span>{hud.crouching ? 'Crouched (C)' : 'Standing (C)'}</span>
                <span aria-hidden="true">·</span>
                <span>F Torch</span>
                <span aria-hidden="true">·</span>
                <span>E Use</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Field Note Reader Modal */}
      {hud.phase === 'note' && hud.activeNote && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-[#040507]/85 pointer-events-auto">
          <div className="w-full max-w-lg bg-[#111317] border border-white/15 rounded-lg p-6 md:p-8 shadow-2xl">
            <div className="flex items-center justify-between gap-4 text-xs font-mono text-stone-400">
              <span>{hud.activeNote.author}</span>
              <span>Logged {hud.activeNote.timestamp}</span>
            </div>
            <h2
              className="mt-2 text-xl md:text-2xl font-bold text-stone-100"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {hud.activeNote.title}
            </h2>
            <p className="mt-4 text-sm md:text-base text-stone-300 leading-relaxed">
              {hud.activeNote.body}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={onResume}
                className="px-5 py-2 text-xs font-semibold text-stone-950 bg-amber-500 hover:bg-amber-400 rounded-md transition-colors whitespace-nowrap"
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pause Overlay */}
      {hud.phase === 'paused' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-[#040507]/85 pointer-events-auto">
          <div className="w-full max-w-sm bg-[#0d0f13] border border-white/15 rounded-lg p-6 md:p-8">
            <h2
              className="text-2xl font-bold text-stone-100"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Paused
            </h2>
            <p className="mt-1.5 text-xs text-stone-400">
              {hud.sectorName} · Breakers {hud.breakersActivated}/{hud.totalBreakers}
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onResume}
                className="w-full px-4 py-2.5 text-sm font-semibold text-stone-950 bg-amber-500 hover:bg-amber-400 rounded-md transition-colors"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="w-full px-4 py-2.5 text-sm font-medium text-stone-200 bg-stone-800/80 hover:bg-stone-700/80 border border-white/10 rounded-md transition-colors"
              >
                Restart Run
              </button>
              <button
                type="button"
                onClick={onQuitToTitle}
                className="w-full px-4 py-2.5 text-sm font-medium text-stone-400 hover:text-stone-200 border border-white/10 rounded-md transition-colors"
              >
                Return to Title
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
