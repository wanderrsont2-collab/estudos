import { Brain } from 'lucide-react';
import { getReviewStatus } from '../../fsrs';
import type { WeeklyReviewDay } from './types';
import { formatWeekDayDate } from './utils';

interface WeeklyReviewCalendarProps {
  weeklyReviewCalendar: WeeklyReviewDay[];
  onSelectSubject: (id: string) => void;
  onOpenReviews: () => void;
}

function ReviewDayCard({ day, onSelectSubject }: { day: WeeklyReviewDay; onSelectSubject: (id: string) => void }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-100">{day.label}</p>
        <span className="text-[10px] text-slate-500 dark:text-slate-400">{formatWeekDayDate(day.isoDate)}</span>
      </div>
      {day.items.length === 0 ? <p className="text-[11px] text-slate-400 dark:text-slate-500">Sem revisoes</p> : (
        <div className="space-y-1.5">
          {day.items.slice(0, 4).map(item => {
            const status = getReviewStatus(item.nextReview);
            return (
              <button key={`review-item-${day.isoDate}-${item.topicId}`} onClick={() => onSelectSubject(item.subjectId)} className="w-full text-left rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-700 dark:text-slate-100 truncate">{item.subjectEmoji} {item.topicName}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{item.groupName}</p>
                </div>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] whitespace-nowrap ${status.className}`}>{status.text}</span>
              </button>
            );
          })}
          {day.items.length > 4 ? <p className="text-[10px] text-slate-400 dark:text-slate-500">+{day.items.length - 4} revisao(oes)</p> : null}
        </div>
      )}
    </div>
  );
}

export function WeeklyReviewCalendar({
  weeklyReviewCalendar,
  onSelectSubject,
  onOpenReviews,
}: WeeklyReviewCalendarProps) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-100 inline-flex items-center gap-2">
          <Brain size={16} /> Revisoes da semana
        </h2>
        <button onClick={onOpenReviews} className="text-xs rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          Ver painel
        </button>
      </div>
      {weeklyReviewCalendar.every(day => day.items.length === 0) ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">Nenhuma revisao agendada para esta semana.</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {weeklyReviewCalendar.map(day => <ReviewDayCard key={`review-day-${day.isoDate}`} day={day} onSelectSubject={onSelectSubject} />)}
        </div>
      )}
    </div>
  );
}
