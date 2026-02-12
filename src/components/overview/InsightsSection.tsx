import { AlertTriangle } from 'lucide-react';
import type { Subject } from '../../types';
import { formatPercent } from './utils';

interface InsightsSectionProps {
  weakSubjects: Array<{
    subject: Subject;
    stats: {
      rendimento: number;
      questionsTotal: number;
    };
  }>;
  neglectedSubjects: Array<{
    subject: Subject;
    daysSince: number;
  }>;
  onSelectSubject: (id: string) => void;
}

export function InsightsSection({ weakSubjects, neglectedSubjects, onSelectSubject }: InsightsSectionProps) {
  if (weakSubjects.length === 0 && neglectedSubjects.length === 0) return null;

  return (
    <section className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
      <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-200 inline-flex items-center gap-2">
        <AlertTriangle size={16} /> Insights e alertas
      </h2>
      <div className="mt-3 space-y-2">
        {weakSubjects.map(({ subject, stats }) => (
          <button
            key={`weak-${subject.id}`}
            onClick={() => onSelectSubject(subject.id)}
            className="w-full text-left text-xs bg-white/70 dark:bg-slate-900/50 rounded-lg px-3 py-2 hover:bg-white transition-colors"
          >
            {subject.emoji} {subject.name} com rendimento {formatPercent(stats.rendimento)} ({stats.questionsTotal} questoes)
          </button>
        ))}
        {neglectedSubjects.map(({ subject, daysSince }) => (
          <button
            key={`neglected-${subject.id}`}
            onClick={() => onSelectSubject(subject.id)}
            className="w-full text-left text-xs bg-white/70 dark:bg-slate-900/50 rounded-lg px-3 py-2 hover:bg-white transition-colors"
          >
            {subject.emoji} {subject.name} sem atividade ha <strong>{daysSince} dias</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
