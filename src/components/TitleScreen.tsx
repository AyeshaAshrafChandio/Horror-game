import React from 'react';
import { Gamepad2, Volume2, VolumeX } from 'lucide-react';
import { DifficultyMode } from '../game/types';

interface TitleScreenProps {
  difficulty: DifficultyMode;
  muted: boolean;
  touchControlsEnabled: boolean;
  onSelectDifficulty: (mode: DifficultyMode) => void;
  onToggleTouchControls: () => void;
  onStart: () => void;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  difficulty,
  muted,
  touchControlsEnabled,
  onSelectDifficulty,
  onToggleTouchControls,
  onStart,
  onToggleMute,
}) => {
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-5 sm:p-6 md:p-10 bg-gradient-to-r from-[#050608]/92 via-[#050608]/65 to-[#050608]/25 overflow-y-auto">
      {/* Top Row: Quiet brand mark & Controls/Audio toggles */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-[11px] sm:text-xs font-mono tracking-widest text-stone-400 uppercase truncate">
          Blackwood Research Facility · Sublevel B4
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleTouchControls}
            className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium border rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-500 ${
              touchControlsEnabled
                ? 'bg-amber-500/15 border-amber-400/50 text-amber-300'
                : 'bg-[#0d0f12]/90 border-white/10 text-stone-300 hover:text-white hover:border-white/25'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            <span>{touchControlsEnabled ? 'Mobile Controls: On' : 'Mobile Controls: Off'}</span>
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-stone-300 bg-[#0d0f12]/90 border border-white/10 rounded-md hover:text-white hover:border-white/25 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-500"
            aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {muted ? <VolumeX className="w-4 h-4 text-stone-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
            <span className="hidden sm:inline">{muted ? 'Audio Muted' : 'Audio On'}</span>
          </button>
        </div>
      </div>

      {/* Main Focal Anchor */}
      <div className="max-w-xl my-auto py-6">
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-wide text-stone-100 leading-tight"
          style={{ fontFamily: 'var(--font-display)', textWrap: 'balance' }}
        >
          Hollow Frequency
        </h1>

        <p className="mt-4 text-sm sm:text-base text-stone-300 leading-relaxed max-w-md">
          Power has failed across Sublevel B4. Restore the four corner circuit breakers and return to the north freight lift before the thing in the dark finds you.
        </p>

        {/* Difficulty Segmented Control */}
        <div className="mt-6 flex flex-col gap-2">
          <span className="text-xs font-medium text-stone-400">Difficulty</span>
          <div className="inline-flex w-fit p-1 bg-[#0b0d10]/90 border border-white/10 rounded-lg gap-1">
            <button
              type="button"
              onClick={() => onSelectDifficulty('standard')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                difficulty === 'standard'
                  ? 'bg-stone-100 text-stone-950'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => onSelectDifficulty('nightmare')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                difficulty === 'nightmare'
                  ? 'bg-red-700 text-white'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Nightmare
            </button>
          </div>
          <p className="text-xs text-stone-400">
            {difficulty === 'standard'
              ? 'Balanced patrol speed and battery reserves.'
              : 'Faster stalker pursuit, wider sight range, and rapid battery drain.'}
          </p>
        </div>

        {/* Primary CTA */}
        <div className="mt-7 flex items-center gap-4">
          <button
            type="button"
            onClick={onStart}
            className="px-6 py-3 text-sm font-semibold text-stone-950 bg-amber-500 hover:bg-amber-400 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            Enter Sublevel B4
          </button>
        </div>
      </div>

      {/* Bottom Controls Strip (Clean unboxed typography) */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-400">
        {touchControlsEnabled ? (
          <>
            <span>Left Stick Move</span>
            <span aria-hidden="true">·</span>
            <span>Right Screen Drag Look</span>
            <span aria-hidden="true">·</span>
            <span>On-Screen Buttons for Torch, Crouch, Sprint &amp; Use</span>
          </>
        ) : (
          <>
            <span>WASD Move</span>
            <span aria-hidden="true">·</span>
            <span>Mouse Look</span>
            <span aria-hidden="true">·</span>
            <span>Shift Sprint</span>
            <span aria-hidden="true">·</span>
            <span>C Crouch</span>
            <span aria-hidden="true">·</span>
            <span>F Flashlight</span>
            <span aria-hidden="true">·</span>
            <span>E Interact</span>
          </>
        )}
      </div>
    </div>
  );
};
