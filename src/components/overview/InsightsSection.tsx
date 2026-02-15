import { Lightbulb, AlertCircle, ArrowRight } from 'lucide-react';
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
  if (weakSubjects.length === 0 && neglectedSubjects.length === 0) {
    return (
      <div className="animate-fade-in rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20 p-5 text-center">
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Tudo em dia.</p>
        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/60 mt-1">Nenhuma disciplina precisa de atencao urgente.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb size={18} className="text-amber-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Insights</h3>
        </div>

        {weakSubjects.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2.5">
              <AlertCircle size={13} className="text-red-500" />
              <p className="text-[10px] uppercase tracking-wider font-bold text-red-500">Baixo rendimento</p>
            </div>
            <div className="space-y-2">
              {weakSubjects.map(({ subject, stats }) => (
                <button
                  key={subject.id}
                  onClick={() => onSelectSubject(subject.id)}
                  className="w-full text-left rounded-xl border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/10 p-3 flex items-center justify-between group hover:border-red-200 dark:hover:border-red-800/50 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: subject.color }} />
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {subject.emoji} {subject.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-red-500">
                      {formatPercent(stats.rendimento)}
                    </span>
                    <ArrowRight size={14} className="text-slate-400 group-hover:text-red-500 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {neglectedSubjects.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <AlertCircle size={13} className="text-amber-500" />
              <p className="text-[10px] uppercase tracking-wider font-bold text-amber-500">Pouco estudadas</p>
            </div>
            <div className="space-y-2">
              {neglectedSubjects.map(({ subject, daysSince }) => (
                <button
                  key={subject.id}
                  onClick={() => onSelectSubject(subject.id)}
                  className="w-full text-left rounded-xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/10 p-3 flex items-center justify-between group hover:border-amber-200 dark:hover:border-amber-800/50 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: subject.color }} />
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {subject.emoji} {subject.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-amber-500">{daysSince}d</span>
                    <ArrowRight size={14} className="text-slate-400 group-hover:text-amber-500 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
