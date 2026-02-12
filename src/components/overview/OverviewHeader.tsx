import { Brain, Download } from 'lucide-react';
import type { CompletionEstimate } from './types';
import { CompletionEstimate as CompletionEstimateView } from './CompletionEstimate';
import { formatPercent } from './utils';

interface OverviewHeaderProps {
  todayLabel: string;
  overall: {
    progresso: number;
    rendimento: number;
    questionsCorrect: number;
    questionsTotal: number;
    reviewsDue: number;
  };
  streakCurrent: number;
  todayStudyMinutes: number;
  weeklyStudyMinutes: number;
  onExportReport: () => void;
  onOpenReviews: () => void;
  completionEstimate: CompletionEstimate;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3 border border-white/15">
      <p className="text-[11px] uppercase tracking-wide text-cyan-200">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

export function OverviewHeader({
  todayLabel,
  overall,
  streakCurrent,
  todayStudyMinutes,
  weeklyStudyMinutes,
  onExportReport,
  onOpenReviews,
  completionEstimate,
}: OverviewHeaderProps) {
  return (
    <section className="rounded-3xl bg-gradient-to-r from-cyan-900 via-slate-900 to-blue-900 text-white p-6 md:p-7 shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Visao Geral</h1>
          <p className="text-sm text-slate-300 mt-1 capitalize">{todayLabel}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onExportReport} className="rounded-xl bg-white/15 hover:bg-white/25 transition-colors px-4 py-2 text-sm font-medium inline-flex items-center gap-2">
            <Download size={16} /> Exportar
          </button>
          <button onClick={onOpenReviews} className="rounded-xl bg-white/15 hover:bg-white/25 transition-colors px-4 py-2 text-sm font-medium inline-flex items-center gap-2">
            <Brain size={16} /> Revisoes
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Progresso" value={formatPercent(overall.progresso)} />
        <StatCard label="Rendimento" value={formatPercent(overall.rendimento)} />
        <StatCard label="Questoes" value={`${overall.questionsCorrect}/${overall.questionsTotal}`} />
        <StatCard label="Pendencias" value={overall.reviewsDue} />
        <StatCard label="Streak" value={`${streakCurrent}d`} />
        <div className="rounded-2xl bg-white/10 p-3 border border-white/15">
          <p className="text-[11px] uppercase tracking-wide text-cyan-200">Sessao</p>
          <p className="text-xl font-bold mt-1">{todayStudyMinutes} min</p>
          <p className="text-[11px] text-cyan-100/70">{weeklyStudyMinutes} min semana</p>
        </div>
      </div>

      <CompletionEstimateView completionEstimate={completionEstimate} />
    </section>
  );
}
