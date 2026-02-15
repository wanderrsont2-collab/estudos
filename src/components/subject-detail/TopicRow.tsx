import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Brain, Calendar, Check, ChevronDown, ChevronRight, Edit3, Save, Trash2, X } from 'lucide-react';
import type { Priority, Topic } from '../../types';
import { getReviewStatus } from '../../fsrs';
import { calculateTopicMastery, getMasteryBadgeClass } from '../../mastery';
import { PRIORITY_CONFIG } from '../../store';
import {
  COMMON_TAG_PRESETS,
  DeadlineBadge,
  formatPercent,
  getRingColorStyle,
  isInteractiveTarget,
  isReviewDue,
  parseNonNegativeInt,
  PriorityBadge,
  PRIORITY_OPTIONS,
  StudiedToggleButton,
} from './shared';

export interface TopicRowProps {
  topic: Topic;
  groupId: string;
  subjectColor: string;
  editingTopicId: string | null;
  editTopicName: string;
  deleteConfirm: string | null;
  priorityMenuTopic: string | null;
  isExpanded: boolean;
  isHighlighted: boolean;
  isSelected: boolean;
  selectionMode: boolean;
  onToggleExpanded: (topicId: string) => void;
  onToggleSelected: (topicId: string) => void;
  onOpenStudyPopup: (groupId: string, topicId: string) => void;
  onUpdateTopic: (groupId: string, topicId: string, changes: Partial<Topic>) => void;
  onUpdateQuestionProgress: (groupId: string, topicId: string, nextTotal: number, nextCorrect: number) => void;
  onRemoveTopic: (groupId: string, topicId: string) => void;
  onStartEdit: (topic: Topic) => void;
  onSaveEdit: (groupId: string, topicId: string) => void;
  onCancelEdit: () => void;
  onSetEditName: (name: string) => void;
  onSetDeleteConfirm: (id: string | null) => void;
  onSetPriority: (groupId: string, topicId: string, priority: Priority | null) => void;
  onTogglePriorityMenu: (id: string | null) => void;
  tagDraft: string;
  tagSuggestionListId: string;
  onTagDraftChange: (topicId: string, value: string) => void;
  onAddTag: (groupId: string, topicId: string, tag: string) => void;
  onRemoveTag: (groupId: string, topicId: string, tag: string) => void;
}

export const TopicRow = memo(function TopicRow({
  topic,
  groupId,
  subjectColor,
  editingTopicId,
  editTopicName,
  deleteConfirm,
  priorityMenuTopic,
  isExpanded,
  isHighlighted,
  isSelected,
  selectionMode,
  onToggleExpanded,
  onToggleSelected,
  onOpenStudyPopup,
  onUpdateTopic,
  onRemoveTopic,
  onUpdateQuestionProgress,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onSetEditName,
  onSetDeleteConfirm,
  onSetPriority,
  onTogglePriorityMenu,
  tagDraft,
  tagSuggestionListId,
  onTagDraftChange,
  onAddTag,
  onRemoveTag,
}: TopicRowProps) {
  const isEditing = editingTopicId === topic.id;
  const detailsVisible = isExpanded || isEditing;
  const showPriorityMenu = priorityMenuTopic === topic.id;
  const priorityAnchorRef = useRef<HTMLDivElement | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const notesDebounceRef = useRef<number | null>(null);
  const [priorityMenuPosition, setPriorityMenuPosition] = useState<'up' | 'down'>('down');
  const [notesDraft, setNotesDraft] = useState(topic.notes ?? '');
  const notesDraftRef = useRef(notesDraft);
  const topicNotesRef = useRef(topic.notes ?? '');
  const mastery = calculateTopicMastery(topic);
  const masteryClass = getMasteryBadgeClass(mastery.score);
  const reviewStatus = getReviewStatus(topic.fsrsNextReview);
  const isDue = topic.studied && isReviewDue(topic.fsrsNextReview);
  const accuracy = topic.questionsTotal > 0 ? topic.questionsCorrect / topic.questionsTotal : 0;
  const nextReviewDate = topic.studied && topic.fsrsNextReview
    ? new Date(topic.fsrsNextReview + 'T00:00:00').toLocaleDateString('pt-BR')
    : null;

  useEffect(() => {
    const sourceNotes = topic.notes ?? '';
    topicNotesRef.current = sourceNotes;
    setNotesDraft(sourceNotes);
    notesDraftRef.current = sourceNotes;
  }, [topic.id, topic.notes]);

  useEffect(() => {
    notesDraftRef.current = notesDraft;
  }, [notesDraft]);

  useEffect(() => {
    if (!showPriorityMenu) return;

    const updatePriorityMenuPosition = () => {
      const anchorRect = priorityAnchorRef.current?.getBoundingClientRect();
      if (!anchorRect) return;

      const estimatedMenuHeight = 170;
      const spaceBelow = window.innerHeight - anchorRect.bottom;
      const spaceAbove = anchorRect.top;
      const openUpward = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
      setPriorityMenuPosition(openUpward ? 'up' : 'down');
    };

    updatePriorityMenuPosition();
    window.addEventListener('resize', updatePriorityMenuPosition);
    window.addEventListener('scroll', updatePriorityMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updatePriorityMenuPosition);
      window.removeEventListener('scroll', updatePriorityMenuPosition, true);
    };
  }, [showPriorityMenu]);

  const flushNotesUpdate = useCallback((nextNotes?: string) => {
    if (notesDebounceRef.current !== null) {
      window.clearTimeout(notesDebounceRef.current);
      notesDebounceRef.current = null;
    }
    const valueToCommit = nextNotes ?? notesDraftRef.current;
    if (valueToCommit === topicNotesRef.current) return;
    onUpdateTopic(groupId, topic.id, { notes: valueToCommit });
  }, [groupId, onUpdateTopic, topic.id]);

  const queueNotesUpdate = useCallback((nextNotes: string) => {
    setNotesDraft(nextNotes);
    notesDraftRef.current = nextNotes;
    if (notesDebounceRef.current !== null) {
      window.clearTimeout(notesDebounceRef.current);
    }
    notesDebounceRef.current = window.setTimeout(() => {
      notesDebounceRef.current = null;
      if (notesDraftRef.current === topicNotesRef.current) return;
      onUpdateTopic(groupId, topic.id, { notes: notesDraftRef.current });
    }, 350);
  }, [groupId, onUpdateTopic, topic.id]);

  useEffect(() => {
    return () => {
      flushNotesUpdate();
    };
  }, [flushNotesUpdate]);

  const insertListPrefix = useCallback((prefix: string) => {
    const currentNotes = notesDraftRef.current;
    const textarea = notesRef.current;

    if (!textarea) {
      const needsBreak = currentNotes.length > 0 && !currentNotes.endsWith('\n');
      queueNotesUpdate(`${currentNotes}${needsBreak ? '\n' : ''}${prefix}`);
      return;
    }

    const start = textarea.selectionStart ?? currentNotes.length;
    const end = textarea.selectionEnd ?? start;
    const before = currentNotes.slice(0, start);
    const after = currentNotes.slice(end);
    const needsBreak = before.length > 0 && !before.endsWith('\n');
    const insertion = `${needsBreak ? '\n' : ''}${prefix}`;
    const nextNotes = `${before}${insertion}${after}`;
    const nextCaretPos = before.length + insertion.length;

    queueNotesUpdate(nextNotes);
    requestAnimationFrame(() => {
      const target = notesRef.current;
      if (!target) return;
      target.focus();
      target.setSelectionRange(nextCaretPos, nextCaretPos);
    });
  }, [queueNotesUpdate]);

  const highlightClass = isHighlighted
    ? 'bg-amber-50/70 dark:bg-amber-900/20 ring-1 ring-amber-200/70 dark:ring-amber-400/30'
    : '';
  const selectionClass = isSelected
    ? 'bg-blue-50/70 dark:bg-blue-900/20 ring-1 ring-blue-200/70 dark:ring-blue-400/40'
    : '';

  return (
    <div
      id={`topic-${topic.id}`}
      className={`px-4 py-3 transition-all hover:bg-gray-50/50 dark:hover:bg-slate-800/40 ${
        isDue ? 'border-l-2 border-l-purple-400' : ''
      } ${selectionClass} ${highlightClass}`}
      onMouseDown={event => {
        if (event.button !== 0) return;
        if (isInteractiveTarget(event.target)) return;
        if (selectionMode) {
          onToggleSelected(topic.id);
          return;
        }
        if (!isSelected) return;
        onToggleSelected(topic.id);
      }}
    >
      {/* ─── Topic Header ───────────── */}
      <div className="flex items-start gap-3">
        <StudiedToggleButton
          studied={topic.studied}
          onToggle={() => {
            const nextStudied = !topic.studied;
            onUpdateTopic(groupId, topic.id, {
              studied: nextStudied,
              dateStudied: nextStudied ? topic.dateStudied ?? new Date().toISOString() : null,
            });
          }}
          size="md"
          className="mt-0.5"
        />

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex gap-2 items-center mb-2">
              <input
                type="text"
                value={editTopicName}
                onChange={e => onSetEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(groupId, topic.id); if (e.key === 'Escape') onCancelEdit(); }}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
                style={getRingColorStyle(subjectColor)}
                autoFocus
              />
              <button onClick={() => onSaveEdit(groupId, topic.id)} className="text-green-600 hover:text-green-700"><Save size={16} /></button>
              <button onClick={onCancelEdit} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-start sm:items-center gap-2">
                <button
                  onClick={() => onToggleExpanded(topic.id)}
                  className="shrink-0 p-1 rounded-md text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  title={detailsVisible ? 'Ocultar detalhes' : 'Mostrar detalhes'}
                >
                  {detailsVisible ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <button
                  onClick={() => onToggleSelected(topic.id)}
                  className="p-0 border-0 bg-transparent inline-flex min-w-0 flex-1 items-center gap-2 text-left"
                  title={isSelected ? 'Remover da seleção em massa' : 'Selecionar para ação em massa'}
                >
                  <span className={`min-w-0 break-words font-medium text-sm ${topic.studied ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-800 dark:text-slate-100'}`}>
                    {topic.name}
                  </span>
                  <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${masteryClass}`}>
                    {mastery.score}% {mastery.label}
                  </span>
                </button>
                <button
                  onClick={() => onOpenStudyPopup(groupId, topic.id)}
                  className="shrink-0 p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  title="Abrir popup de revisao"
                >
                  <BookOpen size={14} />
                </button>

                <div className="relative shrink-0" ref={priorityAnchorRef}>
                  <PriorityBadge
                    priority={topic.priority}
                    onClick={() => onTogglePriorityMenu(showPriorityMenu ? null : topic.id)}
                    size="xs"
                  />
                  {showPriorityMenu && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => onTogglePriorityMenu(null)} />
                      <div
                        className={`absolute left-0 z-30 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-1 min-w-[130px] ${
                          priorityMenuPosition === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
                        }`}
                      >
                        {PRIORITY_OPTIONS.map(p => {
                          const config = PRIORITY_CONFIG[p];
                          return (
                            <button
                              key={p}
                              onClick={() => onSetPriority(groupId, topic.id, p)}
                              className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2 ${
                                topic.priority === p ? 'font-bold' : ''
                              }`}
                            >
                              <span>{config.emoji}</span>
                              <span>{config.label}</span>
                              {topic.priority === p && <Check size={12} className="ml-auto text-green-600" />}
                            </button>
                          );
                        })}
                        <div className="border-t border-gray-100 dark:border-slate-700 mt-1 pt-1">
                          <button
                            onClick={() => onSetPriority(groupId, topic.id, null)}
                            className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400"
                          >
                            Remover prioridade
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {(topic.tags ?? []).length > 0 && (
                <div className="ml-7 flex flex-wrap items-center gap-1.5">
                  {(topic.tags ?? []).slice(0, 3).map(tag => (
                    <span
                      key={`${topic.id}-${tag}-pill`}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      #{tag}
                    </span>
                  ))}
                  {(topic.tags ?? []).length > 3 && (
                    <span className="text-[10px] text-slate-400">+{(topic.tags ?? []).length - 3}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {detailsVisible && (
            <>
              {/* ─── Topic Details ───────────── */}
              <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-3 space-y-3">
                {nextReviewDate && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-950/60 px-3 py-2 flex items-center justify-between gap-3">
                    <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
                      <Calendar size={11} />
                      Prox. revisao
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${reviewStatus.className}`}>
                      {nextReviewDate}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Questões</span>
                    <input
                      type="number"
                      min="0"
                      value={topic.questionsTotal || ''}
                      onChange={e => {
                        const nextTotal = parseNonNegativeInt(e.target.value);
                        onUpdateQuestionProgress(groupId, topic.id, nextTotal, Math.min(topic.questionsCorrect, nextTotal));
                      }}
                      className="mt-1 w-full border border-gray-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 bg-white dark:bg-slate-950"
                      style={getRingColorStyle(subjectColor)}
                      placeholder="0"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Acertos</span>
                    <input
                      type="number"
                      min="0"
                      max={topic.questionsTotal}
                      value={topic.questionsCorrect || ''}
                      onChange={e => onUpdateQuestionProgress(
                        groupId,
                        topic.id,
                        topic.questionsTotal,
                        Math.min(parseNonNegativeInt(e.target.value), topic.questionsTotal),
                      )}
                      className="mt-1 w-full border border-gray-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 bg-white dark:bg-slate-950"
                      style={getRingColorStyle(subjectColor)}
                      placeholder="0"
                    />
                  </label>

                  <div>
                    <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Rendimento</span>
                    {topic.questionsTotal > 0 ? (
                      <p
                        className={`mt-1 text-lg font-extrabold leading-none ${
                          accuracy >= 0.7
                            ? 'text-green-600 dark:text-green-400'
                            : accuracy >= 0.5
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {formatPercent(accuracy)}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">Sem dados</p>
                    )}
                  </div>

                  <div>
                    <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Mastery</span>
                    <p className="mt-1 text-lg font-extrabold leading-none text-slate-700 dark:text-slate-200">
                      {mastery.score}%
                    </p>
                    <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${masteryClass}`}>
                      {mastery.label}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                      <Calendar size={11} /> Prazo
                    </span>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="date"
                        value={topic.deadline || ''}
                        onChange={e => onUpdateTopic(groupId, topic.id, { deadline: e.target.value || null })}
                        className="w-full border border-gray-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 bg-white dark:bg-slate-950"
                        style={getRingColorStyle(subjectColor)}
                      />
                      <DeadlineBadge deadline={topic.deadline} size="xs" />
                    </div>
                  </div>
                </div>

                {/* ─── Tags ───────────── */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Tags</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(topic.tags ?? []).map(tag => (
                      <button
                        key={`${topic.id}-tag-${tag}`}
                        onClick={() => onRemoveTag(groupId, topic.id, tag)}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 text-[10px] hover:bg-slate-200 dark:hover:bg-slate-700"
                        title="Remover tag"
                      >
                        #{tag} <X size={10} />
                      </button>
                    ))}
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={tagDraft}
                        list={tagSuggestionListId}
                        onChange={event => onTagDraftChange(topic.id, event.target.value)}
                        onKeyDown={event => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            onAddTag(groupId, topic.id, tagDraft);
                          }
                        }}
                        placeholder="Nova tag"
                        className="w-24 border border-gray-200 dark:border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 bg-white dark:bg-slate-950"
                        style={getRingColorStyle(subjectColor)}
                      />
                      <button
                        onClick={() => onAddTag(groupId, topic.id, tagDraft)}
                        className="px-2 py-1 rounded-md text-[11px] text-white hover:opacity-90"
                        style={{ backgroundColor: subjectColor }}
                      >
                        Tag
                      </button>
                    </div>
                    {COMMON_TAG_PRESETS.map(tag => {
                      const alreadyAdded = (topic.tags ?? []).some(existing => (
                        existing.toLocaleLowerCase('pt-BR') === tag.toLocaleLowerCase('pt-BR')
                      ));
                      return (
                        <button
                          key={`${topic.id}-preset-${tag}`}
                          onClick={() => onAddTag(groupId, topic.id, tag)}
                          disabled={alreadyAdded}
                          className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          #{tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ─── Notes ───────────── */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Anotações</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => insertListPrefix('• ')}
                        className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Inserir item com marcador"
                      >
                        • Lista
                      </button>
                      <button
                        type="button"
                        onClick={() => insertListPrefix('1. ')}
                        className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Inserir item numerado"
                      >
                        1. Numero
                      </button>
                    </div>
                  </div>
                  <textarea
                    ref={notesRef}
                    value={notesDraft}
                    onChange={event => queueNotesUpdate(event.target.value)}
                    onBlur={event => flushNotesUpdate(event.target.value)}
                    placeholder="Escreva observacoes, passos, checklists e resumos..."
                    className="mt-1 w-full min-h-[96px] border border-gray-200 dark:border-slate-700 rounded-md px-2 py-2 text-xs text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 bg-white dark:bg-slate-950 placeholder-slate-400 resize-y"
                    style={getRingColorStyle(subjectColor)}
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-slate-400">
                  <Brain size={12} className="text-purple-500" />
                  <span>{topic.reviewHistory.length > 0 ? `Rev. ${topic.reviewHistory.length} - ${reviewStatus.text}` : 'Sem revisoes FSRS ainda'}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onStartEdit(topic)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30"
                    title="Editar nome"
                  >
                    <Edit3 size={14} />
                  </button>
                  {deleteConfirm === `topic-${topic.id}` ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => onRemoveTopic(groupId, topic.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Check size={14} /></button>
                      <button onClick={() => onSetDeleteConfirm(null)} className="p-1.5 text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg"><X size={14} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onSetDeleteConfirm(`topic-${topic.id}`)}
                      className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30"
                      title="Excluir assunto"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}, (prev, next) => (
  prev.topic === next.topic
  && prev.groupId === next.groupId
  && prev.subjectColor === next.subjectColor
  && prev.editingTopicId === next.editingTopicId
  && prev.editTopicName === next.editTopicName
  && prev.deleteConfirm === next.deleteConfirm
  && prev.priorityMenuTopic === next.priorityMenuTopic
  && prev.isExpanded === next.isExpanded
  && prev.isHighlighted === next.isHighlighted
  && prev.isSelected === next.isSelected
  && prev.selectionMode === next.selectionMode
  && prev.tagDraft === next.tagDraft
  && prev.tagSuggestionListId === next.tagSuggestionListId
));

TopicRow.displayName = 'TopicRow';
