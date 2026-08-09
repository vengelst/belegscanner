"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NormalizedDocumentBounds } from "@/components/receipts/document-detector";

type CropBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DragTarget = "box" | "tl" | "tr" | "bl" | "br" | null;

type Props = {
  imageUrl: string;
  initialBounds: NormalizedDocumentBounds | null;
  onConfirm: (bounds: CropBounds) => void;
  onSkip: () => void;
  onRetake: () => void;
};

const DEFAULT_BOUNDS: CropBounds = { x: 0.05, y: 0.05, width: 0.9, height: 0.9 };
const MIN_SIZE = 0.08;
/** Sichtbarer Griff – gross genug zum sicheren Antippen auf dem Handy. */
const HANDLE_SIZE = 72;
/** Touch-/Klickflaeche um den Griff herum (Apple HIG: mind. ~44pt, hier deutlich mehr). */
const HANDLE_HIT_SIZE = 112;

export function CropEditor({ imageUrl, initialBounds, onConfirm, onSkip, onRetake }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [bounds, setBounds] = useState<CropBounds>(() =>
    initialBounds && initialBounds.width > 0.05 && initialBounds.height > 0.05
      ? { ...initialBounds }
      : { ...DEFAULT_BOUNDS },
  );
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const dragStartRef = useRef<{ px: number; py: number; bounds: CropBounds } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const getContainerRect = useCallback(() => {
    return containerRef.current?.getBoundingClientRect() ?? null;
  }, []);

  const toNormalized = useCallback(
    (clientX: number, clientY: number): { nx: number; ny: number } | null => {
      const rect = getContainerRect();
      if (!rect) return null;
      const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      return { nx, ny };
    },
    [getContainerRect],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent, target: DragTarget) => {
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
      const norm = toNormalized(event.clientX, event.clientY);
      if (!norm) return;
      dragStartRef.current = { px: norm.nx, py: norm.ny, bounds: { ...bounds } };
      setDragTarget(target);
    },
    [bounds, toNormalized],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!dragTarget || !dragStartRef.current) return;
      event.preventDefault();
      const norm = toNormalized(event.clientX, event.clientY);
      if (!norm) return;

      const dx = norm.nx - dragStartRef.current.px;
      const dy = norm.ny - dragStartRef.current.py;
      const b = dragStartRef.current.bounds;

      let next: CropBounds;

      if (dragTarget === "box") {
        let nx = b.x + dx;
        let ny = b.y + dy;
        nx = Math.max(0, Math.min(1 - b.width, nx));
        ny = Math.max(0, Math.min(1 - b.height, ny));
        next = { x: nx, y: ny, width: b.width, height: b.height };
      } else {
        let x1 = b.x;
        let y1 = b.y;
        let x2 = b.x + b.width;
        let y2 = b.y + b.height;

        if (dragTarget === "tl" || dragTarget === "bl") {
          x1 = Math.max(0, Math.min(x2 - MIN_SIZE, b.x + dx));
        }
        if (dragTarget === "tr" || dragTarget === "br") {
          x2 = Math.min(1, Math.max(x1 + MIN_SIZE, b.x + b.width + dx));
        }
        if (dragTarget === "tl" || dragTarget === "tr") {
          y1 = Math.max(0, Math.min(y2 - MIN_SIZE, b.y + dy));
        }
        if (dragTarget === "bl" || dragTarget === "br") {
          y2 = Math.min(1, Math.max(y1 + MIN_SIZE, b.y + b.height + dy));
        }

        next = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
      }

      setBounds(next);
    },
    [dragTarget, toNormalized],
  );

  const handlePointerUp = useCallback(() => {
    setDragTarget(null);
    dragStartRef.current = null;
  }, []);

  useEffect(() => {
    function onGlobalUp() {
      if (dragTarget) {
        setDragTarget(null);
        dragStartRef.current = null;
      }
    }
    window.addEventListener("pointerup", onGlobalUp);
    return () => window.removeEventListener("pointerup", onGlobalUp);
  }, [dragTarget]);

  const overlayStyle = {
    left: `${bounds.x * 100}%`,
    top: `${bounds.y * 100}%`,
    width: `${bounds.width * 100}%`,
    height: `${bounds.height * 100}%`,
  };

  return (
    <div className="flex h-full flex-col">
      <div
        ref={containerRef}
        className="relative flex-1 touch-none select-none overflow-hidden rounded-[2rem] border border-border bg-black/90"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img
          src={imageUrl}
          alt="Aufgenommener Beleg"
          className="h-full w-full object-contain"
          draggable={false}
          onLoad={() => setImageLoaded(true)}
        />

        {imageLoaded && (
          <>
            {/* Dimmed overlay outside crop */}
            <div className="pointer-events-none absolute inset-0">
              <div
                className="absolute inset-0 bg-black/50"
                style={{
                  clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${bounds.x * 100}% ${bounds.y * 100}%, ${bounds.x * 100}% ${(bounds.y + bounds.height) * 100}%, ${(bounds.x + bounds.width) * 100}% ${(bounds.y + bounds.height) * 100}%, ${(bounds.x + bounds.width) * 100}% ${bounds.y * 100}%, ${bounds.x * 100}% ${bounds.y * 100}%)`,
                }}
              />
            </div>

            {/* Crop rectangle */}
            <div
              className="absolute cursor-move border-2 border-white"
              style={overlayStyle}
              onPointerDown={(e) => handlePointerDown(e, "box")}
            >
              {/* Guide lines */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/3 top-0 h-full w-px bg-white/30" />
                <div className="absolute left-2/3 top-0 h-full w-px bg-white/30" />
                <div className="absolute left-0 top-1/3 h-px w-full bg-white/30" />
                <div className="absolute left-0 top-2/3 h-px w-full bg-white/30" />
              </div>
            </div>

            {/* Corner handles */}
            <CornerHandle
              position="tl"
              bounds={bounds}
              onPointerDown={(e) => handlePointerDown(e, "tl")}
            />
            <CornerHandle
              position="tr"
              bounds={bounds}
              onPointerDown={(e) => handlePointerDown(e, "tr")}
            />
            <CornerHandle
              position="bl"
              bounds={bounds}
              onPointerDown={(e) => handlePointerDown(e, "bl")}
            />
            <CornerHandle
              position="br"
              bounds={bounds}
              onPointerDown={(e) => handlePointerDown(e, "br")}
            />
          </>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          Zuschnitt anpassen: Ecken ziehen oder Rahmen verschieben.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRetake}
            className="bb-chip-button rounded-2xl px-6 py-4 text-sm"
          >
            Erneut aufnehmen
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="bb-chip-button rounded-2xl px-6 py-4 text-sm"
          >
            Ohne Zuschnitt
          </button>
          <button
            type="button"
            onClick={() => onConfirm(bounds)}
            className="flex-1 rounded-2xl bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Zuschnitt uebernehmen
          </button>
        </div>
      </div>
    </div>
  );
}

function CornerHandle({
  position,
  bounds,
  onPointerDown,
}: {
  position: "tl" | "tr" | "bl" | "br";
  bounds: CropBounds;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const isLeft = position === "tl" || position === "bl";
  const isTop = position === "tl" || position === "tr";

  const left = isLeft ? bounds.x * 100 : (bounds.x + bounds.width) * 100;
  const top = isTop ? bounds.y * 100 : (bounds.y + bounds.height) * 100;

  const cursorMap = {
    tl: "nwse-resize",
    tr: "nesw-resize",
    bl: "nesw-resize",
    br: "nwse-resize",
  } as const;

  return (
    <div
      className="absolute z-10"
      style={{
        left: `calc(${left}% - ${HANDLE_HIT_SIZE / 2}px)`,
        top: `calc(${top}% - ${HANDLE_HIT_SIZE / 2}px)`,
        width: `${HANDLE_HIT_SIZE}px`,
        height: `${HANDLE_HIT_SIZE}px`,
        cursor: cursorMap[position],
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
    >
      <div
        className="absolute rounded-full border-[3px] border-white bg-primary shadow-md"
        style={{
          left: `${(HANDLE_HIT_SIZE - HANDLE_SIZE) / 2}px`,
          top: `${(HANDLE_HIT_SIZE - HANDLE_SIZE) / 2}px`,
          width: `${HANDLE_SIZE}px`,
          height: `${HANDLE_SIZE}px`,
        }}
      />
      {/* Corner L-bracket indicator */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: `${HANDLE_HIT_SIZE / 2 - 1}px`,
          top: `${HANDLE_HIT_SIZE / 2 - 1}px`,
          width: "14px",
          height: "14px",
          borderColor: "white",
          borderWidth: 0,
          ...(position === "tl" && { borderTopWidth: "3px", borderLeftWidth: "3px", transform: "translate(-13px, -13px)" }),
          ...(position === "tr" && { borderTopWidth: "3px", borderRightWidth: "3px", transform: "translate(0px, -13px)" }),
          ...(position === "bl" && { borderBottomWidth: "3px", borderLeftWidth: "3px", transform: "translate(-13px, 0px)" }),
          ...(position === "br" && { borderBottomWidth: "3px", borderRightWidth: "3px", transform: "translate(0px, 0px)" }),
        }}
      />
    </div>
  );
}
