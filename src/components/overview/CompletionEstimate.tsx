import { CalendarDays, CheckCircle2 } from 'lucide-react';
import type { CompletionEstimate as CompletionEstimateModel } from './types';

interface CompletionEstimateProps {
  completionEstimate: CompletionEstimateModel;
}

export function CompletionEstimate({ completionEstimate }: CompletionEstimateProps) {
  if (!completionEstimate) {
    return null;
  }

  if (completionEstimate.type === 'complete') {
    return (
      <div className="mt-5 rounded-2xl bg-emerald-500/10 backdrop-blur-sm border border-emerald-300/20 p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <CheckCircle2 size={15} className="text-emerald-300" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
            Conclusao
          </span>
        </div>
        <p className="text-sm text-emerald-100">Todos os topicos foram estudados.</p>
      </div>
    );
  }

  const estimatedDateLabel = completionEstimate.estimatedDate.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="mt-5 rounded-2xl bg-white/[0.07] backdrop-blur-sm border border-white/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays size={15} className="text-cyan-300" />
        <span className="text-xs font-semibold uppercase tracking-wider text-cyan-200">
          Estimativa de conclusao
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="text-3xl font-black">{estimatedDateLabel}</p>
          <p className="text-[11px] text-cyan-200/70 mt-0.5">
            {completionEstimate.daysRemaining} dias restantes
          </p>
        </div>
        <div className="text-[11px] text-cyan-100/80 space-y-1.5">
          <p>
            Ritmo atual: <span className="font-semibold">{completionEstimate.topicsPerDay}</span> topicos/dia
          </p>
          <p>
            Pendentes: <span className="font-semibold">{completionEstimate.remaining}</span> topicos
          </p>
        </div>
      </div>
    </div>
  );
}
