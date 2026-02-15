import { Target, Clock, ArrowRight } from 'lucide-react';
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
  const cards = [
    {
      id: 'alta',
      label: 'Alta',
      value: priorityStats.alta,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/20',
      border: 'border-red-200/50 dark:border-red-800/30',
    },
    {
      id: 'media',
      label: 'Media',
      value: priorityStats.media,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      border: 'border-amber-200/50 dark:border-amber-800/30',
    },
    {
      id: 'baixa',
      label: 'Baixa',
      value: priorityStats.baixa,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
      border: 'border-emerald-200/50 dark:border-emerald-800/30',
    },
    {
      id: 'sem',
      label: 'Sem',
      value: priorityStats.sem,
      color: 'text-slate-600 dark:text-slate-300',
      bg: 'bg-slate-50 dark:bg-slate-800/40',
      border: 'border-slate-200/60 dark:border-slate-700/40',
    },
  ] as const;

  return (
    <div className="animate-fade-in rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target size={18} className="text-violet-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Prioridades</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
          {cards.map(card => (
            <div key={card.id} className={`rounded-xl ${card.bg} border ${card.border} p-3 text-center`}>
              <p className={`text-[10px] uppercase tracking-wider font-bold ${card.color} opacity-70`}>
                {card.label}
              </p>
              <p className={`text-xl font-black ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {upcomingDeadlines.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Clock size={13} className="text-slate-400" />
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Proximos prazos</p>
            </div>
            <div className="space-y-1.5">
              {upcomingDeadlines.map(item => (
                <button
                  key={`upcoming-${item.topic.id}`}
                  onClick={() => onSelectSubject(item.subjectId)}
                  className="w-full text-left rounded-lg border border-slate-100 dark:border-slate-800 p-2.5 flex items-center justify-between group hover:border-slate-200 dark:hover:border-slate-700 transition-all"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {item.subjectEmoji} {item.topic.name}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">{item.subjectName}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${item.deadlineInfo.className}`}>
                      {item.deadlineInfo.text}
                    </span>
                    <ArrowRight size={14} className="text-slate-300 group-hover:text-cyan-500 transition-colors" />
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
