import { memo } from 'react';

const QuickCard = memo(function QuickCard({
  title,
  value,
  subtitle,
  progress,
  color = 'slate',
  urgent = false,
  onClick,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  progress?: number;
  color?: string;
  urgent?: boolean;
  onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    cyan: 'border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-200',
    indigo: 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-200',
    red: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200',
    emerald: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-200',
    violet: 'border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-200',
    slate: 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200',
  };

  const cardClass = `min-w-[140px] flex-shrink-0 rounded-xl border p-3 ${colorMap[color] ?? colorMap.slate} ${urgent ? 'ring-2 ring-red-400 ring-offset-2 dark:ring-offset-slate-900' : ''}`;
  const body = (
    <>
      <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
      {subtitle ? <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p> : null}
      {progress !== undefined ? (
        <div className="mt-2 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div className="h-1.5 rounded-full bg-current transition-all" style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={`${cardClass} cursor-pointer hover:shadow-md transition-shadow text-left`}>
        {body}
      </button>
    );
  }

  return <div className={cardClass}>{body}</div>;
});

interface QuickActionsProps {
  todayQuestionsMade: number;
  dailyQuestionsTarget: number;
  reviewsDueCount: number;
  overdueDeadlinesCount: number;
  todayStudyMinutes: number;
  weeklyQuestionsMade: number;
  weeklyQuestionsDelta: number;
  onOpenReviews: () => void;
}

export function QuickActions({
  todayQuestionsMade,
  dailyQuestionsTarget,
  reviewsDueCount,
  overdueDeadlinesCount,
  todayStudyMinutes,
  weeklyQuestionsMade,
  weeklyQuestionsDelta,
  onOpenReviews,
}: QuickActionsProps) {
  return (
    <section className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
      <QuickCard
        title="Meta diaria"
        value={`${todayQuestionsMade}/${dailyQuestionsTarget}`}
        progress={todayQuestionsMade / Math.max(1, dailyQuestionsTarget)}
        color="cyan"
      />
      <QuickCard title="Revisoes pendentes" value={reviewsDueCount} onClick={onOpenReviews} color="indigo" urgent={reviewsDueCount > 5} />
      <QuickCard title="Prazos vencidos" value={overdueDeadlinesCount} color="red" urgent={overdueDeadlinesCount > 0} />
      <QuickCard title="Tempo hoje" value={`${todayStudyMinutes} min`} color="emerald" />
      <QuickCard title="Semana" value={`${weeklyQuestionsMade} questoes`} subtitle={`${weeklyQuestionsDelta >= 0 ? '+' : ''}${weeklyQuestionsDelta} vs anterior`} color="violet" />
    </section>
  );
}
