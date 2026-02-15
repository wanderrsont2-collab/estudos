import { Calendar, Brain } from 'lucide-react';
import type { WeeklyReviewDay } from './types';
import { formatWeekDayDate } from './utils';

interface WeeklyReviewCalendarProps {
  weeklyReviewCalendar: WeeklyReviewDay[];
  onSelectSubject: (id: string) => void;
  onOpenReviews: () => void;
}

function getSubjectDotColor(subjectId: string): string {
  let hash = 0;
  for (let i = 0; i < subjectId.length; i += 1) {
    hash = (hash * 31 + subjectId.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 76% 52%)`;
}

export function WeeklyReviewCalendar({ weeklyReviewCalendar, onSelectSubject, onOpenReviews }: WeeklyReviewCalendarProps) {
  const totalReviews = weeklyReviewCalendar.reduce((sum, day) => sum + day.items.length, 0);

  return (
    <div className="animate-fade-in rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Revisoes da Semana</h3>
          </div>
          {totalReviews > 0 && (
            <button
              onClick={onOpenReviews}
              className="text-[11px] font-semibold text-cyan-600 hover:text-cyan-700 inline-flex items-center gap-1 transition-colors"
            >
              <Brain size={13} /> Ver todas
            </button>
          )}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {weeklyReviewCalendar.map((day, index) => (
            <div
              key={`review-day-${day.isoDate}`}
              className={`rounded-xl p-2.5 text-center border transition-all ${
                index === 0
                  ? 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200/60 dark:border-cyan-800/40'
                  : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800'
              }`}
            >
              <p className={`text-[10px] font-bold uppercase ${index === 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`}>
                {day.label.slice(0, 3)}
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">{formatWeekDayDate(day.isoDate)}</p>
              <p className={`text-lg font-black mt-0.5 ${day.items.length > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600'}`}>
                {day.items.length}
              </p>
              <div className="flex flex-wrap gap-0.5 justify-center mt-1.5 min-h-[8px]">
                {day.items.slice(0, 4).map(item => (
                  <button
                    key={`review-dot-${day.isoDate}-${item.topicId}`}
                    onClick={() => onSelectSubject(item.subjectId)}
                    className="w-2 h-2 rounded-full hover:scale-150 transition-transform"
                    style={{ backgroundColor: getSubjectDotColor(item.subjectId) }}
                    title={`${item.subjectEmoji} ${item.topicName}`}
                  />
                ))}
                {day.items.length > 4 && (
                  <span className="text-[8px] text-slate-400 font-bold">+{day.items.length - 4}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
