import { Target } from 'lucide-react';
import type { DeadlineDisplayItem } from './types';

interface PrioritiesPanelProps {
  priorityStats: {
    alta: number;
    media: number;
    baixa: number;
    sem: number;
  };
  upcomingDeadlines: DeadlineDisplayItem[];
  onSelectSubject: (id: string) => void;
}

export function PrioritiesPanel({ priorityStats, upcomingDeadlines, onSelectSubject }: PrioritiesPanelProps) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-sm p-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-100 inline-flex items-center gap-2">
        <Target size={16} /> Prioridades e prazos
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-2.5">
          <p className="text-red-700 dark:text-red-300 font-medium">Alta</p>
          <p className="text-xl font-bold text-red-700 dark:text-red-300 mt-0.5">{priorityStats.alta}</p>
        </div>
        <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 p-2.5">
          <p className="text-yellow-700 dark:text-yellow-300 font-medium">Media</p>
          <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300 mt-0.5">{priorityStats.media}</p>
        </div>
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 p-2.5">
          <p className="text-green-700 dark:text-green-300 font-medium">Baixa</p>
          <p className="text-xl font-bold text-green-700 dark:text-green-300 mt-0.5">{priorityStats.baixa}</p>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-2.5">
          <p className="text-gray-600 dark:text-slate-300 font-medium">Sem</p>
          <p className="text-xl font-bold text-gray-700 dark:text-slate-100 mt-0.5">{priorityStats.sem}</p>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-2">Proximos prazos</h3>
        {upcomingDeadlines.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-slate-500">Nenhum prazo definido.</p>
        ) : (
          <div className="space-y-1.5">
            {upcomingDeadlines.map(item => (
              <button
                key={`upcoming-${item.topic.id}`}
                onClick={() => item.subjectId && onSelectSubject(item.subjectId)}
                className="w-full text-left text-xs rounded-lg border border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600 px-2.5 py-2 bg-gray-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 transition-colors flex items-center justify-between gap-2"
              >
                <span className="truncate text-gray-700 dark:text-slate-100">{item.subjectEmoji} {item.topic.name}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${item.deadlineInfo.className}`}>{item.deadlineInfo.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
