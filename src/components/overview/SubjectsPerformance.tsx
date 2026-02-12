import { memo } from 'react';
import { TrendingUp } from 'lucide-react';
import type { Subject } from '../../types';
import type { SubjectStatsView } from './types';
import { formatPercent } from './utils';

interface SubjectsPerformanceProps {
  subjectsCount: number;
  sortedSubjects: Array<{ subject: Subject; stats: SubjectStatsView }>;
  onSelectSubject: (id: string) => void;
}

const SubjectRow = memo(function SubjectRow({
  subject,
  stats,
  onSelectSubject,
}: {
  subject: Subject;
  stats: SubjectStatsView;
  onSelectSubject: (id: string) => void;
}) {
  return (
    <button onClick={() => onSelectSubject(subject.id)} className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: subject.color }}>{subject.emoji} {subject.name}</p>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
            {stats.studied}/{stats.total} estudados - {stats.questionsCorrect}/{stats.questionsTotal} questoes
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-gray-700 dark:text-slate-100">{formatPercent(stats.progresso)}</p>
          <p className="text-[11px] text-gray-400 dark:text-slate-500">{formatPercent(stats.rendimento)} rend.</p>
        </div>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
        <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(stats.progresso * 100, 100)}%`, backgroundColor: subject.color }} />
      </div>
    </button>
  );
});

export function SubjectsPerformance({ subjectsCount, sortedSubjects, onSelectSubject }: SubjectsPerformanceProps) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-100 inline-flex items-center gap-2">
          <TrendingUp size={16} /> Desempenho por disciplina
        </h2>
        <span className="text-xs text-gray-400 dark:text-slate-500">{subjectsCount} disciplinas</span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-slate-800">
        {sortedSubjects.map(({ subject, stats }) => (
          <SubjectRow key={`subject-row-${subject.id}`} subject={subject} stats={stats} onSelectSubject={onSelectSubject} />
        ))}
      </div>
    </div>
  );
}
