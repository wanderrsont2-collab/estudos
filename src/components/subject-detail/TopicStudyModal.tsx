import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Award,
  BookOpen,
  Brain,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Hash,
  Sparkles,
  StickyNote,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import type { Priority, Topic } from '../../types';
import {
  FSRS_VERSION_LABEL,
  RATING_OPTIONS,
  getReviewStatus,
  normalizeFSRSConfig,
  previewAllRatings,
  suggestRatingFromPerformance,
  type FSRSConfig,
  type FSRSRating,
} from '../../fsrs';
import { calculateTopicMastery, getMasteryBadgeClass } from '../../mastery';
import { PRIORITY_CONFIG } from '../../store';
import {
  COMMON_TAG_PRESETS,
  formatPercent,
  getRingColorStyle,
  parseNonNegativeInt,
  PRIORITY_OPTIONS,
} from './shared';

export interface TopicStudyModalProps {
  topic: Topic | null;
  groupId: string;
  subjectColor: string;
  fsrsConfig: FSRSConfig;
  onClose: () => void;
  onUpdateTopic: (groupId: string, topicId: string, changes: Partial<Topic>) => void;
  onUpdateQuestionProgress: (groupId: string, topicId: string, nextTotal: number, nextCorrect: number) => void;
  onSetStudied: (groupId: string, topicId: string, studied: boolean) => void;
  onRunReview: (groupId: string, topicId: string, rating: FSRSRating) => void;
  onSetPriority: (groupId: string, topicId: string, priority: Priority | null) => void;
  onAddTag: (groupId: string, topicId: string, tag: string) => void;
  onRemoveTag: (groupId: string, topicId: string, tag: string) => void;
  tagSuggestionListId: string;
}

function SectionHeader({ icon: Icon, title }: { icon: ElementType; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-800">
        <Icon size={13} className="text-gray-500 dark:text-slate-400" />
      </div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">{title}</h4>
    </div>
  );
}

function toDateOnlyLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-gray-50 p-4 transition-shadow duration-300 hover:shadow-md dark:bg-slate-800/60">
      {accent && (
        <div className="absolute left-0 top-0 h-0.5 w-full" style={{ backgroundColor: accent }} />
      )}
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-800 dark:text-slate-100">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-400 dark:text-slate-500">{sub}</p>}
    </div>
  );
}

function ProgressRing({
  value,
  size = 56,
  strokeWidth = 4,
  color,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90 transform">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        className="text-gray-200 dark:text-slate-700"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: 'easeOut' }}
        strokeDasharray={circumference}
      />
    </svg>
  );
}

export function TopicStudyModal({
  topic,
  groupId,
  subjectColor,
  fsrsConfig,
  onClose,
  onUpdateTopic,
  onUpdateQuestionProgress,
  onSetStudied,
  onRunReview,
  onSetPriority,
  onAddTag,
  onRemoveTag,
  tagSuggestionListId,
}: TopicStudyModalProps) {
  const [autoMode, setAutoMode] = useState(true);
  const [tagInput, setTagInput] = useState('');
  const topicId = topic?.id ?? '';
  const [notesDraft, setNotesDraft] = useState(topic?.notes ?? '');
  const notesDraftRef = useRef(notesDraft);
  const notesDebounceRef = useRef<number | null>(null);
  const topicNotesRef = useRef(topic?.notes ?? '');

  useEffect(() => {
    const sourceNotes = topic?.notes ?? '';
    topicNotesRef.current = sourceNotes;
    setNotesDraft(sourceNotes);
    notesDraftRef.current = sourceNotes;
  }, [topic?.notes, topicId]);

  useEffect(() => {
    notesDraftRef.current = notesDraft;
  }, [notesDraft]);

  const flushNotesUpdate = useCallback((nextNotes?: string) => {
    if (!topicId) return;
    if (notesDebounceRef.current !== null) {
      window.clearTimeout(notesDebounceRef.current);
      notesDebounceRef.current = null;
    }
    const valueToCommit = nextNotes ?? notesDraftRef.current;
    if (valueToCommit === topicNotesRef.current) return;
    onUpdateTopic(groupId, topicId, { notes: valueToCommit });
  }, [groupId, onUpdateTopic, topicId]);

  const queueNotesUpdate = useCallback((nextNotes: string) => {
    if (!topicId) return;
    setNotesDraft(nextNotes);
    notesDraftRef.current = nextNotes;
    if (notesDebounceRef.current !== null) {
      window.clearTimeout(notesDebounceRef.current);
    }
    notesDebounceRef.current = window.setTimeout(() => {
      notesDebounceRef.current = null;
      if (notesDraftRef.current === topicNotesRef.current) return;
      onUpdateTopic(groupId, topicId, { notes: notesDraftRef.current });
    }, 350);
  }, [groupId, onUpdateTopic, topicId]);

  useEffect(() => {
    return () => {
      flushNotesUpdate();
    };
  }, [flushNotesUpdate]);

  if (!topic) return null;

  const normalizedConfig = normalizeFSRSConfig(fsrsConfig);
  const suggestedRating = suggestRatingFromPerformance(topic.questionsTotal, topic.questionsCorrect);
  const suggestedOption = suggestedRating
    ? RATING_OPTIONS.find(option => option.value === suggestedRating) ?? null
    : null;

  const currentState = {
    difficulty: topic.fsrsDifficulty,
    stability: topic.fsrsStability,
    lastReview: topic.fsrsLastReview,
    nextReview: topic.fsrsNextReview,
  };

  const customWeightsKey = normalizedConfig.customWeights ? normalizedConfig.customWeights.join('|') : 'default';
  const previewDatesByRating = useMemo(() => {
    const nextDates = {} as Record<FSRSRating, string | null>;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const previews = previewAllRatings(currentState, normalizedConfig);
    previews.forEach(preview => {
      const nextDate = new Date(today);
      nextDate.setDate(today.getDate() + preview.scheduledDays);
      nextDates[preview.rating] = toDateOnlyLocal(nextDate);
    });
    return nextDates;
  }, [
    currentState.difficulty,
    currentState.stability,
    currentState.lastReview,
    currentState.nextReview,
    normalizedConfig.version,
    normalizedConfig.requestedRetention,
    normalizedConfig.againMinIntervalDays,
    normalizedConfig.maxIntervalDays,
    customWeightsKey,
  ]);

  const suggestedDeadline = suggestedOption ? previewDatesByRating[suggestedOption.value] : null;
  const reviewStatus = getReviewStatus(topic.fsrsNextReview);
  const accuracy = topic.questionsTotal > 0 ? topic.questionsCorrect / topic.questionsTotal : null;
  const mastery = calculateTopicMastery(topic);
  const masteryClass = getMasteryBadgeClass(mastery.score);

  const displayRatingLabel: Record<FSRSRating, string> = {
    1: 'Esqueci',
    2: 'Dificil',
    3: 'Medio',
    4: 'Facil',
  };

  const ratingGradients: Record<number, string> = {
    1: 'from-red-500 to-rose-600',
    2: 'from-amber-500 to-orange-600',
    3: 'from-blue-500 to-indigo-600',
    4: 'from-emerald-500 to-teal-600',
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        <motion.div
          className="relative max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          onClick={event => event.stopPropagation()}
        >
          <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${subjectColor}, ${subjectColor}88)` }} />

          <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className="h-10 w-10 flex-shrink-0 rounded-2xl"
                style={{ backgroundColor: `${subjectColor}18`, boxShadow: `0 4px 14px ${subjectColor}25` }}
              >
                <div className="flex h-full w-full items-center justify-center">
                  <BookOpen size={18} style={{ color: subjectColor }} />
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold text-gray-900 dark:text-white">{topic.name}</h3>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500">
                  <Brain size={11} />
                  Painel de estudo e revisao FSRS
                </p>
              </div>
            </div>
            <motion.button
              type="button"
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="flex-shrink-0 rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              title="Fechar"
            >
              <X size={16} />
            </motion.button>
          </div>

          <div className="max-h-[calc(92vh-5rem)] overflow-y-auto px-6 pb-6">
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="relative col-span-1 flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100/50 p-4 dark:from-slate-800/80 dark:to-slate-800/40">
                  <div className="relative h-[56px] w-[56px]">
                    <ProgressRing value={mastery.score} color={subjectColor} />
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-800 dark:text-white">
                      {mastery.score}%
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">Mastery</p>
                  <span className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${masteryClass}`}>{mastery.label}</span>
                </div>

                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <StatCard
                    label="Rendimento"
                    value={accuracy !== null ? formatPercent(accuracy) : '-'}
                    sub={topic.questionsTotal > 0 ? `${topic.questionsCorrect}/${topic.questionsTotal} questoes` : 'Sem dados'}
                    accent={accuracy !== null ? (accuracy >= 0.7 ? '#22c55e' : accuracy >= 0.5 ? '#eab308' : '#ef4444') : undefined}
                  />
                  <StatCard
                    label="Revisao"
                    value={topic.fsrsNextReview ? new Date(topic.fsrsNextReview + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '-'}
                    sub={reviewStatus.text}
                    accent={subjectColor}
                  />
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-4 rounded-2xl border border-gray-100 p-4 dark:border-slate-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="group flex cursor-pointer items-center gap-3">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={topic.studied}
                        onChange={event => onSetStudied(groupId, topic.id, event.target.checked)}
                        className="peer sr-only"
                      />
                      <motion.div
                        className="flex h-5 w-5 items-center justify-center rounded-lg border-2 border-gray-300 transition-colors peer-checked:border-green-500 peer-checked:bg-green-500 dark:border-slate-600"
                        whileTap={{ scale: 0.85 }}
                      >
                        {topic.studied && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}>
                            <Check size={12} className="text-white" strokeWidth={3} />
                          </motion.div>
                        )}
                      </motion.div>
                    </div>
                    <span className="text-sm font-medium text-gray-700 transition-colors group-hover:text-gray-900 dark:text-slate-200 dark:group-hover:text-white">
                      Estudado
                    </span>
                    {topic.studied && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      >
                        Concluido
                      </motion.span>
                    )}
                  </label>

                  <div className="flex items-center gap-1.5">
                    <span className="mr-1 text-xs font-medium text-gray-400 dark:text-slate-500">Prioridade</span>
                    {PRIORITY_OPTIONS.map(priority => {
                      const config = PRIORITY_CONFIG[priority];
                      const selected = topic.priority === priority;
                      return (
                        <motion.button
                          key={priority}
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => onSetPriority(groupId, topic.id, selected ? null : priority)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                            selected
                              ? `${config.bg} ${config.color} shadow-sm ring-1 ring-current/10`
                              : 'bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                          }`}
                        >
                          {config.emoji} {config.label}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-medium ${reviewStatus.className}`}>
                    <Clock size={10} />
                    {topic.fsrsNextReview ? `Revisao: ${new Date(topic.fsrsNextReview + 'T00:00:00').toLocaleDateString('pt-BR')}` : 'Sem revisao'}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-xl bg-purple-50 px-2.5 py-1 text-[11px] font-medium text-purple-600 dark:bg-purple-900/20 dark:text-purple-300">
                    <Sparkles size={10} />
                    {FSRS_VERSION_LABEL[normalizedConfig.version]}
                  </span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-2xl border border-gray-100 p-4 dark:border-slate-800"
              >
                <SectionHeader icon={Hash} title="Tags" />
                <div className="flex flex-wrap items-center gap-1.5">
                  {(topic.tags ?? []).map(tag => (
                    <motion.button
                      key={`modal-tag-${topic.id}-${tag}`}
                      type="button"
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={() => onRemoveTag(groupId, topic.id, tag)}
                      className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-medium transition-all hover:shadow-sm"
                      style={{ backgroundColor: `${subjectColor}12`, color: subjectColor }}
                      title="Remover tag"
                    >
                      #{tag}
                      <X size={10} className="opacity-50 hover:opacity-100" />
                    </motion.button>
                  ))}

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={tagInput}
                      list={tagSuggestionListId}
                      onChange={event => setTagInput(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          if (tagInput.trim()) {
                            onAddTag(groupId, topic.id, tagInput.trim());
                            setTagInput('');
                          }
                        }
                      }}
                      className="w-28 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs placeholder:text-gray-300 transition-shadow focus:outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-600"
                      style={getRingColorStyle(subjectColor)}
                      placeholder="Nova tag..."
                    />
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (tagInput.trim()) {
                          onAddTag(groupId, topic.id, tagInput.trim());
                          setTagInput('');
                        }
                      }}
                      className="rounded-xl p-1.5 text-white shadow-sm transition-shadow hover:shadow-md"
                      style={{ backgroundColor: subjectColor }}
                      title="Adicionar tag"
                    >
                      <ChevronRight size={14} />
                    </motion.button>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1 border-t border-gray-50 pt-2.5 dark:border-slate-800">
                  <span className="mr-1 self-center text-[10px] text-gray-300 dark:text-slate-600">Sugestoes:</span>
                  {COMMON_TAG_PRESETS.map(tag => {
                    const alreadyAdded = (topic.tags ?? []).some(existing => (
                      existing.toLocaleLowerCase('pt-BR') === tag.toLocaleLowerCase('pt-BR')
                    ));
                    return (
                      <motion.button
                        key={`modal-preset-${topic.id}-${tag}`}
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onAddTag(groupId, topic.id, tag)}
                        disabled={alreadyAdded}
                        className="rounded-xl border border-gray-100 px-2 py-0.5 text-[10px] text-gray-400 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-800 dark:text-slate-500 dark:hover:bg-slate-800"
                      >
                        #{tag}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl border border-gray-100 p-4 dark:border-slate-800"
              >
                <SectionHeader icon={Target} title="Dados do Estudo" />
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="flex flex-col">
                    <label className="min-h-4 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500">Questoes</label>
                    <input
                      type="number"
                      min="0"
                      value={topic.questionsTotal || ''}
                      onChange={event => {
                        const nextTotal = parseNonNegativeInt(event.target.value);
                        onUpdateQuestionProgress(groupId, topic.id, nextTotal, Math.min(topic.questionsCorrect, nextTotal));
                      }}
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm transition-shadow focus:outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      style={getRingColorStyle(subjectColor)}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="min-h-4 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500">Acertos</label>
                    <input
                      type="number"
                      min="0"
                      max={topic.questionsTotal}
                      value={topic.questionsCorrect || ''}
                      onChange={event => onUpdateQuestionProgress(
                        groupId,
                        topic.id,
                        topic.questionsTotal,
                        Math.min(parseNonNegativeInt(event.target.value), topic.questionsTotal),
                      )}
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm transition-shadow focus:outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      style={getRingColorStyle(subjectColor)}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="min-h-4 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500">
                      <Calendar size={10} />
                      Estudado em
                    </label>
                    <input
                      type="date"
                      value={topic.dateStudied ? topic.dateStudied.slice(0, 10) : ''}
                      onChange={event => onUpdateTopic(groupId, topic.id, {
                        dateStudied: event.target.value ? new Date(`${event.target.value}T12:00:00`).toISOString() : null,
                        studied: event.target.value ? true : topic.studied,
                      })}
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm transition-shadow focus:outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      style={getRingColorStyle(subjectColor)}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="min-h-4 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500">
                      <AlertCircle size={10} />
                      Prazo
                    </label>
                    <input
                      type="date"
                      value={topic.deadline || ''}
                      onChange={event => onUpdateTopic(groupId, topic.id, { deadline: event.target.value || null })}
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm transition-shadow focus:outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      style={getRingColorStyle(subjectColor)}
                    />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="overflow-hidden rounded-2xl"
                style={{
                  background: `linear-gradient(135deg, ${subjectColor}08, ${subjectColor}04)`,
                  border: `1px solid ${subjectColor}20`,
                }}
              >
                <div className="p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${subjectColor}15` }}>
                        <TrendingUp size={15} style={{ color: subjectColor }} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-800 dark:text-white">Revisao FSRS</h4>
                        <p className="text-[11px] text-gray-400 dark:text-slate-500">
                          {autoMode ? 'Sugestao baseada no desempenho' : 'Escolha a avaliacao manualmente'}
                        </p>
                      </div>
                    </div>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setAutoMode(prev => !prev)}
                      className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all duration-200"
                      style={autoMode
                        ? { backgroundColor: subjectColor, color: 'white' }
                        : { backgroundColor: 'white', color: subjectColor, border: `1px solid ${subjectColor}30` }}
                    >
                      <Sparkles size={12} />
                      Auto {autoMode ? 'ON' : 'OFF'}
                    </motion.button>
                  </div>

                  {autoMode ? (
                    <div className="space-y-3">
                      {suggestedOption ? (
                        <div
                          className="flex items-center gap-3 rounded-xl p-3.5"
                          style={{ backgroundColor: `${subjectColor}08`, border: `1px solid ${subjectColor}15` }}
                        >
                          <span className="text-2xl">{suggestedOption.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-800 dark:text-white">
                              Sugestao: {suggestedOption.label}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-slate-400">
                              {accuracy !== null && `${formatPercent(accuracy)} de acerto`}
                              {suggestedDeadline && ` | Prox. revisao: ${new Date(suggestedDeadline + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                            </p>
                          </div>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onRunReview(groupId, topic.id, suggestedOption.value)}
                            className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg transition-shadow hover:shadow-xl"
                            style={{ backgroundColor: subjectColor }}
                          >
                            Aplicar
                          </motion.button>
                        </div>
                      ) : (
                        <div className="rounded-xl p-4 text-center" style={{ backgroundColor: `${subjectColor}06` }}>
                          <Award size={24} className="mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            Informe questoes e acertos para usar o modo automatico
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                      {RATING_OPTIONS.map(option => {
                        const nextDate = previewDatesByRating[option.value];
                        return (
                          <motion.button
                            key={option.value}
                            type="button"
                            whileHover={{ scale: 1.04, y: -2 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => onRunReview(groupId, topic.id, option.value)}
                            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br py-3.5 px-3 text-xs font-medium text-white shadow-md transition-all hover:shadow-lg ${ratingGradients[option.value]}`}
                          >
                            <span className="mt-1 block text-sm font-semibold">
                              {option.emoji} {displayRatingLabel[option.value]}
                            </span>
                            {nextDate && (
                              <span className="mt-2 block border-t border-white/20 pt-1.5 text-[10px] opacity-70">
                                {new Date(nextDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl border border-gray-100 p-4 dark:border-slate-800"
              >
                <SectionHeader icon={StickyNote} title="Anotacoes" />
                <textarea
                  value={notesDraft}
                  onChange={event => queueNotesUpdate(event.target.value)}
                  onBlur={event => flushNotesUpdate(event.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm placeholder:text-gray-300 transition-all focus:bg-white focus:outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:bg-slate-900"
                  style={getRingColorStyle(subjectColor)}
                  placeholder="Escreva observacoes sobre este assunto..."
                />
              </motion.div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
