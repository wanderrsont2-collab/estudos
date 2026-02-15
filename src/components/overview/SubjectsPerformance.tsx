import { BookOpen, ArrowRight } from 'lucide-react';
import type { Subject } from '../../types';
import type { SubjectStatsView } from './types';
import { formatPercent } from './utils';

interface SubjectsPerformanceProps {
  subjectsCount: number;
  sortedSubjects: Array<{ subject: Subject; stats: SubjectStatsView }>;
  onSelectSubject: (id: string) => void;
}

export function SubjectsPerformance({ subjectsCount, sortedSubjects, onSelectSubject }: SubjectsPerformanceProps) {
  return (
    <div className="animate-fade-in rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-blue-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Disciplinas</h3>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{subjectsCount} total</span>
        </div>

        {sortedSubjects.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm text-slate-400">Nenhuma disciplina cadastrada</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedSubjects.map(({ subject, stats }) => (
              <button
                key={subject.id}
                onClick={() => onSelectSubject(subject.id)}
                className="w-full text-left rounded-xl border border-slate-100 dark:border-slate-800 p-3.5 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-md transition-all duration-200 group bg-slate-50/50 dark:bg-slate-800/30"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: subject.color }} />
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                      {subject.emoji} {subject.name}
                    </span>
                  </div>
                  <ArrowRight size={14} className="text-slate-300 group-hover:text-cyan-500 transition-colors shrink-0" />
                </div>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{stats.studied}</span>/{stats.total} topicos
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    Rendimento:{' '}
                    <span className={`font-bold ${
                      stats.rendimento >= 0.7
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : stats.rendimento >= 0.5
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatPercent(stats.rendimento)}
                    </span>
                  </span>
                </div>
                <div className="mt-2.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, stats.progresso * 100)}%`,
                      backgroundColor: subject.color,
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
