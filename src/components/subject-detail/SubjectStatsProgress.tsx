import { formatPercent, ProgressBar } from './shared';

interface SubjectStatsProgressProps {
  subjectColor: string;
  topicGroupsCount: number;
  stats: {
    studied: number;
    total: number;
    questionsTotal: number;
    rendimento: number;
    progresso: number;
    reviewsDue: number;
  };
}

export function SubjectStatsProgress({ subjectColor, topicGroupsCount, stats }: SubjectStatsProgressProps) {
  return (
    <>
      {/* ─── Stats Cards ───────────── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: '\u{1F4DA} Estudados', value: stats.studied },
          { label: '\u{1F4CB} Total', value: stats.total },
          { label: '\u{1F4C1} Topicos', value: topicGroupsCount },
          { label: '\u{1F4DD} Questoes', value: stats.questionsTotal },
          { label: '\u{1F4CA} Rendimento', value: formatPercent(stats.rendimento) },
          { label: '\u{1F9E0} Revisoes', value: stats.reviewsDue > 0 ? `${stats.reviewsDue} \u{1F514}` : '0' },
        ].map((card, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">{card.label}</p>
            <p className="text-2xl font-bold" style={{ color: subjectColor }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ─── Progress Overview ───────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-600 dark:text-slate-300">Progresso Geral</span>
          <span className="text-sm font-bold" style={{ color: subjectColor }}>{formatPercent(stats.progresso)}</span>
        </div>
        <ProgressBar value={stats.progresso} color={subjectColor} />
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 text-center italic">
          {stats.studied} de {stats.total} conteudos estudados
        </p>
      </div>
    </>
  );
}
