import { AlertTriangle, Brain } from 'lucide-react';
import { getReviewStatus } from '../../fsrs';
import type { DeadlineDisplayItem, ReviewDueDisplayItem } from './types';

interface AlertsSectionProps {
  overdueDeadlines: DeadlineDisplayItem[];
  reviewsDue: ReviewDueDisplayItem[];
  onSelectSubject: (id: string) => void;
  onOpenReviews: () => void;
}

export function AlertsSection({ overdueDeadlines, reviewsDue, onSelectSubject, onOpenReviews }: AlertsSectionProps) {
  if (overdueDeadlines.length === 0 && reviewsDue.length === 0) return null;

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-semibold text-sm">
          <AlertTriangle size={16} /> Prazos vencidos ({overdueDeadlines.length})
        </div>
        {overdueDeadlines.length === 0 ? (
          <p className="text-xs text-red-500 dark:text-red-300/80 mt-2">Nenhum prazo vencido.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {overdueDeadlines.slice(0, 5).map(item => (
              <button
                key={`overdue-${item.topic.id}`}
                onClick={() => item.subjectId && onSelectSubject(item.subjectId)}
                className="block w-full text-left text-xs text-red-700 dark:text-red-200 bg-white/70 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800 px-2 py-1.5 rounded-lg transition-colors"
              >
                {item.subjectEmoji} {item.topic.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-semibold text-sm">
            <Brain size={16} /> Revisoes pendentes ({reviewsDue.length})
          </div>
          <button onClick={onOpenReviews} className="text-xs rounded-md bg-indigo-600 text-white px-2.5 py-1.5 hover:bg-indigo-700 transition-colors">
            Abrir
          </button>
        </div>
        {reviewsDue.length === 0 ? (
          <p className="text-xs text-indigo-500 dark:text-indigo-300/80 mt-2">Nenhuma revisao pendente.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {reviewsDue.slice(0, 5).map(item => {
              const status = getReviewStatus(item.topic.fsrsNextReview);
              return (
                <div key={`review-due-${item.topic.id}`} className="text-xs text-indigo-800 dark:text-indigo-200 bg-white/70 dark:bg-slate-900/50 px-2 py-1.5 rounded-lg flex items-center justify-between gap-2">
                  <span>{item.subjectEmoji} {item.topic.name}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${status.className}`}>{status.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
