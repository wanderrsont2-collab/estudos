import { Brain, Download, Sparkles } from 'lucide-react';
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

function StatCard({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div
      className={`group relative rounded-2xl border p-4 min-h-[98px] flex flex-col justify-between transition-all duration-300 hover:shadow-lg ${
        accent
          ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-400/30'
          : 'bg-white/[0.07] border-white/10 hover:border-white/20'
      }`}
    >
      <p className="text-[10px] uppercase tracking-[0.1em] font-semibold text-cyan-300/80">{label}</p>
      <p className="text-2xl font-black mt-1.5 tracking-tight">{value}</p>
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
    <section className="animate-fade-in rounded-3xl bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900 text-white p-6 md:p-8 shadow-2xl shadow-cyan-950/30 border border-white/[0.06] relative overflow-hidden">
      <div className="absolute top-0 right-0 h-80 w-80 bg-cyan-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 h-60 w-60 bg-blue-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

      <div className="relative z-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={18} className="text-cyan-400" />
              <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-cyan-400">
                Painel de Estudos
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">Visao Geral</h1>
            <p className="text-sm text-slate-400 mt-1 capitalize">{todayLabel}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onExportReport}
              className="rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all duration-200 px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2 border border-white/10 hover:border-white/20 hover:shadow-lg"
            >
              <Download size={15} /> Exportar
            </button>
            <button
              onClick={onOpenReviews}
              className="rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 backdrop-blur-sm transition-all duration-200 px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2 border border-cyan-400/20 hover:border-cyan-400/30 hover:shadow-lg hover:shadow-cyan-500/10"
            >
              <Brain size={15} /> Revisoes
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-stretch">
          <StatCard label="Progresso" value={formatPercent(overall.progresso)} accent />
          <StatCard label="Rendimento" value={formatPercent(overall.rendimento)} />
          <StatCard label="Questoes" value={`${overall.questionsCorrect}/${overall.questionsTotal}`} />
          <StatCard label="Pendencias" value={overall.reviewsDue} />
          <StatCard label="Streak" value={`${streakCurrent}d`} />
          <div className="group rounded-2xl bg-white/[0.07] p-4 border border-white/10 hover:border-white/20 min-h-[98px] flex flex-col justify-between transition-all duration-300 hover:shadow-lg">
            <p className="text-[10px] uppercase tracking-[0.1em] font-semibold text-cyan-300/80">Sessao</p>
            <p className="text-xl font-black mt-1.5 tracking-tight">{todayStudyMinutes} min</p>
            <p className="text-[11px] text-cyan-200/50 mt-0.5">{weeklyStudyMinutes} min/semana</p>
          </div>
        </div>

        <CompletionEstimateView completionEstimate={completionEstimate} />
      </div>
    </section>
  );
}
