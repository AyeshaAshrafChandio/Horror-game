import React from 'react';
import { RunSummary } from '../game/types';

interface EndScreenProps {
  summary: RunSummary;
  onRetry: () => void;
  onReturnTitle: () => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const EndScreen: React.FC<EndScreenProps> = ({ summary, onRetry, onReturnTitle }) => {
  const escaped = summary.outcome === 'escaped';

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-[#050608]/92">
      <div className="w-full max-w-md bg-[#0c0e12] border border-white/15 rounded-lg p-7 md:p-9">
        <span
          className={`text-xs font-mono tracking-wider uppercase ${
            escaped ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {escaped ? 'Sublevel B4 Cleared' : 'Connection Severed'}
        </span>

        <h2
          className="mt-2 text-3xl md:text-4xl font-bold text-stone-100"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {escaped ? 'Ascent Initiated' : 'Signal Lost'}
        </h2>

        <p className="mt-3 text-sm text-stone-300 leading-relaxed">
          {escaped
            ? 'The north freight lift engaged as emergency floodgates sealed Sublevel B4 behind you.'
            : 'The Hollow Watcher closed the distance in the dark. Your signal never reached the surface.'}
        </p>

        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 gap-y-4 gap-x-6 text-xs">
          <div>
            <div className="text-stone-400">Time</div>
            <div className="mt-1 text-base font-mono tabular-nums text-stone-100">
              {formatDuration(summary.elapsedSeconds)}
            </div>
          </div>
          <div>
            <div className="text-stone-400">Difficulty</div>
            <div className="mt-1 text-base font-medium text-stone-100 capitalize">
              {summary.difficulty}
            </div>
          </div>
          <div>
            <div className="text-stone-400">Breakers Restored</div>
            <div className="mt-1 text-base font-mono tabular-nums text-stone-100">
              {summary.breakersActivated} / {summary.totalBreakers}
            </div>
          </div>
          <div>
            <div className="text-stone-400">Logs Recovered</div>
            <div className="mt-1 text-base font-mono tabular-nums text-stone-100">
              {summary.notesCollected} / {summary.totalNotes}
            </div>
          </div>
        </div>

        <div className="mt-7 flex items-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 px-5 py-2.5 text-sm font-semibold text-stone-950 bg-amber-500 hover:bg-amber-400 rounded-md transition-colors whitespace-nowrap"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="px-4 py-2.5 text-sm font-medium text-stone-300 hover:text-white border border-white/15 rounded-md transition-colors whitespace-nowrap"
          >
            Title
          </button>
        </div>
      </div>
    </div>
  );
};
