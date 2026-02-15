import { memo } from 'react';
import { Target, RotateCcw, AlertTriangle, BarChart3, Brain, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const QuickCard = memo(function QuickCard({
  title,
  value,
  subtitle,
  progress,
  icon: Icon,
  gradient,
  urgent = false,
  onClick,
  delay = 0,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  progress?: number;
  icon: LucideIcon;
  gradient: string;
  urgent?: boolean;
  onClick?: () => void;
  delay?: number;
}) {
  const cardClass = `animate-slide-up min-w-[160px] flex-shrink-0 rounded-2xl border p-4 transition-all duration-300 hover:shadow-xl bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-700/80 ${
    urgent ? 'ring-2 ring-red-400/50 ring-offset-2 dark:ring-offset-slate-950' : ''
  } ${onClick ? 'cursor-pointer' : ''}`;

  const body = (
    <>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${gradient}`}>
          <Icon size={15} className="text-white" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.08em] font-bold text-slate-500 dark:text-slate-400">{title}</p>
      </div>
      <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{value}</p>
      {subtitle ? <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p> : null}
      {progress !== undefined && (
        <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${gradient}`} style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${cardClass} text-left appearance-none`}
        style={{ animationDelay: `${delay}ms` }}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={cardClass} style={{ animationDelay: `${delay}ms` }}>
      {body}
    </div>
  );
});

interface QuickActionsProps {
  todayQuestionsMade: number;
  dailyQuestionsTarget: number;
  reviewsDueCount: number;
  overdueDeadlinesCount: number;
  weeklyQuestionsMade: number;
  weeklyQuestionsDelta: number;
  weeklyReviews: number;
  weeklyReviewTarget: number;
  weeklyEssays: number;
  weeklyEssayTarget: number;
  onOpenReviews: () => void;
}

export function QuickActions({
  todayQuestionsMade,
  dailyQuestionsTarget,
  reviewsDueCount,
  overdueDeadlinesCount,
  weeklyQuestionsMade,
  weeklyQuestionsDelta,
  weeklyReviews,
  weeklyReviewTarget,
  weeklyEssays,
  weeklyEssayTarget,
  onOpenReviews,
}: QuickActionsProps) {
  return (
    <section className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
      <QuickCard
        title="Meta diaria"
        value={`${todayQuestionsMade}/${dailyQuestionsTarget}`}
        progress={todayQuestionsMade / Math.max(1, dailyQuestionsTarget)}
        icon={Target}
        gradient="bg-gradient-to-br from-cyan-500 to-cyan-600"
        delay={50}
      />
      <QuickCard
        title="Revisoes pendentes"
        value={reviewsDueCount}
        onClick={onOpenReviews}
        icon={RotateCcw}
        gradient="bg-gradient-to-br from-indigo-500 to-indigo-600"
        delay={100}
      />
      <QuickCard
        title="Prazos vencidos"
        value={overdueDeadlinesCount}
        icon={AlertTriangle}
        gradient="bg-gradient-to-br from-red-500 to-rose-600"
        urgent={overdueDeadlinesCount > 0}
        delay={150}
      />
      <QuickCard
        title="Revisoes semana"
        value={`${weeklyReviews}/${weeklyReviewTarget}`}
        progress={weeklyReviews / Math.max(1, weeklyReviewTarget)}
        icon={Brain}
        gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
        delay={200}
      />
      <QuickCard
        title="Redacoes semana"
        value={`${weeklyEssays}/${weeklyEssayTarget}`}
        progress={weeklyEssays / Math.max(1, weeklyEssayTarget)}
        icon={FileText}
        gradient="bg-gradient-to-br from-fuchsia-500 to-pink-600"
        delay={225}
      />
      <QuickCard
        title="Semana"
        value={`${weeklyQuestionsMade} questoes`}
        subtitle={`${weeklyQuestionsDelta >= 0 ? '+' : ''}${weeklyQuestionsDelta} vs anterior`}
        icon={BarChart3}
        gradient="bg-gradient-to-br from-violet-500 to-violet-600"
        delay={250}
      />
    </section>
  );
}
