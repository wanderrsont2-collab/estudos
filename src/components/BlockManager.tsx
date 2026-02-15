import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { StudyBlock, Subject, TopicGroup } from '../types';
import { createBlock, generateId, getBlockStats, getBlockTopicGroups } from '../store';
import {
  Plus,
  Trash2,
  Edit3,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  X,
  Layers,
  Check,
  BookOpen,
  ArrowUp,
  ArrowDown,
  Search,
} from 'lucide-react';

interface BlockManagerProps {
  subjects: Subject[];
  onUpdateSubject: (subject: Subject) => void;
  onNavigateToSubject: (subjectId: string, topicId?: string) => void;
}

interface BoardSelection {
  subjectId: string;
  blockId: string;
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
      <div
        className="h-2.5 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${Math.min(value * 100, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function formatPercent(v: number) {
  return `${Math.round(v * 100)}%`;
}

interface GroupPickerProps {
  subject: Subject;
  existingGroupIds: string[];
  onAdd: (groupIds: string[]) => void;
  onClose: () => void;
}

function GroupPicker({ subject, existingGroupIds, onAdd, onClose }: GroupPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const existing = useMemo(() => new Set(existingGroupIds), [existingGroupIds]);

  const availableGroups = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('pt-BR');
    return subject.topicGroups.filter(group => {
      if (existing.has(group.id)) return false;
      if (!query) return true;
      return (
        group.name.toLocaleLowerCase('pt-BR').includes(query)
        || group.topics.some(topic => topic.name.toLocaleLowerCase('pt-BR').includes(query))
      );
    });
  }, [existing, searchQuery, subject.topicGroups]);

  function toggleGroup(groupId: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function handleConfirm() {
    onAdd(Array.from(selected));
  }

  return (
    <div className="fixed inset-0 z-[85] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[80vh] rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between shrink-0">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Adicionar grupos ao bloco</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 bg-white dark:bg-slate-950">
            <Search size={14} className="text-gray-400" />
            <input
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Buscar grupos ou topicos..."
              className="flex-1 bg-transparent text-sm outline-none text-gray-800 dark:text-slate-100 placeholder:text-gray-400"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {availableGroups.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">
              {searchQuery ? 'Nenhum grupo encontrado.' : 'Todos os grupos ja foram adicionados a este bloco.'}
            </p>
          ) : (
            availableGroups.map(group => {
              const isSelected = selected.has(group.id);
              const studiedCount = group.topics.filter(topic => topic.studied).length;
              return (
                <button
                  key={group.id}
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border flex items-start gap-3 transition-colors ${
                    isSelected
                      ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-300 dark:border-slate-600'
                  }`}>
                    {isSelected && <Check size={10} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{group.name}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {group.topics.length} topico{group.topics.length !== 1 ? 's' : ''} | {studiedCount}/{group.topics.length} estudados
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-500 dark:text-slate-400">
            {selected.size} grupo{selected.size !== 1 ? 's' : ''} selecionado{selected.size !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected.size === 0}
              className="px-3 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
            >
              <Plus size={14} /> Adicionar {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BlockManager({ subjects, onUpdateSubject, onNavigateToSubject }: BlockManagerProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id ?? '');
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newBlockName, setNewBlockName] = useState('');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editBlockName, setEditBlockName] = useState('');
  const [editBlockDescription, setEditBlockDescription] = useState('');
  const [editBlockColor, setEditBlockColor] = useState('#1565c0');
  const [groupPickerBlockId, setGroupPickerBlockId] = useState<string | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<BoardSelection | null>(null);
  const [reviewDraftBlockId, setReviewDraftBlockId] = useState<string | null>(null);
  const [reviewDraftTitle, setReviewDraftTitle] = useState('');
  const [reviewDraftQuestionsCount, setReviewDraftQuestionsCount] = useState('');
  const [reviewDraftGoal, setReviewDraftGoal] = useState('');
  const [reviewDraftError, setReviewDraftError] = useState<string | null>(null);

  const selectedSubject = useMemo(() => (
    subjects.find(subject => subject.id === selectedSubjectId) ?? subjects[0] ?? null
  ), [selectedSubjectId, subjects]);

  useEffect(() => {
    if (selectedSubject && selectedSubject.id !== selectedSubjectId) {
      setSelectedSubjectId(selectedSubject.id);
    }
  }, [selectedSubject, selectedSubjectId]);

  const sortedBlocks = useMemo(() => {
    if (!selectedSubject) return [] as StudyBlock[];
    return [...selectedSubject.blocks].sort((a, b) => a.order - b.order);
  }, [selectedSubject]);

  const allBoards = useMemo(() => {
    const rows: {
      subject: Subject;
      block: StudyBlock;
      stats: ReturnType<typeof getBlockStats>;
    }[] = [];

    for (const subject of subjects) {
      const sorted = [...subject.blocks].sort((a, b) => a.order - b.order);
      for (const block of sorted) {
        rows.push({
          subject,
          block,
          stats: getBlockStats(block, subject),
        });
      }
    }

    return rows;
  }, [subjects]);

  const selectedBoardData = useMemo(() => {
    if (!selectedBoard) return null;
    const subject = subjects.find(item => item.id === selectedBoard.subjectId);
    if (!subject) return null;
    const block = subject.blocks.find(item => item.id === selectedBoard.blockId);
    if (!block) return null;
    return {
      subject,
      block,
      groups: getBlockTopicGroups(block, subject),
      stats: getBlockStats(block, subject),
    };
  }, [selectedBoard, subjects]);

  useEffect(() => {
    if (!selectedSubject) {
      setExpandedBlockId(null);
      return;
    }
    const first = [...selectedSubject.blocks].sort((a, b) => a.order - b.order)[0]?.id ?? null;
    setExpandedBlockId(first);
  }, [selectedSubjectId]);

  useEffect(() => {
    if (!selectedSubject) return;
    if (expandedBlockId === null) return; // allow manual collapse
    if (selectedSubject.blocks.some(block => block.id === expandedBlockId)) return;
    const first = [...selectedSubject.blocks].sort((a, b) => a.order - b.order)[0]?.id ?? null;
    setExpandedBlockId(first);
  }, [expandedBlockId, selectedSubject]);

  useEffect(() => {
    if (selectedBoard && !selectedBoardData) {
      setSelectedBoard(null);
    }
  }, [selectedBoard, selectedBoardData]);

  useEffect(() => {
    if (!reviewDraftBlockId || !selectedSubject) return;
    if (selectedSubject.blocks.some(block => block.id === reviewDraftBlockId)) return;
    closeReviewDraft();
  }, [reviewDraftBlockId, selectedSubject]);

  function updateBlocks(nextBlocks: StudyBlock[]) {
    if (!selectedSubject) return;
    onUpdateSubject({
      ...selectedSubject,
      blocks: nextBlocks,
    });
  }

  function handleCreateBlock(event: FormEvent) {
    event.preventDefault();
    if (!selectedSubject) return;
    const trimmed = newBlockName.trim();
    if (!trimmed) return;

    const maxOrder = selectedSubject.blocks.reduce((max, block) => Math.max(max, block.order), -1);
    const block = createBlock(trimmed, maxOrder + 1);
    updateBlocks([...selectedSubject.blocks, block]);
    setNewBlockName('');
    setIsCreating(false);
    setExpandedBlockId(block.id);
  }

  function deleteBlock(blockId: string) {
    if (!selectedSubject) return;
    updateBlocks(selectedSubject.blocks.filter(block => block.id !== blockId));
    if (expandedBlockId === blockId) setExpandedBlockId(null);
  }

  function moveBlock(blockId: string, direction: 'up' | 'down') {
    if (!selectedSubject) return;
    const sorted = [...selectedSubject.blocks].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(block => block.id === blockId);
    if (idx < 0) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const temp = sorted[idx].order;
    sorted[idx] = { ...sorted[idx], order: sorted[swapIdx].order };
    sorted[swapIdx] = { ...sorted[swapIdx], order: temp };
    updateBlocks(sorted);
  }

  function startEditBlock(block: StudyBlock) {
    setEditingBlockId(block.id);
    setEditBlockName(block.name);
    setEditBlockDescription(block.description);
    setEditBlockColor(block.color);
  }

  function saveEditBlock() {
    if (!selectedSubject || !editingBlockId) return;
    const trimmed = editBlockName.trim();
    if (!trimmed) return;

    updateBlocks(
      selectedSubject.blocks.map(block => (
        block.id === editingBlockId
          ? {
              ...block,
              name: trimmed,
              description: editBlockDescription.trim(),
              color: editBlockColor,
            }
          : block
      )),
    );

    setEditingBlockId(null);
  }

  function addGroupsToBlock(blockId: string, groupIds: string[]) {
    if (!selectedSubject || groupIds.length === 0) return;

    updateBlocks(
      selectedSubject.blocks.map(block => {
        if (block.id !== blockId) return block;
        const merged = new Set([...block.topicGroupIds, ...groupIds]);
        return {
          ...block,
          topicGroupIds: Array.from(merged),
        };
      }),
    );

    setGroupPickerBlockId(null);
  }

  function removeGroupFromBlock(blockId: string, groupId: string) {
    if (!selectedSubject) return;

    updateBlocks(
      selectedSubject.blocks.map(block => (
        block.id === blockId
          ? {
              ...block,
              topicGroupIds: block.topicGroupIds.filter(id => id !== groupId),
            }
        : block
      )),
    );
  }

  function openReviewDraft(blockId: string) {
    setReviewDraftBlockId(blockId);
    setReviewDraftTitle('');
    setReviewDraftQuestionsCount('');
    setReviewDraftGoal('');
    setReviewDraftError(null);
  }

  function closeReviewDraft() {
    setReviewDraftBlockId(null);
    setReviewDraftError(null);
  }

  function addCumulativeReview(blockId: string) {
    if (!selectedSubject) return;
    const title = reviewDraftTitle.replace(/\s+/g, ' ').trim();
    const questionsCount = Number.parseInt(reviewDraftQuestionsCount, 10);
    const goalText = reviewDraftGoal.replace(/\s+/g, ' ').trim();

    if (!title) {
      setReviewDraftError('Informe o tema principal da revisao cumulativa.');
      return;
    }

    if (!Number.isFinite(questionsCount) || questionsCount < 1 || questionsCount > 5000) {
      setReviewDraftError('Quantidade de questoes deve estar entre 1 e 5000.');
      return;
    }

    updateBlocks(
      selectedSubject.blocks.map(block => (
        block.id === blockId
          ? {
              ...block,
              cumulativeReviews: [
                ...(block.cumulativeReviews ?? []),
                {
                  id: `crev_${generateId()}`,
                  title,
                  questionsCount,
                  goalText,
                  completed: false,
                },
              ],
            }
          : block
      )),
    );

    closeReviewDraft();
  }

  function toggleCumulativeReview(blockId: string, reviewId: string) {
    if (!selectedSubject) return;
    updateBlocks(
      selectedSubject.blocks.map(block => (
        block.id === blockId
          ? {
              ...block,
              cumulativeReviews: (block.cumulativeReviews ?? []).map(review => (
                review.id === reviewId
                  ? { ...review, completed: !review.completed }
                  : review
              )),
            }
          : block
      )),
    );
  }

  function removeCumulativeReview(blockId: string, reviewId: string) {
    if (!selectedSubject) return;
    updateBlocks(
      selectedSubject.blocks.map(block => (
        block.id === blockId
          ? {
              ...block,
              cumulativeReviews: (block.cumulativeReviews ?? []).filter(review => review.id !== reviewId),
            }
          : block
      )),
    );
  }

  function openBoard(subjectId: string, blockId: string) {
    setSelectedSubjectId(subjectId);
    setSelectedBoard({ subjectId, blockId });
  }

  const pickerBlock = groupPickerBlockId
    ? selectedSubject?.blocks.find(block => block.id === groupPickerBlockId) ?? null
    : null;

  if (!selectedSubject) {
    return (
      <div className="max-w-4xl mx-auto rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-700 p-12 text-center">
        <Layers size={40} className="mx-auto text-gray-300 dark:text-slate-600 mb-3" />
        <p className="text-sm text-gray-500 dark:text-slate-400">Nenhuma disciplina cadastrada.</p>
      </div>
    );
  }

  if (selectedBoardData) {
    const rows = selectedBoardData.groups.flatMap(group => (
      group.topics.map(topic => ({ group, topic }))
    ));
    const cumulativeReviews = selectedBoardData.block.cumulativeReviews ?? [];
    const completedReviewsCount = cumulativeReviews.filter(review => review.completed).length;
    const isAddingReview = reviewDraftBlockId === selectedBoardData.block.id;

    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <button
          onClick={() => {
            setSelectedBoard(null);
            closeReviewDraft();
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-3 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={14} /> Voltar para quadros
        </button>

        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div
            className="h-2 w-full"
            style={{ backgroundColor: selectedBoardData.block.color }}
          />
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm px-2 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
                {selectedBoardData.subject.emoji} {selectedBoardData.subject.name}
              </span>
              <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                {selectedBoardData.block.name}
              </h2>
              <span
                className="text-xs font-semibold px-2 py-1 rounded-md"
                style={{ backgroundColor: selectedBoardData.block.color + '20', color: selectedBoardData.block.color }}
              >
                {selectedBoardData.stats.total} topicos
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
              {selectedBoardData.block.description || 'Sem descricao para este bloco.'}
            </p>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <span className="rounded-lg bg-gray-100 dark:bg-slate-800 px-2 py-1 text-gray-600 dark:text-slate-300">
                Grupos: {selectedBoardData.stats.groupCount}
              </span>
              <span className="rounded-lg bg-gray-100 dark:bg-slate-800 px-2 py-1 text-gray-600 dark:text-slate-300">
                Estudados: {selectedBoardData.stats.studied}/{selectedBoardData.stats.total}
              </span>
              <span className="rounded-lg bg-gray-100 dark:bg-slate-800 px-2 py-1 text-gray-600 dark:text-slate-300">
                Progresso: {formatPercent(selectedBoardData.stats.progresso)}
              </span>
              <span className="rounded-lg bg-gray-100 dark:bg-slate-800 px-2 py-1 text-gray-600 dark:text-slate-300">
                Revisoes: {selectedBoardData.stats.reviewsDue}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-emerald-100 dark:border-emerald-900/30 flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Revisao cumulativa</h3>
            <span className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
              {completedReviewsCount}/{cumulativeReviews.length} concluida{completedReviewsCount !== 1 ? 's' : ''}
            </span>
            <div className="flex-1" />
            <button
              onClick={() => (isAddingReview ? closeReviewDraft() : openReviewDraft(selectedBoardData.block.id))}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                isAddingReview
                  ? 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
              }`}
            >
              {isAddingReview ? <X size={12} /> : <Plus size={12} />}
              {isAddingReview ? 'Cancelar' : 'Adicionar'}
            </button>
          </div>

          <div className="p-4 space-y-3">
            {cumulativeReviews.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Nenhuma revisao cumulativa cadastrada para este bloco.
              </p>
            ) : (
              <div className="space-y-2">
                {cumulativeReviews.map(review => (
                  <div
                    key={review.id}
                    className={`rounded-lg border px-3 py-2 flex items-start gap-2 ${
                      review.completed
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <button
                      onClick={() => toggleCumulativeReview(selectedBoardData.block.id, review.id)}
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        review.completed
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-gray-300 dark:border-slate-600'
                      }`}
                      title={review.completed ? 'Marcar como pendente' : 'Marcar como concluida'}
                    >
                      {review.completed && <Check size={10} />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${
                        review.completed
                          ? 'text-emerald-800 dark:text-emerald-200'
                          : 'text-gray-800 dark:text-slate-100'
                      }`}>
                        {review.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {review.questionsCount} questoes
                        {review.goalText ? ` | Meta: ${review.goalText}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isAddingReview && (
              <form
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  addCumulativeReview(selectedBoardData.block.id);
                }}
                className="rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-white dark:bg-slate-900 p-3 space-y-2"
              >
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">
                    Tema / subtopicos
                  </label>
                  <input
                    value={reviewDraftTitle}
                    onChange={event => setReviewDraftTitle(event.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-sm"
                    placeholder="Ex: 25 ENEM - Funcoes"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">
                      Quantidade de questoes
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      value={reviewDraftQuestionsCount}
                      onChange={event => setReviewDraftQuestionsCount(event.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-sm"
                      placeholder="Ex: 25"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">
                      Meta (opcional)
                    </label>
                    <input
                      value={reviewDraftGoal}
                      onChange={event => setReviewDraftGoal(event.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-sm"
                      placeholder="Ex: 65% de acertos"
                    />
                  </div>
                </div>
                {reviewDraftError && (
                  <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-md px-2 py-1.5">
                    {reviewDraftError}
                  </p>
                )}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    <Plus size={12} /> Salvar revisao cumulativa
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Topicos e materia do bloco</h3>
          </div>

          {rows.length === 0 ? (
            <div className="p-8 text-center">
              <BookOpen size={26} className="mx-auto mb-2 text-gray-300 dark:text-slate-600" />
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Este bloco ainda nao possui grupos com topicos.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-300">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Materia</th>
                    <th className="text-left px-4 py-2 font-medium">Grupo</th>
                    <th className="text-left px-4 py-2 font-medium">Topico</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                    <th className="text-right px-4 py-2 font-medium">Abrir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {rows.map(({ group, topic }) => (
                    <tr key={`${group.id}_${topic.id}`} className="hover:bg-gray-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2 text-gray-700 dark:text-slate-200">
                        {selectedBoardData.subject.emoji} {selectedBoardData.subject.name}
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-slate-300">{group.name}</td>
                      <td className="px-4 py-2 text-gray-800 dark:text-slate-100">{topic.name}</td>
                      <td className="px-4 py-2">
                        {topic.studied ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                            Estudado
                          </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => onNavigateToSubject(selectedBoardData.subject.id, topic.id)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          Ver <ArrowRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Layers size={22} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Blocos por disciplina</h1>
            <p className="text-xs text-gray-500 dark:text-slate-400">Agrupe topicos por fase para cada materia.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedSubject.id}
            onChange={event => setSelectedSubjectId(event.target.value)}
            className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            aria-label="Selecionar disciplina dos blocos"
          >
            {subjects.map(subject => (
              <option key={subject.id} value={subject.id}>
                {subject.emoji} {subject.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} /> Novo bloco
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Quadros grandes</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Clique em um quadro para abrir outra pagina com topicos e materia do bloco.
            </p>
          </div>
          <span className="text-xs text-gray-500 dark:text-slate-400">
            {allBoards.length} quadro{allBoards.length !== 1 ? 's' : ''}
          </span>
        </div>

        {allBoards.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700 p-6 text-center">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Crie blocos nas materias para montar seus quadros.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allBoards.map(({ subject, block, stats }) => (
              <button
                key={`${subject.id}_${block.id}`}
                onClick={() => openBoard(subject.id, block.id)}
                className="rounded-xl border border-gray-200 dark:border-slate-700 text-left bg-white dark:bg-slate-950 hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden min-h-[180px]"
              >
                <div className="h-2 w-full" style={{ backgroundColor: block.color }} />
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {subject.emoji} {subject.name}
                      </p>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 truncate">
                        {block.name}
                      </h3>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-300 font-medium">
                      Abrir <ArrowRight size={12} />
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2">
                    {block.description || 'Sem descricao.'}
                  </p>

                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Revisao cumulativa:{' '}
                    {(block.cumulativeReviews ?? []).filter(review => review.completed).length}
                    /{(block.cumulativeReviews ?? []).length}
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-gray-100 dark:bg-slate-800 px-2 py-1 text-center">
                      <p className="text-[10px] text-gray-500 dark:text-slate-400">Topicos</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">{stats.total}</p>
                    </div>
                    <div className="rounded-lg bg-gray-100 dark:bg-slate-800 px-2 py-1 text-center">
                      <p className="text-[10px] text-gray-500 dark:text-slate-400">Grupos</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">{stats.groupCount}</p>
                    </div>
                    <div className="rounded-lg bg-gray-100 dark:bg-slate-800 px-2 py-1 text-center">
                      <p className="text-[10px] text-gray-500 dark:text-slate-400">Progresso</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">{formatPercent(stats.progresso)}</p>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {isCreating && (
        <form
          onSubmit={handleCreateBlock}
          className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/15 p-4 space-y-3"
        >
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300">Nome do bloco</label>
          <input
            value={newBlockName}
            onChange={event => setNewBlockName(event.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Ex: Fase 1 - Fundamentos"
            autoFocus
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg text-sm text-white bg-indigo-600 hover:bg-indigo-700 inline-flex items-center gap-1"
            >
              <Plus size={14} /> Criar
            </button>
          </div>
        </form>
      )}

      {sortedBlocks.length === 0 && !isCreating ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-700 p-12 text-center">
          <BookOpen size={40} className="mx-auto text-gray-300 dark:text-slate-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">Nenhum bloco criado para {selectedSubject.name}.</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">Crie blocos para separar os grupos de topicos por fase.</p>
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={16} /> Criar primeiro bloco
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedBlocks.map((block, idx) => {
            const stats = getBlockStats(block, selectedSubject);
            const groups = getBlockTopicGroups(block, selectedSubject);
            const isExpanded = expandedBlockId === block.id;
            const cumulativeReviews = block.cumulativeReviews ?? [];
            const completedReviewsCount = cumulativeReviews.filter(review => review.completed).length;
            const isAddingReview = reviewDraftBlockId === block.id;

            return (
              <div
                key={block.id}
                className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setExpandedBlockId(isExpanded ? null : block.id)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: block.color }}
                  >
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">{block.name}</h3>
                      {stats.reviewsDue > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          {stats.reviewsDue} revisao(oes)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-500 dark:text-slate-400">
                        {stats.total} topico{stats.total !== 1 ? 's' : ''} | {stats.groupCount} grupo{stats.groupCount !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-slate-400">
                        {stats.studied}/{stats.total} estudados
                      </span>
                    </div>
                    {stats.total > 0 && (
                      <div className="mt-1.5 max-w-xs">
                        <ProgressBar value={stats.progresso} color={block.color} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {stats.total > 0 && (
                      <span
                        className="text-xs font-bold px-2 py-1 rounded-lg"
                        style={{ backgroundColor: block.color + '15', color: block.color }}
                      >
                        {formatPercent(stats.progresso)}
                      </span>
                    )}
                    {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-slate-700">
                    <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800/50 flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setGroupPickerBlockId(block.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                      >
                        <Plus size={12} /> Adicionar grupos
                      </button>
                      <button
                        onClick={() => startEditBlock(block)}
                        className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                      >
                        <Edit3 size={12} /> Editar
                      </button>
                      <button
                        onClick={() => moveBlock(block.id, 'up')}
                        disabled={idx === 0}
                        className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-slate-700 px-2 py-1.5 text-xs text-gray-500 dark:text-slate-400 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Mover para cima"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        onClick={() => moveBlock(block.id, 'down')}
                        disabled={idx === sortedBlocks.length - 1}
                        className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-slate-700 px-2 py-1.5 text-xs text-gray-500 dark:text-slate-400 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Mover para baixo"
                      >
                        <ArrowDown size={12} />
                      </button>
                      <div className="flex-1" />
                      <button
                        onClick={() => deleteBlock(block.id)}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 size={12} /> Excluir bloco
                      </button>
                    </div>

                    {block.description && (
                      <div className="px-4 py-2 text-xs text-gray-500 dark:text-slate-400 italic border-b border-gray-100 dark:border-slate-700">
                        {block.description}
                      </div>
                    )}

                    <div className="p-4 space-y-3">
                      {groups.length === 0 ? (
                        <div className="rounded-lg border-2 border-dashed border-gray-200 dark:border-slate-700 p-6 text-center">
                          <BookOpen size={24} className="mx-auto text-gray-300 dark:text-slate-600 mb-2" />
                          <p className="text-xs text-gray-500 dark:text-slate-400">Nenhum grupo neste bloco. Clique em "Adicionar grupos".</p>
                        </div>
                      ) : (
                        groups.map((group: TopicGroup) => {
                          const studiedCount = group.topics.filter(topic => topic.studied).length;
                          return (
                            <div key={group.id} className="rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
                              <div className="px-3 py-2 bg-gray-50 dark:bg-slate-800/40 flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700 dark:text-slate-200">{group.name}</span>
                                <span className="text-[10px] text-gray-500 dark:text-slate-400 ml-auto">
                                  {studiedCount}/{group.topics.length} estudados
                                </span>
                                <button
                                  onClick={() => removeGroupFromBlock(block.id, group.id)}
                                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                                  title="Remover grupo do bloco"
                                >
                                  <X size={12} />
                                </button>
                              </div>

                              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                                {group.topics.map(topic => (
                                  <button
                                    key={topic.id}
                                    onClick={() => onNavigateToSubject(selectedSubject.id, topic.id)}
                                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
                                  >
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${topic.studied ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-600'}`} />
                                    <span className="text-sm text-gray-800 dark:text-slate-200 truncate">{topic.name}</span>
                                    {topic.studied && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 shrink-0 ml-auto">
                                        Estudado
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      )}

                      <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-900/10 p-3 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                            Revisao cumulativa
                          </h4>
                          <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                            {completedReviewsCount}/{cumulativeReviews.length} concluida{completedReviewsCount !== 1 ? 's' : ''}
                          </span>
                          <div className="flex-1" />
                          <button
                            onClick={() => (isAddingReview ? closeReviewDraft() : openReviewDraft(block.id))}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                              isAddingReview
                                ? 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                                : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                            }`}
                          >
                            {isAddingReview ? <X size={12} /> : <Plus size={12} />}
                            {isAddingReview ? 'Cancelar' : 'Adicionar'}
                          </button>
                        </div>

                        {cumulativeReviews.length === 0 ? (
                          <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                            Nenhuma revisao cumulativa cadastrada para este bloco.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {cumulativeReviews.map(review => (
                              <div
                                key={review.id}
                                className={`rounded-lg border px-3 py-2 flex items-start gap-2 ${
                                  review.completed
                                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20'
                                    : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                                }`}
                              >
                                <button
                                  onClick={() => toggleCumulativeReview(block.id, review.id)}
                                  className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                    review.completed
                                      ? 'bg-emerald-600 border-emerald-600 text-white'
                                      : 'border-gray-300 dark:border-slate-600'
                                  }`}
                                  title={review.completed ? 'Marcar como pendente' : 'Marcar como concluida'}
                                >
                                  {review.completed && <Check size={10} />}
                                </button>

                                <div className="min-w-0 flex-1">
                                  <p className={`text-sm font-medium ${
                                    review.completed
                                      ? 'text-emerald-800 dark:text-emerald-200'
                                      : 'text-gray-800 dark:text-slate-100'
                                  }`}>
                                    {review.title}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-slate-400">
                                    {review.questionsCount} questoes
                                    {review.goalText ? ` | Meta: ${review.goalText}` : ''}
                                  </p>
                                </div>

                                <button
                                  onClick={() => removeCumulativeReview(block.id, review.id)}
                                  className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  title="Remover revisao cumulativa"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {isAddingReview && (
                          <form
                            onSubmit={(event: FormEvent) => {
                              event.preventDefault();
                              addCumulativeReview(block.id);
                            }}
                            className="rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-white dark:bg-slate-900 p-3 space-y-2"
                          >
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">
                                Tema / subtopicos
                              </label>
                              <input
                                value={reviewDraftTitle}
                                onChange={event => setReviewDraftTitle(event.target.value)}
                                className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-sm"
                                placeholder="Ex: 30 ENEM - Geometria plana e espacial"
                                autoFocus
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">
                                  Quantidade de questoes
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={5000}
                                  value={reviewDraftQuestionsCount}
                                  onChange={event => setReviewDraftQuestionsCount(event.target.value)}
                                  className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-sm"
                                  placeholder="Ex: 30"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">
                                  Meta (opcional)
                                </label>
                                <input
                                  value={reviewDraftGoal}
                                  onChange={event => setReviewDraftGoal(event.target.value)}
                                  className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-sm"
                                  placeholder="Ex: 65% de acertos"
                                />
                              </div>
                            </div>
                            {reviewDraftError && (
                              <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-md px-2 py-1.5">
                                {reviewDraftError}
                              </p>
                            )}
                            <div className="flex justify-end">
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                              >
                                <Plus size={12} /> Salvar revisao cumulativa
                              </button>
                            </div>
                          </form>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editingBlockId && (
        <div className="fixed inset-0 z-[86] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-gray-200 dark:border-slate-700">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Editar bloco</h3>
              <button
                onClick={() => setEditingBlockId(null)}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Nome</label>
                <input
                  value={editBlockName}
                  onChange={event => setEditBlockName(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Descricao</label>
                <textarea
                  value={editBlockDescription}
                  onChange={event => setEditBlockDescription(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  placeholder="Descricao opcional do bloco..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Cor</label>
                <input
                  type="color"
                  value={editBlockColor}
                  onChange={event => setEditBlockColor(event.target.value)}
                  className="h-10 w-14 rounded-lg border border-gray-300 dark:border-slate-700 p-1 bg-white dark:bg-slate-950"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditingBlockId(null)}
                  className="px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveEditBlock}
                  className="px-3 py-2 rounded-lg text-sm text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pickerBlock && (
        <GroupPicker
          subject={selectedSubject}
          existingGroupIds={pickerBlock.topicGroupIds}
          onAdd={groupIds => addGroupsToBlock(pickerBlock.id, groupIds)}
          onClose={() => setGroupPickerBlockId(null)}
        />
      )}
    </div>
  );
}
