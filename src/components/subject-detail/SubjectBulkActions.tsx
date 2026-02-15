import { RATING_OPTIONS, type FSRSRating } from '../../fsrs';
import { getRingColorStyle } from './shared';

type BulkActionKind = 'studied' | 'priority' | 'tag' | 'review';
type BulkStudiedValue = 'studied' | 'pending';
type BulkPriorityValue = 'alta' | 'media' | 'baixa' | 'none';

interface SubjectBulkActionsProps {
  allTopicsCount: number;
  selectedTotalCount: number;
  allTopicIdsCount: number;
  selectedFilteredCount: number;
  filteredTopicIdsCount: number;
  allTopicsSelected: boolean;
  allFilteredSelected: boolean;
  selectionMode: boolean;
  selectedTopicIdsSize: number;
  onToggleSelectAllTopics: () => void;
  onToggleSelectAllFiltered: () => void;
  onClearSelectedTopics: () => void;
  bulkActionKind: BulkActionKind;
  onBulkActionKindChange: (value: BulkActionKind) => void;
  bulkStudiedValue: BulkStudiedValue;
  onBulkStudiedValueChange: (value: BulkStudiedValue) => void;
  bulkPriorityValue: BulkPriorityValue;
  onBulkPriorityValueChange: (value: BulkPriorityValue) => void;
  bulkTagDraft: string;
  onBulkTagDraftChange: (value: string) => void;
  bulkReviewRating: FSRSRating;
  onBulkReviewRatingChange: (value: FSRSRating) => void;
  tagSuggestionListId: string;
  subjectColor: string;
  canRunBulkAction: boolean;
  onRunBulkAction: () => void;
}

export function SubjectBulkActions({
  allTopicsCount,
  selectedTotalCount,
  allTopicIdsCount,
  selectedFilteredCount,
  filteredTopicIdsCount,
  allTopicsSelected,
  allFilteredSelected,
  selectionMode,
  selectedTopicIdsSize,
  onToggleSelectAllTopics,
  onToggleSelectAllFiltered,
  onClearSelectedTopics,
  bulkActionKind,
  onBulkActionKindChange,
  bulkStudiedValue,
  onBulkStudiedValueChange,
  bulkPriorityValue,
  onBulkPriorityValueChange,
  bulkTagDraft,
  onBulkTagDraftChange,
  bulkReviewRating,
  onBulkReviewRatingChange,
  tagSuggestionListId,
  subjectColor,
  canRunBulkAction,
  onRunBulkAction,
}: SubjectBulkActionsProps) {
  if (allTopicsCount === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 space-y-3">
      <div className="flex flex-wrap items-start sm:items-center gap-2 justify-between">
        <div className="text-sm font-semibold text-gray-700 dark:text-slate-200">
          Ações em massa
          <span className="ml-2 text-xs font-normal text-gray-500 dark:text-slate-400">
            {selectedTotalCount}/{allTopicIdsCount} selecionados
            {allTopicsCount > 0 && ` | ${selectedFilteredCount}/${filteredTopicIdsCount} visíveis`}
          </span>
        </div>
        <div className="flex w-full sm:w-auto flex-wrap items-center gap-2 sm:justify-end">
          <button
            onClick={onToggleSelectAllTopics}
            className="h-8 w-full sm:w-auto px-3 rounded-lg text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700"
          >
            {allTopicsSelected ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
          <button
            onClick={onToggleSelectAllFiltered}
            className="h-8 w-full sm:w-auto px-3 rounded-lg text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700"
          >
            {allFilteredSelected ? 'Desmarcar filtrados' : 'Selecionar filtrados'}
          </button>
          <button
            onClick={onClearSelectedTopics}
            disabled={selectedTopicIdsSize === 0 && !selectionMode}
            className="h-8 w-full sm:w-auto px-3 rounded-lg text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectionMode ? 'Sair modo seleção' : 'Limpar seleção'}
          </button>
        </div>
      </div>
      {selectionMode && (
        <p className="text-xs text-blue-600 dark:text-blue-300">
          Modo seleção ativo: clique com o botão esquerdo no item para marcar/desmarcar.
        </p>
      )}

      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Ação</span>
        <select
          value={bulkActionKind}
          onChange={event => onBulkActionKindChange(event.target.value as BulkActionKind)}
          className="h-8 w-full sm:w-auto rounded-md border border-gray-200 dark:border-slate-700 px-2 text-xs bg-white dark:bg-slate-950 text-gray-700 dark:text-slate-200"
        >
          <option value="studied">Marcar estudado/pendente</option>
          <option value="priority">Definir prioridade</option>
          <option value="tag">Adicionar tag</option>
          <option value="review">Iniciar revisão</option>
        </select>

        {bulkActionKind === 'studied' && (
          <select
            value={bulkStudiedValue}
            onChange={event => onBulkStudiedValueChange(event.target.value as BulkStudiedValue)}
            className="h-8 w-full sm:w-auto rounded-md border border-gray-200 dark:border-slate-700 px-2 text-xs bg-white dark:bg-slate-950 text-gray-700 dark:text-slate-200"
          >
            <option value="studied">Marcar como estudado</option>
            <option value="pending">Marcar como pendente</option>
          </select>
        )}

        {bulkActionKind === 'priority' && (
          <select
            value={bulkPriorityValue}
            onChange={event => onBulkPriorityValueChange(event.target.value as BulkPriorityValue)}
            className="h-8 w-full sm:w-auto rounded-md border border-gray-200 dark:border-slate-700 px-2 text-xs bg-white dark:bg-slate-950 text-gray-700 dark:text-slate-200"
          >
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
            <option value="none">Remover prioridade</option>
          </select>
        )}

        {bulkActionKind === 'tag' && (
          <input
            type="text"
            value={bulkTagDraft}
            list={tagSuggestionListId}
            onChange={event => onBulkTagDraftChange(event.target.value)}
            placeholder="Tag para selecionados"
            className="h-8 w-full sm:w-44 border border-gray-200 dark:border-slate-700 rounded-md px-2 text-xs focus:outline-none focus:ring-1 bg-white dark:bg-slate-950 text-gray-700 dark:text-slate-200"
            style={getRingColorStyle(subjectColor)}
          />
        )}

        {bulkActionKind === 'review' && (
          <select
            value={bulkReviewRating}
            onChange={event => onBulkReviewRatingChange(Number(event.target.value) as FSRSRating)}
            className="h-8 w-full sm:w-auto rounded-md border border-gray-200 dark:border-slate-700 px-2 text-xs bg-white dark:bg-slate-950 text-gray-700 dark:text-slate-200"
          >
            {RATING_OPTIONS.map(option => (
              <option key={`bulk-rating-${option.value}`} value={option.value}>
                {option.emoji} {option.label}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={onRunBulkAction}
          disabled={!canRunBulkAction}
          className="h-8 w-full sm:w-auto px-3 rounded-lg text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: subjectColor }}
        >
          Aplicar aos selecionados
        </button>
      </div>
    </div>
  );
}
