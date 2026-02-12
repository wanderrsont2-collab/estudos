import { CheckCircle2 } from 'lucide-react';
import type { CompletionEstimate as CompletionEstimateModel } from './types';

interface CompletionEstimateProps {
  completionEstimate: CompletionEstimateModel;
}

export function CompletionEstimate({ completionEstimate }: CompletionEstimateProps) {
  if (!completionEstimate) {
    return null;
  }

  if (completionEstimate.type === 'estimate') {
    return (
      <p className="mt-3 text-xs text-cyan-200/80">
        Ritmo: {completionEstimate.topicsPerDay}/dia — conclusão em
        ~{completionEstimate.daysRemaining}d
      </p>
    );
  }

  if (completionEstimate.type === 'complete') {
    return (
      <p className="mt-3 text-xs text-emerald-200 inline-flex items-center gap-1.5">
        <CheckCircle2 size={14} aria-hidden />
        Todos os tópicos estudados.
      </p>
    );
  }

  // Segurança: tipo desconhecido não renderiza nada
  return null;
}