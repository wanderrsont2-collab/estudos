import { ArrowLeft, Edit3, Save, X } from 'lucide-react';
import type { Subject } from '../../types';
import { getRingColorStyle } from './shared';

interface SubjectHeaderProps {
  subject: Subject;
  onBack: () => void;
  isEditingDescription: boolean;
  descriptionDraft: string;
  onDescriptionDraftChange: (value: string) => void;
  onSaveDescription: () => void;
  onCancelDescriptionEdit: () => void;
  onStartDescriptionEdit: () => void;
  pendingHighPriority: number;
  overdueCount: number;
  reviewsDueCount: number;
}

export function SubjectHeader({
  subject,
  onBack,
  isEditingDescription,
  descriptionDraft,
  onDescriptionDraftChange,
  onSaveDescription,
  onCancelDescriptionEdit,
  onStartDescriptionEdit,
  pendingHighPriority,
  overdueCount,
  reviewsDueCount,
}: SubjectHeaderProps) {
  return (
    <div
      className="rounded-2xl p-6 text-white shadow-xl relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${subject.color}, ${subject.color}dd)` }}
    >
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzEuNjU3IDAgMy0xLjM0MyAzLTNzLTEuMzQzLTMtMy0zLTMgMS4zNDMtMyAzIDEuMzQzIDMgMyAzem0wIDMwYzEuNjU3IDAgMy0xLjM0MyAzLTNzLTEuMzQzLTMtMy0zLTMgMS4zNDMtMyAzIDEuMzQzIDMgMyAzem0tMTgtMTVjMS42NTcgMCAzLTEuMzQzIDMtM3MtMS4zNDMtMy0zLTMtMyAxLjM0My0zIDMgMS4zNDMgMyAzIDN6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
      <div className="relative">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/80 hover:text-white mb-3 transition-colors text-sm"
        >
          <ArrowLeft size={18} /> Voltar para Visao Geral
        </button>
        <h1 className="text-2xl md:text-3xl font-bold">
          {subject.emoji} {subject.name}
        </h1>
        <div className="mt-2 flex items-start gap-2">
          {isEditingDescription ? (
            <textarea
              value={descriptionDraft}
              onChange={event => onDescriptionDraftChange(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  onSaveDescription();
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  onCancelDescriptionEdit();
                }
              }}
              rows={2}
              placeholder="Adicione uma frase para descrever esta disciplina..."
              className="w-full max-w-2xl rounded-lg border border-white/30 bg-white/90 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2"
              style={getRingColorStyle(subject.color)}
            />
          ) : (
            <p className={`text-sm ${subject.description ? 'text-white/80' : 'text-white/60 italic'}`}>
              {subject.description?.trim()
                ? subject.description
                : 'Adicione uma frase para descrever esta disciplina.'}
            </p>
          )}
          <div className="shrink-0 flex items-center gap-1">
            {isEditingDescription ? (
              <>
                <button
                  onClick={onSaveDescription}
                  className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                  title="Salvar descricao"
                >
                  <Save size={16} />
                </button>
                <button
                  onClick={onCancelDescriptionEdit}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
                  title="Cancelar"
                >
                  <X size={16} />
                </button>
              </>
            ) : (
              <button
                onClick={onStartDescriptionEdit}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
                title={subject.description ? 'Editar descricao' : 'Adicionar descricao'}
              >
                <Edit3 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* ─── Alerts ───────────── */}
        <div className="flex flex-wrap gap-2 mt-3">
          {pendingHighPriority > 0 && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/20 text-white text-xs font-medium">
              {"\u{1F534}"} {pendingHighPriority} prioridade{pendingHighPriority > 1 ? 's' : ''} alta{pendingHighPriority > 1 ? 's' : ''}
            </span>
          )}
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500/20 text-white text-xs font-medium">
              {"\u26A0\uFE0F"} {overdueCount} prazo{overdueCount > 1 ? 's' : ''} vencido{overdueCount > 1 ? 's' : ''}
            </span>
          )}
          {reviewsDueCount > 0 && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-500/20 text-white text-xs font-medium">
              {"\u{1F9E0}"} {reviewsDueCount} revisoes pendentes
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
