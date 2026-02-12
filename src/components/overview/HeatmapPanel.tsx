import { memo, useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import type { HeatmapDay } from './types';

const HeatmapCell = memo(function HeatmapCell({
  day,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
}: {
  day: HeatmapDay;
  onHoverStart: (event: ReactMouseEvent<HTMLDivElement>, day: HeatmapDay) => void;
  onHoverMove: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onHoverEnd: () => void;
}) {
  return (
    <div
      onMouseEnter={event => onHoverStart(event, day)}
      onMouseMove={onHoverMove}
      onMouseLeave={onHoverEnd}
      className={`h-4 w-4 sm:h-5 sm:w-5 rounded-[4px] transition-transform hover:scale-110 ${
        day.count === 0
          ? 'bg-slate-100 dark:bg-slate-800'
          : day.count < 10
            ? 'bg-indigo-300 dark:bg-indigo-900/60'
            : day.count < 30
              ? 'bg-indigo-500'
              : 'bg-indigo-600 shadow-lg shadow-indigo-500/30'
      }`}
    />
  );
});

interface HeatmapPanelProps {
  heatmapDays: HeatmapDay[];
  streakCurrent: number;
  streakLongest: number;
}

export function HeatmapPanel({ heatmapDays, streakCurrent, streakLongest }: HeatmapPanelProps) {
  const heatmapTooltipRef = useRef<HTMLDivElement | null>(null);
  const heatmapTooltipDateRef = useRef<HTMLParagraphElement | null>(null);
  const heatmapTooltipCountRef = useRef<HTMLParagraphElement | null>(null);

  const positionHeatmapTooltip = useCallback((x: number, y: number) => {
    if (!heatmapTooltipRef.current) return;
    heatmapTooltipRef.current.style.transform = `translate3d(${x + 10}px, ${y - 14}px, 0)`;
  }, []);

  const handleHeatmapHoverStart = useCallback((event: ReactMouseEvent<HTMLDivElement>, day: HeatmapDay) => {
    const el = heatmapTooltipRef.current;
    if (!el) return;
    if (heatmapTooltipDateRef.current) {
      heatmapTooltipDateRef.current.textContent = new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR');
    }
    if (heatmapTooltipCountRef.current) {
      heatmapTooltipCountRef.current.textContent = `${day.count} questoes`;
    }
    el.style.opacity = '1';
    positionHeatmapTooltip(event.clientX, event.clientY);
  }, [positionHeatmapTooltip]);

  const handleHeatmapHoverMove = useCallback((event: ReactMouseEvent<HTMLDivElement>) => positionHeatmapTooltip(event.clientX, event.clientY), [positionHeatmapTooltip]);

  const handleHeatmapHoverEnd = useCallback(() => {
    if (heatmapTooltipRef.current) {
      heatmapTooltipRef.current.style.opacity = '0';
      heatmapTooltipRef.current.style.transform = 'translate3d(-9999px, -9999px, 0)';
    }
  }, []);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Consistencia (28 dias)</h3>
      </div>
      <div className="relative">
        <div className="inline-grid grid-cols-7 gap-1.5 max-w-max">
          {heatmapDays.map(day => (
            <HeatmapCell
              key={`heatmap-${day.date}`}
              day={day}
              onHoverStart={handleHeatmapHoverStart}
              onHoverMove={handleHeatmapHoverMove}
              onHoverEnd={handleHeatmapHoverEnd}
            />
          ))}
        </div>
        <div ref={heatmapTooltipRef} className="fixed z-[90] pointer-events-none px-2 py-1 rounded-md border border-white/15 bg-slate-900/75 backdrop-blur-sm text-[10px] text-slate-100 shadow-xl opacity-0 transition-opacity" style={{ top: 0, left: 0, transform: 'translate3d(-9999px, -9999px, 0)' }}>
          <p ref={heatmapTooltipDateRef} className="font-medium">-</p>
          <p ref={heatmapTooltipCountRef} className="text-slate-300" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800 pt-3">
        <div>
          <span className="block text-slate-400">Streak atual</span>
          <span className="font-bold text-slate-700 dark:text-slate-200">{streakCurrent} dias</span>
        </div>
        <div className="text-center">
          <span className="block text-slate-400">Legenda</span>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[9px]">Menos</span>
            <div className="w-2 h-2 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="w-2 h-2 rounded bg-indigo-300 dark:bg-indigo-900/60" />
            <div className="w-2 h-2 rounded bg-indigo-500" />
            <div className="w-2 h-2 rounded bg-indigo-600" />
            <span className="text-[9px]">Mais</span>
          </div>
        </div>
        <div className="text-right">
          <span className="block text-slate-400">Recorde</span>
          <span className="font-bold text-slate-700 dark:text-slate-200">{streakLongest} dias</span>
        </div>
      </div>
    </div>
  );
}
