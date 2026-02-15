import { AlertTriangle, Brain, ArrowRight } from 'lucide-react';
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
    <div className="animate-fade-in rounded-2xl border border-red-200/60 dark:border-red-900/40 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/10 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-red-500" />
          <h3 className="text-sm font-bold text-red-700 dark:text-red-400">Alertas</h3>
        </div>

        {overdueDeadlines.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-red-500 mb-2">Prazos vencidos</p>
            <div className="space-y-1.5">
              {overdueDeadlines.slice(0, 3).map(item => (
                <button
                  key={`overdue-${item.topic.id}`}
                  onClick={() => onSelectSubject(item.subjectId)}
                  className="w-full text-left rounded-lg bg-white/60 dark:bg-slate-900/40 p-2.5 flex items-center justify-between hover:bg-white dark:hover:bg-slate-900/60 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {item.subjectEmoji} {item.topic.name}
                    </p>
                    <p className="text-[10px] text-red-500 truncate">{item.subjectName} - {item.deadlineInfo.text}</p>
                  </div>
                  <ArrowRight size={14} className="text-slate-400 group-hover:text-red-500 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {reviewsDue.length > 0 && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[10px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400">
                Revisoes atrasadas
              </p>
              <button
                onClick={onOpenReviews}
                className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 inline-flex items-center gap-1 transition-colors"
              >
                <Brain size={13} /> Ver painel
              </button>
            </div>
            <div className="space-y-1.5">
              {reviewsDue.slice(0, 3).map(item => {
                const status = getReviewStatus(item.topic.fsrsNextReview);
                return (
                  <button
                    key={`review-due-${item.topic.id}`}
                    onClick={() => onSelectSubject(item.subjectId)}
                    className="w-full text-left rounded-lg bg-white/60 dark:bg-slate-900/40 p-2.5 flex items-center justify-between gap-2 hover:bg-white dark:hover:bg-slate-900/60 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {item.subjectEmoji} {item.topic.name}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{item.subjectName}</p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${status.className}`}>{status.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
