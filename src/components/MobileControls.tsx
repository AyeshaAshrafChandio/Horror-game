import React, { useRef, useState } from 'react';
import { Flashlight, Hand, PersonStanding, Zap } from 'lucide-react';
import { InteractPrompt } from '../game/types';

interface MobileControlsProps {
  flashlightOn: boolean;
  crouching: boolean;
  activePrompt: InteractPrompt | null;
  onMove: (x: number, y: number) => void;
  onLookDelta: (dx: number, dy: number) => void;
  onSprintChange: (active: boolean) => void;
  onToggleFlashlight: () => void;
  onToggleCrouch: () => void;
  onInteract: () => void;
}

const STICK_MAX_RADIUS = 44;

export const MobileControls: React.FC<MobileControlsProps> = ({
  flashlightOn,
  crouching,
  activePrompt,
  onMove,
  onLookDelta,
  onSprintChange,
  onToggleFlashlight,
  onToggleCrouch,
  onInteract,
}) => {
  const stickBaseRef = useRef<HTMLDivElement | null>(null);
  const stickPointerId = useRef<number | null>(null);
  const lookPointerId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [sprintHeld, setSprintHeld] = useState(false);

  const updateStickFromPointer = (clientX: number, clientY: number) => {
    const base = stickBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist > STICK_MAX_RADIUS) {
      dx = (dx / dist) * STICK_MAX_RADIUS;
      dy = (dy / dist) * STICK_MAX_RADIUS;
    }

    setKnobOffset({ x: dx, y: dy });
    // Screen Y down is backward (-1), up is forward (+1)
    onMove(dx / STICK_MAX_RADIUS, -dy / STICK_MAX_RADIUS);
  };

  const resetStick = () => {
    stickPointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div className="absolute inset-0 z-20 pointer-events-none select-none touch-none">
      {/* Right-Side Invisible Touch-Look Swipe Area */}
      <div
        className="absolute top-16 right-0 bottom-0 left-[38%] pointer-events-auto touch-none"
        aria-label="Drag to look around"
        onPointerDown={(e) => {
          if (lookPointerId.current !== null) return;
          lookPointerId.current = e.pointerId;
          lastLookPos.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (lookPointerId.current !== e.pointerId) return;
          const dx = e.clientX - lastLookPos.current.x;
          const dy = e.clientY - lastLookPos.current.y;
          lastLookPos.current = { x: e.clientX, y: e.clientY };
          onLookDelta(dx, dy);
        }}
        onPointerUp={(e) => {
          if (lookPointerId.current === e.pointerId) {
            lookPointerId.current = null;
          }
        }}
        onPointerCancel={(e) => {
          if (lookPointerId.current === e.pointerId) {
            lookPointerId.current = null;
          }
        }}
      />

      {/* Left Virtual Thumbstick Handle */}
      <div className="absolute bottom-6 left-5 md:bottom-8 md:left-8 pointer-events-auto touch-none flex flex-col items-center gap-1.5">
        <div
          ref={stickBaseRef}
          className="relative w-28 h-28 rounded-full bg-[#090b0e]/75 border border-white/15 flex items-center justify-center touch-none"
          aria-label="Movement joystick"
          onPointerDown={(e) => {
            if (stickPointerId.current !== null) return;
            stickPointerId.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            updateStickFromPointer(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (stickPointerId.current !== e.pointerId) return;
            updateStickFromPointer(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (stickPointerId.current === e.pointerId) {
              resetStick();
            }
          }}
          onPointerCancel={(e) => {
            if (stickPointerId.current === e.pointerId) {
              resetStick();
            }
          }}
        >
          {/* Crosshair guide lines */}
          <div className="w-16 h-px bg-white/10 pointer-events-none" />
          <div className="h-16 w-px bg-white/10 absolute pointer-events-none" />

          {/* Movable Thumb Handle */}
          <div
            className="w-12 h-12 rounded-full bg-stone-200/20 border-2 border-amber-400/80 shadow-lg pointer-events-none"
            style={{
              transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            }}
          />
        </div>
        <span className="text-[11px] font-medium text-stone-400">Move</span>
      </div>

      {/* Right-Side Action Handle Buttons (>= 48px touch targets) */}
      <div className="absolute bottom-6 right-5 md:bottom-8 md:right-8 pointer-events-auto touch-none grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onToggleFlashlight();
          }}
          className={`min-w-[56px] min-h-[56px] px-3 py-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors ${
            flashlightOn
              ? 'bg-amber-500/20 border-amber-400/70 text-amber-300'
              : 'bg-[#090b0e]/85 border-white/15 text-stone-300'
          }`}
          aria-label="Toggle Flashlight"
        >
          <Flashlight className="w-5 h-5" />
          <span className="text-[11px] font-medium whitespace-nowrap">Torch</span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onToggleCrouch();
          }}
          className={`min-w-[56px] min-h-[56px] px-3 py-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors ${
            crouching
              ? 'bg-stone-100 text-stone-950 border-white'
              : 'bg-[#090b0e]/85 border-white/15 text-stone-300'
          }`}
          aria-label="Toggle Crouch"
        >
          <PersonStanding className="w-5 h-5" />
          <span className="text-[11px] font-medium whitespace-nowrap">
            {crouching ? 'Low' : 'Crouch'}
          </span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            setSprintHeld(true);
            onSprintChange(true);
          }}
          onPointerUp={() => {
            setSprintHeld(false);
            onSprintChange(false);
          }}
          onPointerCancel={() => {
            setSprintHeld(false);
            onSprintChange(false);
          }}
          className={`min-w-[56px] min-h-[56px] px-3 py-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors ${
            sprintHeld
              ? 'bg-stone-200 text-stone-950 border-white'
              : 'bg-[#090b0e]/85 border-white/15 text-stone-300'
          }`}
          aria-label="Hold to Sprint"
        >
          <Zap className="w-5 h-5" />
          <span className="text-[11px] font-medium whitespace-nowrap">Sprint</span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onInteract();
          }}
          className={`min-w-[56px] min-h-[56px] px-3 py-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors ${
            activePrompt && !activePrompt.lockedReason
              ? 'bg-amber-500 text-stone-950 border-amber-300'
              : 'bg-[#090b0e]/85 border-white/15 text-stone-400'
          }`}
          aria-label="Interact"
        >
          <Hand className="w-5 h-5" />
          <span className="text-[11px] font-semibold whitespace-nowrap">Use</span>
        </button>
      </div>
    </div>
  );
};
