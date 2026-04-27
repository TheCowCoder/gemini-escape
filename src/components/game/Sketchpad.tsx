import React, { useEffect, useRef, useState } from 'react';
import { Eraser, PenLine } from 'lucide-react';
import type { SketchAttachment } from '../../types';

type BrushTexture = 'ink' | 'marker' | 'chalk';

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 384;
const PALETTE = ['#111827', '#dc2626', '#2563eb', '#059669', '#d97706', '#7c3aed', '#f8fafc'];
const BRUSH_SIZES = [2, 4, 8, 14, 20, 27];

const paintCanvasBackground = (context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
  context.save();
  context.fillStyle = '#faf7ef';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = 'rgba(15, 23, 42, 0.06)';
  context.lineWidth = 1;

  for (let x = 0; x < canvas.width; x += 24) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }

  for (let y = 0; y < canvas.height; y += 24) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }

  context.restore();
};

export const Sketchpad: React.FC<{
  value?: SketchAttachment;
  onChange: (next?: SketchAttachment) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(PALETTE[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [brushTexture, setBrushTexture] = useState<BrushTexture>('ink');
  const [isEraser, setIsEraser] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(Boolean(value?.dataUrl));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    paintCanvasBackground(context, canvas);
    setHasDrawing(Boolean(value?.dataUrl));

    if (value?.dataUrl) {
      const image = new Image();
      image.onload = () => {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
      };
      image.src = value.dataUrl;
    }
  }, [value?.dataUrl]);

  const exportSketch = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const nextDataUrl = canvas.toDataURL('image/png');
    onChange({
      dataUrl: nextDataUrl,
      width: canvas.width,
      height: canvas.height,
    });
    setHasDrawing(true);
  };

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  };

  const drawSegment = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }

    context.save();
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.strokeStyle = isEraser ? '#faf7ef' : color;

    if (isEraser) {
      context.globalAlpha = 1.0;
      context.lineWidth = brushSize * 1.5;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    } else if (brushTexture === 'marker') {
      context.globalAlpha = 0.38;
      context.lineWidth = brushSize * 1.8;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    } else if (brushTexture === 'chalk') {
      for (let pass = 0; pass < 3; pass += 1) {
        context.globalAlpha = 0.14;
        context.lineWidth = brushSize + pass;
        context.beginPath();
        context.moveTo(from.x + (Math.random() - 0.5) * 3, from.y + (Math.random() - 0.5) * 3);
        context.lineTo(to.x + (Math.random() - 0.5) * 3, to.y + (Math.random() - 0.5) * 3);
        context.stroke();
      }
    } else {
      context.globalAlpha = 0.95;
      context.lineWidth = brushSize;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    }

    context.restore();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event);
    isDrawingRef.current = true;
    lastPointRef.current = point;
    drawSegment(point, point);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || disabled) {
      return;
    }

    const nextPoint = getCanvasPoint(event);
    const previousPoint = lastPointRef.current;
    if (!previousPoint) {
      lastPointRef.current = nextPoint;
      return;
    }

    drawSegment(previousPoint, nextPoint);
    lastPointRef.current = nextPoint;
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) {
      return;
    }

    isDrawingRef.current = false;
    lastPointRef.current = null;
    exportSketch();
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }

    paintCanvasBackground(context, canvas);
    setHasDrawing(false);
    onChange(undefined);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-gray-900/80 p-3 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-gray-500">Palette</span>
          {PALETTE.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => setColor(swatch)}
              className={`h-6 w-6 rounded-full border transition-transform ${color === swatch ? 'scale-110 border-white' : 'border-white/10'}`}
              style={{ backgroundColor: swatch }}
              aria-label={`Use ${swatch} brush`}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-gray-500">Brush</span>
          
          <button
            type="button"
            onClick={() => setIsEraser(!isEraser)}
            className={`flex h-8 items-center gap-2 rounded-full border px-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${isEraser ? 'border-rose-400 bg-rose-500/15 text-rose-100' : 'border-white/10 text-gray-400'}`}
          >
            <Eraser size={14} />
            Eraser
          </button>

          <div className="mx-1 h-4 w-px bg-white/10" />

          {(['ink', 'marker', 'chalk'] as BrushTexture[]).map((texture) => (
            <button
              key={texture}
              type="button"
              disabled={isEraser}
              onClick={() => {
                setBrushTexture(texture);
                setIsEraser(false);
              }}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] disabled:opacity-30 ${!isEraser && brushTexture === texture ? 'border-teal-400 bg-teal-500/15 text-teal-100' : 'border-white/10 text-gray-400'}`}
            >
              {texture}
            </button>
          ))}
          
          <div className="mx-1 h-4 w-px bg-white/10" />

          {BRUSH_SIZES.map((sizeOption) => (
            <button
              key={sizeOption}
              type="button"
              onClick={() => setBrushSize(sizeOption)}
              className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${brushSize === sizeOption ? 'border-amber-300 bg-amber-300/15 text-amber-100' : 'border-white/10 text-gray-400'}`}
              aria-label={`Use brush size ${sizeOption}`}
            >
              <div className="rounded-full bg-current" style={{ width: Math.max(2, sizeOption / 2), height: Math.max(2, sizeOption / 2) }} />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleClear}
          disabled={disabled || !hasDrawing}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-300 transition-colors hover:border-rose-400/60 hover:text-rose-100 disabled:opacity-40"
        >
          <Eraser size={12} />
          Clear
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#faf7ef] shadow-inner">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          onPointerCancel={stopDrawing}
          className={`block h-auto w-full touch-none ${disabled ? 'opacity-50' : 'cursor-crosshair'}`}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-2">
          <PenLine size={12} />
          Sketches guide planning but do not create missing resources.
        </span>
        <span>{hasDrawing ? 'Sketch attached' : 'Empty sketchpad'}</span>
      </div>
    </div>
  );
};