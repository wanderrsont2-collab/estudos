import { memo } from 'react';
import { LineChart } from 'lucide-react';
import type { ActivityDay } from './types';

const EvolutionBar = memo(function EvolutionBar({ day, max }: { day: ActivityDay; max: number }) {
  const barHeight = Math.max(6, Math.round((day.questionsMade / max) * 100));
  return (
    <div className="flex flex-col items-center justify-end gap-1">
      <div
        className={`w-full rounded-t transition-all ${day.questionsMade > 0 ? 'bg-cyan-500 dark:bg-cyan-400' : 'bg-slate-200 dark:bg-slate-700'}`}
        style={{ height: `${barHeight}%` }}
        title={`${new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR')}: ${day.questionsMade} questoes`}
      />
      <span className="text-[9px] text-slate-500 dark:text-slate-400">{new Date(day.date + 'T00:00:00').getDate()}</span>
    </div>
  );
});

interface EvolutionPanelProps {
  evolutionTrend: number;
  last14Total: number;
  last14Correct: number;
  todayQuestionsMade: number;
  evolutionDays: ActivityDay[];
  evolutionMax: number;
}

export function EvolutionPanel({
  evolutionTrend,
  last14Total,
  last14Correct,
  todayQuestionsMade,
  evolutionDays,
  evolutionMax,
}: EvolutionPanelProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100 inline-flex items-center gap-2">
          <LineChart size={16} /> Dashboard de evolucao real (14 dias)
        </h3>
        <span className={`text-xs px-2 py-1 rounded-full ${evolutionTrend >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200'}`}>
          {evolutionTrend >= 0 ? '+' : ''}{Math.round(evolutionTrend * 100)}%
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Questoes (14d)</p><p className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-0.5">{last14Total}</p></div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Hoje</p><p className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-0.5">{todayQuestionsMade}</p></div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Media</p><p className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-0.5">{Math.round(last14Total / 14)}</p></div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Acerto</p><p className="text-xl font-bold text-violet-600 mt-0.5">{last14Total > 0 ? `${Math.round((last14Correct / last14Total) * 100)}%` : '--'}</p></div>
      </div>
      <div className="mt-4">
        <div className="h-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-3 py-2">
          <div className="h-full grid grid-cols-14 gap-1 items-end">
            {evolutionDays.map(day => <EvolutionBar key={`evolution-${day.date}`} day={day} max={evolutionMax} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
