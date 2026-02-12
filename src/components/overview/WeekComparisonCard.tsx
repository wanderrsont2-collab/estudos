import type { WeekComparisonData } from './types';
import { formatPercent } from './utils';

interface WeekComparisonCardProps {
  weekComparison: WeekComparisonData;
  accuracyDeltaPp: number;
}

export function WeekComparisonCard({ weekComparison, accuracyDeltaPp }: WeekComparisonCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
      <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-3">Esta semana vs anterior</h3>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-slate-500">Questoes</p>
          <p className="text-lg font-bold text-slate-700 dark:text-slate-100">
            {weekComparison.thisWeek.total}
            <span className={`ml-1.5 text-xs font-medium ${weekComparison.questionsDelta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {weekComparison.questionsDelta >= 0 ? '+' : '-'}{Math.abs(weekComparison.questionsDelta)}
            </span>
          </p>
        </div>
        <div>
          <p className="text-slate-500">Acerto</p>
          <p className="text-lg font-bold text-slate-700 dark:text-slate-100">
            {formatPercent(weekComparison.accuracyThis)}
            <span className={`ml-1.5 text-xs font-medium ${accuracyDeltaPp >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {accuracyDeltaPp >= 0 ? '+' : ''}{accuracyDeltaPp}pp
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
