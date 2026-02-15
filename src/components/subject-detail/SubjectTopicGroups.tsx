import { useMemo, useState } from 'react';
import { BookOpen, Brain, Check, ChevronDown, ChevronRight, Edit3, FileText, FolderOpen, FolderPlus, Plus, Save, Trash2, X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Priority, Subject, Topic } from '../../types';
import { getReviewStatus } from '../../fsrs';
import { calculateTopicMastery, getMasteryBadgeClass } from '../../mastery';
import { getGroupStats } from '../../store';
import { DeadlineBadge, formatPercent, getRingColorStyle, isInteractiveTarget, isReviewDue, PriorityBadge, StudiedToggleButton } from './shared';
import { GroupPopup } from './GroupPopup';
import { TopicRow } from './TopicRow';

type ViewMode = 'cards' | 'grid' | 'table' | 'groups';

interface SubjectTopicGroupsProps {
  subject: Subject;
  viewMode: ViewMode;
  hasActiveFilter: boolean;
  filterTopics: (topics: Topic[]) => Topic[];
  collapsedGroups: Set<string>;
  editingGroupId: string | null;
  editGroupName: string;
  deleteConfirm: string | null;
  showBulkAdd: string | null;
  editingTopicId: string | null;
  editTopicName: string;
  priorityMenuTopic: string | null;
  expandedTopics: Set<string>;
  highlightTopicId: string | null;
  selectedTopicIds: Set<string>;
  selectionMode: boolean;
  newTopicInputs: Record<string, string>;
  bulkInputs: Record<string, string>;
  tagInputs: Record<string, string>;
  tagSuggestionListId: string;
  onToggleGroupCollapse: (groupId: string) => void;
  onSetEditingGroupId: (groupId: string | null) => void;
  onSetEditGroupName: (value: string) => void;
  onSaveGroupEdit: (groupId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onSetDeleteConfirm: (id: string | null) => void;
  onSetNewTopicInputs: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onAddTopicToGroup: (groupId: string) => void;
  onSetShowBulkAdd: (id: string | null) => void;
  onSetBulkInputs: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onAddBulkTopicsToGroup: (groupId: string) => void;
  onToggleTopicSelection: (topicId: string) => void;
  onSetTopicStudied: (groupId: string, topicId: string, studied: boolean) => void;
  onOpenStudyPopup: (groupId: string, topicId: string) => void;
  onStartTopicEdit: (topic: Topic) => void;
  onSaveTopicEdit: (groupId: string, topicId: string) => void;
  onCancelTopicEdit: () => void;
  onSetEditTopicName: (name: string) => void;
  onRemoveTopic: (groupId: string, topicId: string) => void;
  onSetPriority: (groupId: string, topicId: string, priority: Priority | null) => void;
  onSetPriorityMenuTopic: (id: string | null) => void;
  onToggleTopicExpanded: (topicId: string) => void;
  onUpdateTopic: (groupId: string, topicId: string, changes: Partial<Topic>) => void;
  onUpdateQuestionProgress: (groupId: string, topicId: string, nextTotal: number, nextCorrect: number) => void;
  onTagDraftChange: (topicId: string, value: string) => void;
  onAddTag: (groupId: string, topicId: string, tag: string) => void;
  onRemoveTag: (groupId: string, topicId: string, tag: string) => void;
}

export function SubjectTopicGroups({
  subject,
  viewMode,
  hasActiveFilter,
  filterTopics,
  collapsedGroups,
  editingGroupId,
  editGroupName,
  deleteConfirm,
  showBulkAdd,
  editingTopicId,
  editTopicName,
  priorityMenuTopic,
  expandedTopics,
  highlightTopicId,
  selectedTopicIds,
  selectionMode,
  newTopicInputs,
  bulkInputs,
  tagInputs,
  tagSuggestionListId,
  onToggleGroupCollapse,
  onSetEditingGroupId,
  onSetEditGroupName,
  onSaveGroupEdit,
  onRemoveGroup,
  onSetDeleteConfirm,
  onSetNewTopicInputs,
  onAddTopicToGroup,
  onSetShowBulkAdd,
  onSetBulkInputs,
  onAddBulkTopicsToGroup,
  onToggleTopicSelection,
  onSetTopicStudied,
  onOpenStudyPopup,
  onStartTopicEdit,
  onSaveTopicEdit,
  onCancelTopicEdit,
  onSetEditTopicName,
  onRemoveTopic,
  onSetPriority,
  onSetPriorityMenuTopic,
  onToggleTopicExpanded,
  onUpdateTopic,
  onUpdateQuestionProgress,
  onTagDraftChange,
  onAddTag,
  onRemoveTag,
}: SubjectTopicGroupsProps) {
  const [popupGroupId, setPopupGroupId] = useState<string | null>(null);
  const popupGroup = useMemo(
    () => subject.topicGroups.find(group => group.id === popupGroupId) ?? null,
    [popupGroupId, subject.topicGroups],
  );
  const popupVisibleTopics = useMemo(
    () => (popupGroup ? filterTopics(popupGroup.topics) : []),
    [filterTopics, popupGroup],
  );

  if (subject.topicGroups.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-white/75 p-8 text-center backdrop-blur-xl shadow-xl shadow-slate-200/35 dark:border-slate-700/70 dark:bg-slate-900/70 dark:shadow-slate-900/35">
        <FolderPlus size={48} className="mx-auto text-gray-300 dark:text-slate-600 mb-3" />
        <p className="text-gray-500 dark:text-slate-300 font-medium mb-1">Nenhum topico criado ainda</p>
        <p className="text-gray-400 dark:text-slate-500 text-sm">
          Crie topicos acima para organizar seus assuntos de estudo.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={viewMode === 'groups' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-5'}>
      {subject.topicGroups.map((group) => {
        const filtered = filterTopics(group.topics);
        const groupStats = getGroupStats(group);
        const isCollapsed = collapsedGroups.has(group.id);
        const hasFilteredContent = filtered.length > 0 || !hasActiveFilter;

        if (!hasFilteredContent && group.topics.length > 0 && (viewMode === 'grid' || viewMode === 'groups')) return null;

        if (viewMode === 'groups') {
          const pendingCount = filtered.filter(topic => !topic.studied).length;
          const dueReviewsCount = filtered.filter(topic => topic.studied && isReviewDue(topic.fsrsNextReview)).length;
          const previewTopics = filtered.slice(0, 4);

          return (
            <motion.article
              key={group.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              className="group flex min-h-[250px] cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white/85 backdrop-blur-xl shadow-xl shadow-slate-200/40 transition-all hover:border-indigo-300/80 dark:border-slate-700/60 dark:bg-slate-900/80 dark:shadow-slate-900/40 dark:hover:border-indigo-700/80"
              onClick={() => {
                if (editingGroupId === group.id) return;
                setPopupGroupId(group.id);
              }}
            >
              <div className="border-b border-slate-100 px-4 pb-3 pt-4 dark:border-slate-800">
                <div className="flex items-start justify-between gap-2">
                  {editingGroupId === group.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="text"
                        value={editGroupName}
                        onChange={event => onSetEditGroupName(event.target.value)}
                        onKeyDown={event => {
                          if (event.key === 'Enter') onSaveGroupEdit(group.id);
                          if (event.key === 'Escape') onSetEditingGroupId(null);
                        }}
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        style={getRingColorStyle(subject.color)}
                        autoFocus
                      />
                      <button onClick={() => onSaveGroupEdit(group.id)} className="text-green-600 hover:text-green-700"><Save size={16} /></button>
                      <button onClick={() => onSetEditingGroupId(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X size={16} /></button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{"\u{1F4C1}"}</span>
                          <h3 className="truncate font-semibold text-slate-800 dark:text-slate-100">{group.name}</h3>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>{groupStats.studied}/{groupStats.total} estudados</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {formatPercent(groupStats.progresso)}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={event => {
                            event.stopPropagation();
                            onSetEditingGroupId(group.id);
                            onSetEditGroupName(group.name);
                          }}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30"
                          title="Renomear topico"
                        >
                          <Edit3 size={14} />
                        </button>
                        {deleteConfirm === `group-${group.id}` ? (
                          <div className="flex items-center gap-1">
                            <button onClick={event => { event.stopPropagation(); onRemoveGroup(group.id); }} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"><Check size={14} /></button>
                            <button onClick={event => { event.stopPropagation(); onSetDeleteConfirm(null); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={14} /></button>
                          </div>
                        ) : (
                          <button
                            onClick={event => {
                              event.stopPropagation();
                              onSetDeleteConfirm(`group-${group.id}`);
                            }}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                            title="Excluir topico"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {groupStats.total > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${groupStats.progresso * 100}%`, backgroundColor: subject.color }}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {pendingCount > 0 && <span>{pendingCount} pendentes</span>}
                      {dueReviewsCount > 0 && <span>{dueReviewsCount} revisoes</span>}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2 px-4 py-3">
                {previewTopics.length > 0 ? (
                  previewTopics.map(topic => (
                    <button
                      key={`group-card-topic-${topic.id}`}
                      onClick={event => {
                        event.stopPropagation();
                        onOpenStudyPopup(group.id, topic.id);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-left text-xs text-slate-600 transition-colors hover:bg-slate-100 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800"
                      title="Abrir painel rapido do assunto"
                    >
                      <span className={`truncate ${topic.studied ? 'text-slate-400 line-through dark:text-slate-500' : ''}`}>
                        {topic.name}
                      </span>
                      {topic.studied && <Check size={12} className="shrink-0 text-emerald-600" />}
                    </button>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
                    Sem assuntos neste filtro
                  </div>
                )}

                {filtered.length > previewTopics.length && (
                  <p className="pt-1 text-[11px] text-slate-400 dark:text-slate-500">
                    +{filtered.length - previewTopics.length} assuntos
                  </p>
                )}
              </div>

              <div className="px-4 pb-4">
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation();
                    setPopupGroupId(group.id);
                  }}
                  className="w-full rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Abrir grupo
                </button>
              </div>
            </motion.article>
          );
        }

        return (
          <motion.div
            key={group.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200/60 bg-white/85 backdrop-blur-xl shadow-xl shadow-slate-200/40 overflow-hidden dark:border-slate-700/60 dark:bg-slate-900/80 dark:shadow-slate-900/40"
          >
            {/* ─── Group Header ───────────── */}
            <div
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              onClick={() => onToggleGroupCollapse(group.id)}
            >
              <div
                className="w-1 h-12 rounded-full shrink-0"
                style={{ backgroundColor: subject.color }}
              />
              <button className="text-slate-400 dark:text-slate-400 shrink-0">
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
              </button>

              {editingGroupId === group.id ? (
                <div className="flex-1 flex gap-2 items-center" onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editGroupName}
                    onChange={e => onSetEditGroupName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') onSaveGroupEdit(group.id); if (e.key === 'Escape') onSetEditingGroupId(null); }}
                    className="flex-1 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 bg-white dark:bg-slate-950 dark:text-slate-100"
                    style={getRingColorStyle(subject.color)}
                    autoFocus
                  />
                  <button onClick={() => onSaveGroupEdit(group.id)} className="text-green-600 hover:text-green-700"><Save size={16} /></button>
                  <button onClick={() => onSetEditingGroupId(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X size={16} /></button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={event => {
                      event.stopPropagation();
                      setPopupGroupId(group.id);
                    }}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 dark:text-slate-100">{"\u{1F4C1}"} {group.name}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-500">
                        {groupStats.studied}/{groupStats.total} estudados
                      </span>
                      {groupStats.total > 0 && (
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: subject.color + '15', color: subject.color }}
                        >
                          {formatPercent(groupStats.progresso)}
                        </span>
                      )}
                      {groupStats.reviewsDue > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-200 font-medium flex items-center gap-1">
                          <Brain size={10} /> {groupStats.reviewsDue} revisoes
                        </span>
                      )}
                    </div>
                    {groupStats.total > 0 && (
                      <div className="mt-1.5 max-w-sm">
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${groupStats.progresso * 100}%`, backgroundColor: subject.color }}
                          />
                        </div>
                      </div>
                    )}
                  </button>

                  {/* ─── Group Actions ───────────── */}
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setPopupGroupId(group.id)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                      title="Abrir popup do grupo"
                    >
                      <FolderOpen size={14} />
                    </button>
                    <button
                      onClick={() => { onSetEditingGroupId(group.id); onSetEditGroupName(group.name); }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30"
                      title="Renomear topico"
                    >
                      <Edit3 size={14} />
                    </button>
                    {deleteConfirm === `group-${group.id}` ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => onRemoveGroup(group.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Check size={14} /></button>
                        <button onClick={() => onSetDeleteConfirm(null)} className="p-1.5 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"><X size={14} /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onSetDeleteConfirm(`group-${group.id}`)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30"
                        title="Excluir topico"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ─── Group Content (Expanded) ───────────── */}
            {!isCollapsed && (
              <div className="border-t border-slate-100 dark:border-slate-700">
                {/* ─── Quick Add Topics ───────────── */}
                <div className="px-4 py-4 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-800/50 dark:to-transparent space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={newTopicInputs[group.id] || ''}
                        onChange={e => onSetNewTopicInputs(prev => ({ ...prev, [group.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && onAddTopicToGroup(group.id)}
                        placeholder="Adicionar novo assunto..."
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-white dark:bg-slate-950 dark:text-slate-100"
                        style={getRingColorStyle(subject.color)}
                      />
                      <BookOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                    <button
                      onClick={() => onAddTopicToGroup(group.id)}
                      className="px-4 py-2.5 rounded-xl text-white text-sm hover:opacity-90 transition-opacity shrink-0"
                      style={{ backgroundColor: subject.color }}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <button
                    onClick={() => onSetShowBulkAdd(showBulkAdd === group.id ? null : group.id)}
                    className="text-xs font-medium hover:underline transition-colors inline-flex items-center gap-1"
                    style={{ color: subject.color }}
                  >
                    <FileText size={12} />
                    {showBulkAdd === group.id ? 'Fechar' : 'Adicionar varios assuntos'}
                  </button>
                  {showBulkAdd === group.id && (
                    <div className="space-y-2">
                      <textarea
                        value={bulkInputs[group.id] || ''}
                        onChange={e => onSetBulkInputs(prev => ({ ...prev, [group.id]: e.target.value }))}
                        placeholder={"Um assunto por linha:\nQuatro operacoes\nFracoes\nPotenciacao"}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent h-28 resize-y bg-white dark:bg-slate-950 dark:text-slate-100"
                        style={getRingColorStyle(subject.color)}
                      />
                      <button
                        onClick={() => onAddBulkTopicsToGroup(group.id)}
                        className="px-4 py-2 rounded-xl text-white text-sm hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: subject.color }}
                      >
                        Adicionar Todos
                      </button>
                    </div>
                  )}
                </div>

                {/* ─── Topics List ───────────── */}
                {filtered.length === 0 && group.topics.length > 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-slate-400">
                    Nenhum assunto corresponde ao filtro selecionado.
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-slate-400">
                    <BookOpen size={24} className="mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                    Nenhum assunto adicionado neste topico ainda.
                  </div>
                ) : viewMode === 'table' ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-gray-50 dark:bg-slate-950/70 text-gray-500 dark:text-slate-400">
                        <tr className="text-[11px] uppercase tracking-wide">
                          <th className="px-3 py-2 w-8 text-center align-middle">OK</th>
                          <th className="px-3 py-2 align-middle">Assunto</th>
                          <th className="px-3 py-2 hidden md:table-cell align-middle">Prioridade</th>
                          <th className="px-3 py-2 hidden lg:table-cell align-middle">Prazo</th>
                          <th className="px-3 py-2 hidden lg:table-cell align-middle">Revisao</th>
                          <th className="px-3 py-2 hidden md:table-cell align-middle">Questoes</th>
                          <th className="px-3 py-2 hidden lg:table-cell align-middle">Mastery</th>
                          <th className="px-3 py-2 hidden xl:table-cell align-middle">Tags</th>
                          <th className="px-3 py-2 w-24 text-center align-middle">Acoes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {filtered.map((topic) => {
                          const isEditing = editingTopicId === topic.id;
                          const accuracy = topic.questionsTotal > 0
                            ? topic.questionsCorrect / topic.questionsTotal
                            : null;
                          const mastery = calculateTopicMastery(topic);
                          const masteryClass = getMasteryBadgeClass(mastery.score);
                          const reviewStatus = getReviewStatus(topic.fsrsNextReview);
                          const nextReviewLabel = topic.studied && topic.fsrsNextReview
                            ? new Date(topic.fsrsNextReview + 'T00:00:00').toLocaleDateString('pt-BR')
                            : '—';
                          const isDue = topic.studied && isReviewDue(topic.fsrsNextReview);
                          const isSelected = selectedTopicIds.has(topic.id);
                          const isHighlighted = highlightTopicId === topic.id;
                          const rowClass = isSelected
                            ? 'bg-blue-50/60 dark:bg-blue-900/20'
                            : isHighlighted
                            ? 'bg-amber-50/70 dark:bg-amber-900/20'
                            : isDue
                            ? 'bg-purple-50/30 dark:bg-purple-900/10'
                            : '';
                          const tagsPreview = (topic.tags ?? []).slice(0, 3);

                          return (
                            <tr
                              key={topic.id}
                              id={`topic-${topic.id}`}
                              className={rowClass}
                              onMouseDown={event => {
                                if (event.button !== 0) return;
                                if (isInteractiveTarget(event.target)) return;
                                if (selectionMode) {
                                  onToggleTopicSelection(topic.id);
                                  return;
                                }
                                if (!isSelected) return;
                                onToggleTopicSelection(topic.id);
                              }}
                            >
                              <td className="px-3 py-2 align-middle text-center">
                                <StudiedToggleButton
                                  studied={topic.studied}
                                  onToggle={() => onSetTopicStudied(group.id, topic.id, !topic.studied)}
                                  size="sm"
                                  className="mx-auto"
                                />
                              </td>
                              <td className="px-3 py-2 align-middle">
                                {isEditing ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={editTopicName}
                                      onChange={e => onSetEditTopicName(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter') onSaveTopicEdit(group.id, topic.id); if (e.key === 'Escape') onCancelTopicEdit(); }}
                                      className="w-full border border-gray-300 dark:border-slate-700 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 bg-white dark:bg-slate-950 dark:text-slate-100"
                                      style={getRingColorStyle(subject.color)}
                                      autoFocus
                                    />
                                    <button onClick={() => onSaveTopicEdit(group.id, topic.id)} className="text-green-600 hover:text-green-700"><Save size={14} /></button>
                                    <button onClick={onCancelTopicEdit} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"><X size={14} /></button>
                                  </div>
                                ) : (
                                  <div className="min-w-[180px]">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <button
                                        onClick={() => onOpenStudyPopup(group.id, topic.id)}
                                        className="shrink-0 p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                        title="Abrir painel rapido"
                                      >
                                        <BookOpen size={14} />
                                      </button>
                                      <button
                                        onClick={() => onToggleTopicSelection(topic.id)}
                                        className={`min-w-0 truncate p-0 border-0 bg-transparent font-medium text-left hover:underline ${
                                          topic.studied ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-800 dark:text-slate-100'
                                        }`}
                                        title={isSelected ? 'Remover da seleção em massa' : 'Selecionar para ação em massa'}
                                      >
                                        {topic.name}
                                      </button>
                                    </div>
                                    {(topic.tags ?? []).length > 0 && (
                                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                        {tagsPreview.map(tag => (
                                          <span
                                            key={`${topic.id}-tag-${tag}`}
                                            className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                          >
                                            #{tag}
                                          </span>
                                        ))}
                                        {(topic.tags ?? []).length > tagsPreview.length && (
                                          <span className="hidden sm:inline-flex text-[10px] text-slate-400">
                                            +{(topic.tags ?? []).length - tagsPreview.length}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 hidden md:table-cell align-middle">
                                {topic.priority ? (
                                  <PriorityBadge priority={topic.priority} size="xs" />
                                ) : (
                                  <span className="text-gray-300 dark:text-slate-600">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 hidden lg:table-cell align-middle">
                                {topic.deadline ? (
                                  <DeadlineBadge deadline={topic.deadline} size="xs" />
                                ) : (
                                  <span className="text-gray-300 dark:text-slate-600">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 hidden lg:table-cell align-middle">
                                {topic.studied && topic.fsrsNextReview ? (
                                  <span className={`px-2 py-0.5 rounded-full font-medium ${reviewStatus.className}`}>
                                    {nextReviewLabel}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 dark:text-slate-600">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 hidden md:table-cell align-middle">
                                {topic.questionsTotal > 0 ? (
                                  <span className="text-gray-600 dark:text-slate-300">
                                    {topic.questionsCorrect}/{topic.questionsTotal} ({formatPercent(accuracy ?? 0)})
                                  </span>
                                ) : (
                                  <span className="text-gray-300 dark:text-slate-600">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 hidden lg:table-cell align-middle">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${masteryClass}`}>
                                  {mastery.score}% {mastery.label}
                                </span>
                              </td>
                              <td className="px-3 py-2 hidden xl:table-cell align-middle">
                                {(topic.tags ?? []).length > 0 ? (
                                  <span className="text-slate-500 dark:text-slate-300">
                                    {(topic.tags ?? []).slice(0, 4).map(tag => `#${tag}`).join(' ')}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 dark:text-slate-600">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 align-middle">
                                <div className="flex items-center justify-center gap-1">
                                  {!isEditing && (
                                    <button
                                      onClick={() => onStartTopicEdit(topic)}
                                      className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                      title="Editar nome"
                                    >
                                      <Edit3 size={14} />
                                    </button>
                                  )}
                                  {deleteConfirm === `topic-${topic.id}` ? (
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => onRemoveTopic(group.id, topic.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Check size={14} /></button>
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
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="p-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((topic) => {
                      const isEditing = editingTopicId === topic.id;
                      const isSelected = selectedTopicIds.has(topic.id);
                      const isHighlighted = highlightTopicId === topic.id;
                      const isDue = topic.studied && isReviewDue(topic.fsrsNextReview);
                      const mastery = calculateTopicMastery(topic);
                      const masteryClass = getMasteryBadgeClass(mastery.score);
                      const reviewStatus = getReviewStatus(topic.fsrsNextReview);
                      const accuracy = topic.questionsTotal > 0
                        ? topic.questionsCorrect / topic.questionsTotal
                        : null;
                      const nextReviewLabel = topic.studied && topic.fsrsNextReview
                        ? new Date(topic.fsrsNextReview + 'T00:00:00').toLocaleDateString('pt-BR')
                        : null;
                      const tagsPreview = topic.tags.slice(0, 4);
                      const priorityGradient = topic.priority === 'alta'
                        ? 'from-rose-500 to-pink-500'
                        : topic.priority === 'media'
                        ? 'from-amber-500 to-orange-500'
                        : topic.priority === 'baixa'
                        ? 'from-emerald-500 to-teal-500'
                        : 'from-slate-300 to-slate-400';
                      const cardClass = isSelected
                        ? 'ring-2 ring-blue-300 bg-blue-50/70 dark:bg-blue-900/20'
                        : isHighlighted
                        ? 'ring-2 ring-amber-300 bg-amber-50/70 dark:bg-amber-900/20'
                        : isDue
                        ? 'ring-1 ring-purple-300 bg-purple-50/40 dark:bg-purple-900/20'
                        : topic.studied
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10'
                        : 'hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-lg hover:shadow-indigo-100/50 dark:hover:shadow-indigo-900/20';

                      return (
                        <motion.article
                          key={topic.id}
                          id={`topic-${topic.id}`}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          whileHover={{ y: -3 }}
                          className={`group relative rounded-xl border bg-white dark:bg-slate-900 transition-all duration-200 overflow-hidden ${cardClass}`}
                          onMouseDown={event => {
                            if (event.button !== 0) return;
                            if (isInteractiveTarget(event.target)) return;
                            if (selectionMode) {
                              onToggleTopicSelection(topic.id);
                              return;
                            }
                            if (!isSelected) return;
                            onToggleTopicSelection(topic.id);
                          }}
                        >
                          <div className={`h-1 w-full bg-gradient-to-r ${priorityGradient}`} />

                          <div className="p-3.5 space-y-3">
                            <div className="flex items-start gap-3">
                              <StudiedToggleButton
                                studied={topic.studied}
                                onToggle={() => onSetTopicStudied(group.id, topic.id, !topic.studied)}
                                size="md"
                                className="mt-0.5"
                              />

                              <div className="min-w-0 flex-1">
                                {isEditing ? (
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      value={editTopicName}
                                      onChange={event => onSetEditTopicName(event.target.value)}
                                      onKeyDown={event => {
                                        if (event.key === 'Enter') onSaveTopicEdit(group.id, topic.id);
                                        if (event.key === 'Escape') onCancelTopicEdit();
                                      }}
                                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 bg-white dark:bg-slate-950 dark:text-slate-100"
                                      style={getRingColorStyle(subject.color)}
                                      autoFocus
                                    />
                                    <button onClick={() => onSaveTopicEdit(group.id, topic.id)} className="text-green-600 hover:text-green-700"><Save size={14} /></button>
                                    <button onClick={onCancelTopicEdit} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X size={14} /></button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => onToggleTopicSelection(topic.id)}
                                    className={`w-full text-left truncate font-semibold text-sm ${
                                      topic.studied ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'
                                    }`}
                                    title={isSelected ? 'Remover da selecao em massa' : 'Selecionar para acao em massa'}
                                  >
                                    {topic.name}
                                  </button>
                                )}

                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  {topic.priority ? (
                                    <PriorityBadge priority={topic.priority} size="xs" />
                                  ) : (
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500">Sem prioridade</span>
                                  )}
                                  {topic.deadline && <DeadlineBadge deadline={topic.deadline} size="xs" />}
                                  {nextReviewLabel && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${reviewStatus.className}`}>
                                      {nextReviewLabel}
                                    </span>
                                  )}
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${masteryClass}`}>
                                    {mastery.score}% {mastery.label}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {tagsPreview.length > 0 && (
                              <div className="flex min-h-6 flex-wrap items-center gap-1.5">
                                {tagsPreview.map(tag => (
                                  <span key={`${topic.id}-card-tag-${tag}`} className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-300">
                                    #{tag}
                                  </span>
                                ))}
                                {topic.tags.length > tagsPreview.length && (
                                  <span className="text-[10px] text-slate-400">+{topic.tags.length - tagsPreview.length}</span>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-2 py-1.5 text-slate-600 dark:text-slate-300">
                                {topic.questionsTotal > 0
                                  ? `${topic.questionsCorrect}/${topic.questionsTotal} (${formatPercent(accuracy ?? 0)})`
                                  : 'Sem questoes'}
                              </div>
                              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-2 py-1.5 text-slate-600 dark:text-slate-300">
                                {topic.reviewHistory.length} revisoes
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <button
                                onClick={() => onOpenStudyPopup(group.id, topic.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                                title="Abrir popup de revisao"
                              >
                                <BookOpen size={13} />
                                Revisar
                              </button>

                              <div className="flex items-center gap-1">
                                {!isEditing && (
                                  <button
                                    onClick={() => onStartTopicEdit(topic)}
                                    className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30"
                                    title="Editar nome"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                )}
                                {deleteConfirm === `topic-${topic.id}` ? (
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => onRemoveTopic(group.id, topic.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"><Check size={14} /></button>
                                    <button onClick={() => onSetDeleteConfirm(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={14} /></button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => onSetDeleteConfirm(`topic-${topic.id}`)}
                                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                                    title="Excluir assunto"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-slate-800">
                    {filtered.map((topic) => (
                      <TopicRow
                        key={topic.id}
                        topic={topic}
                        groupId={group.id}
                        subjectColor={subject.color}
                        editingTopicId={editingTopicId}
                        editTopicName={editTopicName}
                        deleteConfirm={deleteConfirm}
                        priorityMenuTopic={priorityMenuTopic}
                        isExpanded={expandedTopics.has(topic.id)}
                        isHighlighted={highlightTopicId === topic.id}
                        isSelected={selectedTopicIds.has(topic.id)}
                        selectionMode={selectionMode}
                        onToggleExpanded={onToggleTopicExpanded}
                        onToggleSelected={onToggleTopicSelection}
                        onOpenStudyPopup={onOpenStudyPopup}
                        onUpdateTopic={onUpdateTopic}
                        onUpdateQuestionProgress={onUpdateQuestionProgress}
                        onRemoveTopic={onRemoveTopic}
                        onStartEdit={onStartTopicEdit}
                        onSaveEdit={onSaveTopicEdit}
                        onCancelEdit={onCancelTopicEdit}
                        onSetEditName={onSetEditTopicName}
                        onSetDeleteConfirm={onSetDeleteConfirm}
                        onSetPriority={onSetPriority}
                        onTogglePriorityMenu={onSetPriorityMenuTopic}
                        tagDraft={tagInputs[topic.id] || ''}
                        tagSuggestionListId={tagSuggestionListId}
                        onTagDraftChange={onTagDraftChange}
                        onAddTag={onAddTag}
                        onRemoveTag={onRemoveTag}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        );
      })}
      </div>
      {popupGroup && (
        <GroupPopup
          group={popupGroup}
          visibleTopics={popupVisibleTopics}
          subjectColor={subject.color}
          onClose={() => setPopupGroupId(null)}
          onOpenTopic={(groupId, topicId) => {
            onOpenStudyPopup(groupId, topicId);
            setPopupGroupId(null);
          }}
          onSetTopicStudied={onSetTopicStudied}
        />
      )}
    </>
  );
}
