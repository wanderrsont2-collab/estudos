import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Subject, Topic, TopicGroup, Priority, type ReviewEntry } from '../types';
import {
  createTopic, createTopicGroup, getSubjectStats, getGroupStats, generateId,
  getDeadlineInfo, parseStructuredImport, PRIORITY_CONFIG, getAllTopics,
} from '../store';
import {
  getReviewStatus,
  fsrsReview,
  RATING_OPTIONS,
  suggestRatingFromPerformance,
  generateReviewId,
  normalizeFSRSConfig,
  type FSRSConfig,
  type FSRSRating,
  FSRS_VERSION_LABEL,
} from '../fsrs';
import {
  ArrowLeft, Plus, Trash2, Check, X, BookOpen, Edit3, Save,
  ChevronDown, ChevronRight, FolderPlus, Calendar, AlertTriangle,
  Clock, Flag, Brain, Sparkles, Tag,
} from 'lucide-react';

interface SubjectDetailProps {
  subject: Subject;
  globalTagSuggestions: string[];
  fsrsConfig: FSRSConfig;
  onBack: () => void;
  onUpdate: (subject: Subject) => void;
}

type StatusFilter = 'all' | 'studied' | 'pending';
const PRIORITY_OPTIONS: Priority[] = ['alta', 'media', 'baixa'];
const COMMON_TAG_PRESETS = ['dificil', 'medio', 'facil'] as const;

interface StudyPopupState {
  groupId: string;
  topicId: string;
}

function getStartOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isReviewDue(nextReview: string | null): boolean {
  if (!nextReview) return false;
  return new Date(nextReview + 'T00:00:00') <= getStartOfToday();
}

function parseNonNegativeInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
}

function getRingColorStyle(color: string): CSSProperties {
  return { '--tw-ring-color': color } as CSSProperties;
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div
        className="h-3 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${Math.min(value * 100, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function formatPercent(v: number) {
  return `${Math.round(v * 100)}%`;
}

function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function PriorityBadge({ priority, onClick, size = 'sm' }: { priority: Priority | null; onClick?: () => void; size?: 'sm' | 'xs' }) {
  if (!priority) {
    if (!onClick) return null;
    return (
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors ${size === 'xs' ? 'text-[10px]' : 'text-xs'}`}
        title="Definir prioridade"
      >
        <Flag size={size === 'xs' ? 10 : 12} />
        <span>Prioridade</span>
      </button>
    );
  }

  const config = PRIORITY_CONFIG[priority];
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bg} ${config.color} font-medium transition-all hover:opacity-80 ${size === 'xs' ? 'text-[10px]' : 'text-xs'}`}
      title="Alterar prioridade"
    >
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </button>
  );
}

function DeadlineBadge({ deadline, size = 'sm' }: { deadline: string | null; size?: 'sm' | 'xs' }) {
  const info = getDeadlineInfo(deadline);
  if (!info) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${info.className} ${size === 'xs' ? 'text-[10px]' : 'text-xs'}`}>
      {info.urgency === 'overdue' ? <AlertTriangle size={size === 'xs' ? 10 : 12} /> : <Clock size={size === 'xs' ? 10 : 12} />}
      {info.text}
    </span>
  );
}

export function SubjectDetail({ subject, globalTagSuggestions, fsrsConfig, onBack, onUpdate }: SubjectDetailProps) {
  const [newGroupName, setNewGroupName] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const stored = window.localStorage.getItem(`subject_status_filter_${subject.id}`);
    return stored === 'studied' || stored === 'pending' ? stored : 'all';
  });
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>(() => {
    const stored = window.localStorage.getItem(`subject_priority_filter_${subject.id}`);
    return stored === 'alta' || stored === 'media' || stored === 'baixa' ? stored : 'all';
  });
  const [tagFilter, setTagFilter] = useState<string>(() => {
    const stored = window.localStorage.getItem(`subject_tag_filter_${subject.id}`);
    return stored && stored.trim().length > 0 ? stored : 'all';
  });
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicName, setEditTopicName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showStructuredImport, setShowStructuredImport] = useState(false);
  const [structuredImportText, setStructuredImportText] = useState('');
  const [newTopicInputs, setNewTopicInputs] = useState<Record<string, string>>({});
  const [showBulkAdd, setShowBulkAdd] = useState<string | null>(null);
  const [bulkInputs, setBulkInputs] = useState<Record<string, string>>({});
  const [priorityMenuTopic, setPriorityMenuTopic] = useState<string | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [studyPopup, setStudyPopup] = useState<StudyPopupState | null>(null);
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});

  const stats = getSubjectStats(subject);
  const allTopics = getAllTopics(subject);
  const allAvailableTags = useMemo(() => {
    const unique = new Set<string>();
    for (const topic of allTopics) {
      for (const tag of topic.tags ?? []) {
        unique.add(tag);
      }
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [allTopics]);
  const tagSuggestionCatalog = useMemo(() => {
    const unique = new Set<string>(COMMON_TAG_PRESETS);
    for (const tag of globalTagSuggestions) unique.add(tag);
    for (const tag of allAvailableTags) unique.add(tag);
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [allAvailableTags, globalTagSuggestions]);
  const tagSuggestionListId = `subject-tag-suggestions-${subject.id}`;

  function updateTopicGroups(updater: (groups: TopicGroup[]) => TopicGroup[]) {
    onUpdate({
      ...subject,
      topicGroups: updater(subject.topicGroups),
    });
  }

  // ---- Group CRUD ----
  function addGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    updateTopicGroups(groups => [...groups, createTopicGroup(name)]);
    setNewGroupName('');
  }

  function removeGroup(groupId: string) {
    updateTopicGroups(groups => groups.filter(g => g.id !== groupId));
    setDeleteConfirm(null);
  }

  function saveGroupEdit(groupId: string) {
    const name = editGroupName.trim();
    setEditingGroupId(null);
    if (!name) return;
    updateTopicGroups(groups =>
      groups.map(g => (g.id === groupId ? { ...g, name } : g))
    );
  }

  function toggleGroupCollapse(groupId: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  // ---- Topic CRUD ----
  function addTopicToGroup(groupId: string) {
    const name = (newTopicInputs[groupId] || '').trim();
    if (!name) return;
    updateTopicGroups(groups =>
      groups.map(g => (g.id === groupId ? { ...g, topics: [...g.topics, createTopic(name)] } : g))
    );
    setNewTopicInputs(prev => ({ ...prev, [groupId]: '' }));
  }

  function addBulkTopicsToGroup(groupId: string) {
    const lines = Array.from(
      new Set((bulkInputs[groupId] || '').split('\n').map(l => l.trim()).filter(Boolean))
    );
    if (lines.length === 0) return;
    const newTopics = lines.map(name => createTopic(name));
    updateTopicGroups(groups =>
      groups.map(g => (g.id === groupId ? { ...g, topics: [...g.topics, ...newTopics] } : g))
    );
    setBulkInputs(prev => ({ ...prev, [groupId]: '' }));
    setShowBulkAdd(null);
  }

  function removeTopic(groupId: string, topicId: string) {
    updateTopicGroups(groups =>
      groups.map(g => (g.id === groupId ? { ...g, topics: g.topics.filter(t => t.id !== topicId) } : g))
    );
    setDeleteConfirm(null);
  }

  function updateTopicInGroup(groupId: string, topicId: string, changes: Partial<Topic>) {
    updateTopicGroups(groups =>
      groups.map(g =>
        g.id === groupId
          ? { ...g, topics: g.topics.map(t => (t.id === topicId ? { ...t, ...changes } : t)) }
          : g
      )
    );
  }

  function findTopic(groupId: string, topicId: string): Topic | null {
    const group = subject.topicGroups.find(g => g.id === groupId);
    const topic = group?.topics.find(t => t.id === topicId);
    return topic ?? null;
  }

  function setTopicStudied(groupId: string, topicId: string, studied: boolean) {
    const topic = findTopic(groupId, topicId);
    if (!topic) return;
    updateTopicInGroup(groupId, topicId, {
      studied,
      dateStudied: studied ? topic.dateStudied ?? new Date().toISOString() : null,
    });
  }

  function openStudyPopup(groupId: string, topicId: string) {
    setStudyPopup({ groupId, topicId });
  }

  function toggleTopicExpanded(topicId: string) {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  }

  function runTopicReview(groupId: string, topicId: string, rating: FSRSRating) {
    const topic = findTopic(groupId, topicId);
    if (!topic) return;

    const normalizedFsrsConfig = normalizeFSRSConfig(fsrsConfig);
    const currentState = {
      difficulty: topic.fsrsDifficulty,
      stability: topic.fsrsStability,
      lastReview: topic.fsrsLastReview,
      nextReview: topic.fsrsNextReview,
    };

    const { newState, intervalDays, retrievability } = fsrsReview(currentState, rating, normalizedFsrsConfig);
    const ratingOption = RATING_OPTIONS.find(option => option.value === rating);

    if (!ratingOption) return;

    const performanceScore = topic.questionsTotal > 0
      ? topic.questionsCorrect / topic.questionsTotal
      : null;

    const reviewEntry: ReviewEntry = {
      id: generateReviewId(),
      reviewNumber: topic.reviewHistory.length + 1,
      date: toDateOnlyString(new Date()),
      rating,
      ratingLabel: ratingOption.label,
      difficultyBefore: currentState.difficulty,
      difficultyAfter: newState.difficulty,
      stabilityBefore: currentState.stability,
      stabilityAfter: newState.stability,
      intervalDays,
      retrievability,
      performanceScore,
      questionsTotal: topic.questionsTotal,
      questionsCorrect: topic.questionsCorrect,
      algorithmVersion: normalizedFsrsConfig.version,
      requestedRetention: normalizedFsrsConfig.requestedRetention,
      usedCustomWeights: normalizedFsrsConfig.customWeights !== null,
    };

    updateTopicInGroup(groupId, topicId, {
      studied: true,
      dateStudied: topic.dateStudied ?? new Date().toISOString(),
      fsrsDifficulty: newState.difficulty,
      fsrsStability: newState.stability,
      fsrsLastReview: newState.lastReview,
      fsrsNextReview: newState.nextReview,
      deadline: newState.nextReview ?? topic.deadline,
      reviewHistory: [...topic.reviewHistory, reviewEntry],
    });
  }

  function setPriority(groupId: string, topicId: string, priority: Priority | null) {
    updateTopicInGroup(groupId, topicId, { priority });
    setPriorityMenuTopic(null);
  }

  function updateTopicQuestionProgress(groupId: string, topicId: string, nextTotal: number, nextCorrect: number) {
    const topic = findTopic(groupId, topicId);
    if (!topic) return;

    const safeTotal = Math.max(0, nextTotal);
    const safeCorrect = Math.max(0, Math.min(safeTotal, nextCorrect));
    const deltaMade = Math.max(0, safeTotal - topic.questionsTotal);
    const deltaCorrect = Math.max(0, safeCorrect - topic.questionsCorrect);
    const today = toDateOnlyString(new Date());
    const nextLogs = [...(topic.questionLogs ?? [])];

    if (deltaMade > 0 || deltaCorrect > 0) {
      const existingLogIdx = nextLogs.findIndex(log => log.date === today);
      if (existingLogIdx >= 0) {
        const existing = nextLogs[existingLogIdx];
        nextLogs[existingLogIdx] = {
          ...existing,
          questionsMade: existing.questionsMade + deltaMade,
          questionsCorrect: existing.questionsCorrect + deltaCorrect,
        };
      } else {
        nextLogs.push({
          date: today,
          questionsMade: deltaMade,
          questionsCorrect: deltaCorrect,
        });
      }
    }

    updateTopicInGroup(groupId, topicId, {
      questionsTotal: safeTotal,
      questionsCorrect: safeCorrect,
      questionLogs: nextLogs,
    });
  }

  function normalizeTag(tag: string): string {
    return tag.replace(/\s+/g, ' ').trim();
  }

  function addTagToTopic(groupId: string, topicId: string, rawTag: string) {
    const normalized = normalizeTag(rawTag);
    if (!normalized) return;
    const topic = findTopic(groupId, topicId);
    if (!topic) return;
    const existingTags = topic.tags ?? [];
    const exists = existingTags.some(tag => tag.toLocaleLowerCase('pt-BR') === normalized.toLocaleLowerCase('pt-BR'));
    if (exists) return;
    updateTopicInGroup(groupId, topicId, {
      tags: [...existingTags, normalized].slice(0, 12),
    });
    setTagInputs(prev => ({ ...prev, [topicId]: '' }));
  }

  function removeTagFromTopic(groupId: string, topicId: string, tagToRemove: string) {
    const topic = findTopic(groupId, topicId);
    if (!topic) return;
    updateTopicInGroup(groupId, topicId, {
      tags: (topic.tags ?? []).filter(tag => tag !== tagToRemove),
    });
  }

  function startTopicEdit(topic: Topic) {
    setEditingTopicId(topic.id);
    setEditTopicName(topic.name);
  }

  function saveTopicEdit(groupId: string, topicId: string) {
    const trimmedName = editTopicName.trim();
    if (trimmedName) {
      updateTopicInGroup(groupId, topicId, { name: trimmedName });
    }
    setEditingTopicId(null);
  }

  function cancelTopicEdit() {
    setEditingTopicId(null);
  }

  function handleStructuredImport() {
    const groups = parseStructuredImport(structuredImportText);
    if (groups.length === 0) return;
    const newGroups: TopicGroup[] = groups.map(g => ({
      id: generateId(),
      name: g.name,
      topics: g.topics.map(name => createTopic(name)),
    }));
    updateTopicGroups(existing => [...existing, ...newGroups]);
    setStructuredImportText('');
    setShowStructuredImport(false);
  }

  // ---- Filtering ----
  function filterTopics(topics: Topic[]): Topic[] {
    return topics.filter(t => {
      if (statusFilter === 'studied' && !t.studied) return false;
      if (statusFilter === 'pending' && t.studied) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (tagFilter !== 'all') {
        const tags = t.tags ?? [];
        if (!tags.some(tag => tag.toLocaleLowerCase('pt-BR') === tagFilter.toLocaleLowerCase('pt-BR'))) return false;
      }
      return true;
    });
  }

  // ---- Stats ----
  const pendingHighPriority = allTopics.filter(t => !t.studied && t.priority === 'alta').length;
  const overdueCount = allTopics.filter(t => {
    if (!t.deadline || t.studied) return false;
    const info = getDeadlineInfo(t.deadline);
    return info?.urgency === 'overdue';
  }).length;
  const reviewsDueCount = allTopics.filter(t => isReviewDue(t.fsrsNextReview)).length;
  const pendingTopicsCount = allTopics.filter(t => !t.studied).length;

  useEffect(() => {
    window.localStorage.setItem(`subject_status_filter_${subject.id}`, statusFilter);
  }, [statusFilter, subject.id]);

  useEffect(() => {
    window.localStorage.setItem(`subject_priority_filter_${subject.id}`, priorityFilter);
  }, [priorityFilter, subject.id]);

  useEffect(() => {
    window.localStorage.setItem(`subject_tag_filter_${subject.id}`, tagFilter);
  }, [tagFilter, subject.id]);

  useEffect(() => {
    const statusStored = window.localStorage.getItem(`subject_status_filter_${subject.id}`);
    setStatusFilter(statusStored === 'studied' || statusStored === 'pending' ? statusStored : 'all');

    const priorityStored = window.localStorage.getItem(`subject_priority_filter_${subject.id}`);
    setPriorityFilter(priorityStored === 'alta' || priorityStored === 'media' || priorityStored === 'baixa' ? priorityStored : 'all');

    const tagStored = window.localStorage.getItem(`subject_tag_filter_${subject.id}`);
    setTagFilter(tagStored && tagStored.trim().length > 0 ? tagStored : 'all');
  }, [subject.id]);

  useEffect(() => {
    if (tagFilter === 'all') return;
    if (allAvailableTags.includes(tagFilter)) return;
    setTagFilter('all');
  }, [allAvailableTags, tagFilter]);

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <datalist id={tagSuggestionListId}>
        {tagSuggestionCatalog.map(tag => (
          <option key={`tag-suggestion-${tag}`} value={tag} />
        ))}
      </datalist>
      {/* Header */}
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
          <p className="text-white/70 mt-1 text-sm">
            Gerencie topicos, assuntos, prioridades, prazos e revisoes
          </p>
          {/* Alerts */}
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: '\u{1F4DA} Estudados', value: stats.studied },
          { label: '\u{1F4CB} Total', value: stats.total },
          { label: '\u{1F4C1} Topicos', value: subject.topicGroups.length },
          { label: '\u{1F4DD} Questoes', value: stats.questionsTotal },
          { label: '\u{1F4CA} Rendimento', value: formatPercent(stats.rendimento) },
          { label: '\u{1F9E0} Revisoes', value: stats.reviewsDue > 0 ? `${stats.reviewsDue} \u{1F514}` : '0' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-xs text-gray-500 font-medium mb-1">{card.label}</p>
            <p className="text-2xl font-bold" style={{ color: subject.color }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-600">Progresso Geral</span>
          <span className="text-sm font-bold" style={{ color: subject.color }}>{formatPercent(stats.progresso)}</span>
        </div>
        <ProgressBar value={stats.progresso} color={subject.color} />
        <p className="text-xs text-gray-400 mt-2 text-center italic">
          {stats.studied} de {stats.total} conteudos estudados
        </p>
      </div>

      {/* Add Topic Group */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <FolderPlus size={18} style={{ color: subject.color }} />
          Adicionar Topico
        </h3>
        <p className="text-xs text-gray-500">
          Crie topicos para organizar seus assuntos (ex: "Matematica Basica", "Geometria", "Algebra")
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addGroup()}
            placeholder='Nome do topico (ex: "Matematica Basica")'
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
            style={getRingColorStyle(subject.color)}
          />
          <button
            onClick={addGroup}
            className="px-5 py-2.5 rounded-lg text-white font-medium text-sm hover:opacity-90 transition-opacity shrink-0 flex items-center gap-2"
            style={{ backgroundColor: subject.color }}
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Criar</span>
          </button>
        </div>

        {/* Structured Import */}
        <button
          onClick={() => setShowStructuredImport(!showStructuredImport)}
          className="text-sm hover:underline transition-colors flex items-center gap-1"
          style={{ color: subject.color }}
        >
          {showStructuredImport ? 'Fechar importacao' : '\u{1F4CB} Importar estrutura completa (topicos + assuntos)'}
        </button>

        {showStructuredImport && (
          <div className="space-y-2 bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-600">
              Use <code className="bg-gray-200 px-1 rounded">#</code> para criar topicos e linhas simples para assuntos:
            </p>
            <textarea
              value={structuredImportText}
              onChange={e => setStructuredImportText(e.target.value)}
              placeholder={`# Matematica Basica\nQuatro operacoes\nFracoes\nPotenciacao\n\n# Geometria\nAreas\nVolumes\nTriangulos`}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent h-40 resize-y font-mono"
              style={getRingColorStyle(subject.color)}
            />
            <button
              onClick={handleStructuredImport}
              className="px-5 py-2.5 rounded-lg text-white font-medium text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
              style={{ backgroundColor: subject.color }}
            >
              <Plus size={16} /> Importar Tudo
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      {allTopics.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mr-1">Status:</span>
          {[
            { key: 'all' as const, label: `Todos (${allTopics.length})` },
            { key: 'pending' as const, label: `Pendentes (${pendingTopicsCount})` },
            { key: 'studied' as const, label: `Estudados (${stats.studied})` },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === f.key
                  ? 'text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={statusFilter === f.key ? { backgroundColor: subject.color } : undefined}
            >
              {f.label}
            </button>
          ))}

          <span className="text-gray-300 mx-1">|</span>

          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mr-1">Prioridade:</span>
          <button
            onClick={() => setPriorityFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              priorityFilter === 'all' ? 'text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={priorityFilter === 'all' ? { backgroundColor: subject.color } : undefined}
          >
            Todas
          </button>
          {PRIORITY_OPTIONS.map(p => {
            const config = PRIORITY_CONFIG[p];
            return (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  priorityFilter === p
                    ? `${config.bg} ${config.color} ring-2 ${config.ring}`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {config.emoji} {config.label}
              </button>
            );
          })}

          <span className="text-gray-300 mx-1">|</span>

          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mr-1 inline-flex items-center gap-1">
            <Tag size={12} /> Tag:
          </span>
          <select
            value={tagFilter}
            onChange={event => setTagFilter(event.target.value)}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
          >
            <option value="all">Todas</option>
            {allAvailableTags.map(tag => (
              <option key={tag} value={tag}>#{tag}</option>
            ))}
          </select>
        </div>
      )}

      {/* Topic Groups */}
      {subject.topicGroups.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <FolderPlus size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium mb-1">Nenhum topico criado ainda</p>
          <p className="text-gray-400 text-sm">
            Crie topicos acima para organizar seus assuntos de estudo.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {subject.topicGroups.map((group) => {
            const filtered = filterTopics(group.topics);
            const groupStats = getGroupStats(group);
            const isCollapsed = collapsedGroups.has(group.id);
            const hasActiveFilter = statusFilter !== 'all' || priorityFilter !== 'all' || tagFilter !== 'all';
            const hasFilteredContent = filtered.length > 0 || !hasActiveFilter;

            if (!hasFilteredContent && group.topics.length > 0) return null;

            return (
              <div key={group.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
                {/* Group Header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{ borderLeft: `4px solid ${subject.color}` }}
                  onClick={() => toggleGroupCollapse(group.id)}
                >
                  <button className="text-gray-400 shrink-0">
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                  </button>

                  {editingGroupId === group.id ? (
                    <div className="flex-1 flex gap-2 items-center" onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editGroupName}
                        onChange={e => setEditGroupName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveGroupEdit(group.id); if (e.key === 'Escape') setEditingGroupId(null); }}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
                        style={getRingColorStyle(subject.color)}
                        autoFocus
                      />
                      <button onClick={() => saveGroupEdit(group.id)} className="text-green-600 hover:text-green-700"><Save size={16} /></button>
                      <button onClick={() => setEditingGroupId(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-800">{"\u{1F4C1}"} {group.name}</span>
                          <span className="text-xs text-gray-400">
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
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium flex items-center gap-1">
                              <Brain size={10} /> {groupStats.reviewsDue} revisoes
                            </span>
                          )}
                        </div>
                        {groupStats.total > 0 && (
                          <div className="mt-1.5 max-w-xs">
                            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${groupStats.progresso * 100}%`, backgroundColor: subject.color }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Group Actions */}
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => { setEditingGroupId(group.id); setEditGroupName(group.name); }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
                          title="Renomear topico"
                        >
                          <Edit3 size={14} />
                        </button>
                        {deleteConfirm === `group-${group.id}` ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => removeGroup(group.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Check size={14} /></button>
                            <button onClick={() => setDeleteConfirm(null)} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg"><X size={14} /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(`group-${group.id}`)}
                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                            title="Excluir topico"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Group Content (when expanded) */}
                {!isCollapsed && (
                  <div className="border-t border-gray-100">
                    {/* Add topic to group */}
                    <div className="px-4 py-3 bg-gray-50/50 dark:bg-slate-900/60 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newTopicInputs[group.id] || ''}
                          onChange={e => setNewTopicInputs(prev => ({ ...prev, [group.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && addTopicToGroup(group.id)}
                          placeholder="Adicionar assunto..."
                          className="flex-1 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-white dark:bg-slate-950 dark:text-slate-100"
                          style={getRingColorStyle(subject.color)}
                        />
                        <button
                          onClick={() => addTopicToGroup(group.id)}
                          className="px-3 py-2 rounded-lg text-white text-sm hover:opacity-90 transition-opacity shrink-0"
                          style={{ backgroundColor: subject.color }}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <button
                        onClick={() => setShowBulkAdd(showBulkAdd === group.id ? null : group.id)}
                        className="text-xs hover:underline transition-colors"
                        style={{ color: subject.color }}
                      >
                        {showBulkAdd === group.id ? 'Fechar' : '\u{1F4CB} Adicionar varios assuntos'}
                      </button>
                      {showBulkAdd === group.id && (
                        <div className="space-y-2">
                          <textarea
                            value={bulkInputs[group.id] || ''}
                            onChange={e => setBulkInputs(prev => ({ ...prev, [group.id]: e.target.value }))}
                            placeholder={"Um assunto por linha:\nQuatro operacoes\nFracoes\nPotenciacao"}
                            className="w-full border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent h-28 resize-y bg-white dark:bg-slate-950 dark:text-slate-100"
                            style={getRingColorStyle(subject.color)}
                          />
                          <button
                            onClick={() => addBulkTopicsToGroup(group.id)}
                            className="px-4 py-2 rounded-lg text-white text-sm hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: subject.color }}
                          >
                            Adicionar Todos
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Topics List */}
                    {filtered.length === 0 && group.topics.length > 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-400">
                        Nenhum assunto corresponde ao filtro selecionado.
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-400">
                        <BookOpen size={24} className="mx-auto mb-2 text-gray-300" />
                        Nenhum assunto adicionado neste topico ainda.
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
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
                            onToggleExpanded={toggleTopicExpanded}
                            onOpenStudyPopup={openStudyPopup}
                            onUpdateTopic={updateTopicInGroup}
                            onUpdateQuestionProgress={updateTopicQuestionProgress}
                            onRemoveTopic={removeTopic}
                            onStartEdit={startTopicEdit}
                            onSaveEdit={saveTopicEdit}
                            onCancelEdit={cancelTopicEdit}
                            onSetEditName={setEditTopicName}
                            onSetDeleteConfirm={setDeleteConfirm}
                            onSetPriority={setPriority}
                            onTogglePriorityMenu={setPriorityMenuTopic}
                            tagDraft={tagInputs[topic.id] || ''}
                            tagSuggestionListId={tagSuggestionListId}
                            onTagDraftChange={(value) => setTagInputs(prev => ({ ...prev, [topic.id]: value }))}
                            onAddTag={addTagToTopic}
                            onRemoveTag={removeTagFromTopic}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {studyPopup && (
        <TopicStudyModal
          key={`${studyPopup.groupId}-${studyPopup.topicId}`}
          topic={findTopic(studyPopup.groupId, studyPopup.topicId)}
          groupId={studyPopup.groupId}
          subjectColor={subject.color}
          fsrsConfig={fsrsConfig}
          onClose={() => setStudyPopup(null)}
          onUpdateTopic={updateTopicInGroup}
          onUpdateQuestionProgress={updateTopicQuestionProgress}
          onSetStudied={setTopicStudied}
          onRunReview={runTopicReview}
          onSetPriority={setPriority}
          onAddTag={addTagToTopic}
          onRemoveTag={removeTagFromTopic}
          tagSuggestionListId={tagSuggestionListId}
        />
      )}

      {/* Summary */}
      {allTopics.length > 0 && (
        <div
          className="rounded-xl p-4 text-white text-center text-sm font-medium"
          style={{ backgroundColor: subject.color }}
        >
          {stats.studied} de {stats.total} conteudos estudados | {stats.questionsTotal} questoes feitas | {formatPercent(stats.rendimento)} de rendimento
          {stats.reviewsDue > 0 && ` | \u{1F9E0} ${stats.reviewsDue} revisoes pendentes`}
        </div>
      )}
    </div>
  );
}

// ---- TopicRow sub-component ----
interface TopicRowProps {
  topic: Topic;
  groupId: string;
  subjectColor: string;
  editingTopicId: string | null;
  editTopicName: string;
  deleteConfirm: string | null;
  priorityMenuTopic: string | null;
  isExpanded: boolean;
  onToggleExpanded: (topicId: string) => void;
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
  onTagDraftChange: (value: string) => void;
  onAddTag: (groupId: string, topicId: string, tag: string) => void;
  onRemoveTag: (groupId: string, topicId: string, tag: string) => void;
}

function TopicRow({
  topic, groupId, subjectColor,
  editingTopicId, editTopicName, deleteConfirm, priorityMenuTopic,
  isExpanded, onToggleExpanded, onOpenStudyPopup, onUpdateTopic, onRemoveTopic,
  onUpdateQuestionProgress,
  onStartEdit, onSaveEdit, onCancelEdit, onSetEditName,
  onSetDeleteConfirm, onSetPriority, onTogglePriorityMenu,
  tagDraft, tagSuggestionListId, onTagDraftChange, onAddTag, onRemoveTag,
}: TopicRowProps) {
  const isEditing = editingTopicId === topic.id;
  const detailsVisible = isExpanded || isEditing;
  const showPriorityMenu = priorityMenuTopic === topic.id;
  const priorityAnchorRef = useRef<HTMLDivElement | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const [priorityMenuPosition, setPriorityMenuPosition] = useState<'up' | 'down'>('down');
  const reviewStatus = getReviewStatus(topic.fsrsNextReview);
  const isDue = isReviewDue(topic.fsrsNextReview);
  const accuracy = topic.questionsTotal > 0 ? topic.questionsCorrect / topic.questionsTotal : 0;
  const nextReviewDate = topic.fsrsNextReview
    ? new Date(topic.fsrsNextReview + 'T00:00:00').toLocaleDateString('pt-BR')
    : null;

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

  function insertListPrefix(prefix: string) {
    const currentNotes = topic.notes ?? '';
    const textarea = notesRef.current;

    if (!textarea) {
      const needsBreak = currentNotes.length > 0 && !currentNotes.endsWith('\n');
      onUpdateTopic(groupId, topic.id, { notes: `${currentNotes}${needsBreak ? '\n' : ''}${prefix}` });
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

    onUpdateTopic(groupId, topic.id, { notes: nextNotes });
    requestAnimationFrame(() => {
      const target = notesRef.current;
      if (!target) return;
      target.focus();
      target.setSelectionRange(nextCaretPos, nextCaretPos);
    });
  }

  return (
    <div className={`px-4 py-3 transition-all hover:bg-gray-50/50 dark:hover:bg-slate-800/40 ${isDue ? 'border-l-2 border-l-purple-400' : ''}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onOpenStudyPopup(groupId, topic.id)}
                className={`mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
            topic.studied
              ? 'bg-slate-600 border-slate-600 text-white'
              : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-400'
          }`}
          title="Abrir painel rapido do assunto"
        >
          {topic.studied && <Check size={14} />}
        </button>

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
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => onToggleExpanded(topic.id)}
                className="p-1 rounded-md text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                title={detailsVisible ? 'Ocultar detalhes' : 'Mostrar detalhes'}
              >
                {detailsVisible ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <span className={`font-medium text-sm ${topic.studied ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-800 dark:text-slate-100'}`}>
                {topic.name}
              </span>
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

              <div className="relative" ref={priorityAnchorRef}>
                <PriorityBadge
                  priority={topic.priority}
                  onClick={() => onTogglePriorityMenu(showPriorityMenu ? null : topic.id)}
                  size="xs"
                />
                {showPriorityMenu && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => onTogglePriorityMenu(null)} />
                    <div
                      className={`absolute left-0 z-30 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[130px] ${
                        priorityMenuPosition === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
                      }`}
                    >
                      {PRIORITY_OPTIONS.map(p => {
                        const config = PRIORITY_CONFIG[p];
                        return (
                          <button
                            key={p}
                            onClick={() => onSetPriority(groupId, topic.id, p)}
                            className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 flex items-center gap-2 ${
                              topic.priority === p ? 'font-bold' : ''
                            }`}
                          >
                            <span>{config.emoji}</span>
                            <span>{config.label}</span>
                            {topic.priority === p && <Check size={12} className="ml-auto text-green-600" />}
                          </button>
                        );
                      })}
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button
                          onClick={() => onSetPriority(groupId, topic.id, null)}
                          className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 text-gray-500"
                        >
                          Remover prioridade
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

            </div>
          )}

          {detailsVisible && (
            <>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
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
                        onChange={event => onTagDraftChange(event.target.value)}
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
                    value={topic.notes}
                    onChange={e => onUpdateTopic(groupId, topic.id, { notes: e.target.value })}
                    placeholder="Escreva observacoes, passos, checklists e resumos..."
                    className="mt-1 w-full min-h-[96px] border border-gray-200 dark:border-slate-700 rounded-md px-2 py-2 text-xs text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 bg-white dark:bg-slate-950 placeholder-slate-400 resize-y"
                    style={getRingColorStyle(subjectColor)}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                  <Brain size={12} className="text-purple-500" />
                  <span>{topic.reviewHistory.length > 0 ? `Rev. ${topic.reviewHistory.length} - ${reviewStatus.text}` : 'Sem revisoes FSRS ainda'}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onStartEdit(topic)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
                    title="Editar nome"
                  >
                    <Edit3 size={14} />
                  </button>
                  {deleteConfirm === `topic-${topic.id}` ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => onRemoveTopic(groupId, topic.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Check size={14} /></button>
                      <button onClick={() => onSetDeleteConfirm(null)} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg"><X size={14} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onSetDeleteConfirm(`topic-${topic.id}`)}
                      className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
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
}

interface TopicStudyModalProps {
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

function TopicStudyModal({
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
  const previewNextReviewDate = (rating: FSRSRating): string | null =>
    fsrsReview(currentState, rating, normalizedConfig).newState.nextReview;
  const suggestedDeadline = suggestedOption ? previewNextReviewDate(suggestedOption.value) : null;
  const reviewStatus = getReviewStatus(topic.fsrsNextReview);
  const accuracy = topic.questionsTotal > 0 ? topic.questionsCorrect / topic.questionsTotal : null;

  return (
    <div className="fixed inset-0 z-40 bg-black/40 p-4 flex items-center justify-center" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-gray-200"
        onClick={event => event.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-800">{topic.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Painel rapido para estudo, desempenho e revisao FSRS.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={topic.studied}
                onChange={event => onSetStudied(groupId, topic.id, event.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-400"
              />
              Marcar como estudado
            </label>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Prioridade:</span>
              {PRIORITY_OPTIONS.map(priority => {
                const config = PRIORITY_CONFIG[priority];
                const selected = topic.priority === priority;
                return (
                  <button
                    key={priority}
                    onClick={() => onSetPriority(groupId, topic.id, selected ? null : priority)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      selected ? `${config.bg} ${config.color}` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {config.emoji} {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Tags</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {(topic.tags ?? []).map(tag => (
                <button
                  key={`modal-tag-${topic.id}-${tag}`}
                  onClick={() => onRemoveTag(groupId, topic.id, tag)}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[11px] hover:bg-slate-200"
                  title="Remover tag"
                >
                  #{tag} <X size={10} />
                </button>
              ))}
              <input
                type="text"
                value={tagInput}
                list={tagSuggestionListId}
                onChange={event => setTagInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onAddTag(groupId, topic.id, tagInput);
                    setTagInput('');
                  }
                }}
                className="w-36 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2"
                style={getRingColorStyle(subjectColor)}
                placeholder="Nova tag"
              />
              <button
                onClick={() => {
                  onAddTag(groupId, topic.id, tagInput);
                  setTagInput('');
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs text-white hover:opacity-90"
                style={{ backgroundColor: subjectColor }}
              >
                Adicionar
              </button>
              {COMMON_TAG_PRESETS.map(tag => {
                const alreadyAdded = (topic.tags ?? []).some(existing => (
                  existing.toLocaleLowerCase('pt-BR') === tag.toLocaleLowerCase('pt-BR')
                ));
                return (
                  <button
                    key={`modal-preset-${topic.id}-${tag}`}
                    onClick={() => onAddTag(groupId, topic.id, tag)}
                    disabled={alreadyAdded}
                    className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-400">Questoes</label>
              <input
                type="number"
                min="0"
                value={topic.questionsTotal || ''}
                onChange={event => {
                  const nextTotal = parseNonNegativeInt(event.target.value);
                  onUpdateQuestionProgress(groupId, topic.id, nextTotal, Math.min(topic.questionsCorrect, nextTotal));
                }}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={getRingColorStyle(subjectColor)}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-400">Acertos</label>
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
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={getRingColorStyle(subjectColor)}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-400">Data de estudo</label>
              <input
                type="date"
                value={topic.dateStudied ? topic.dateStudied.slice(0, 10) : ''}
                onChange={event => onUpdateTopic(groupId, topic.id, {
                  dateStudied: event.target.value ? new Date(`${event.target.value}T12:00:00`).toISOString() : null,
                  studied: event.target.value ? true : topic.studied,
                })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={getRingColorStyle(subjectColor)}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-400">Prazo</label>
              <input
                type="date"
                value={topic.deadline || ''}
                onChange={event => onUpdateTopic(groupId, topic.id, { deadline: event.target.value || null })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={getRingColorStyle(subjectColor)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {accuracy !== null && (
              <span className={`px-2 py-0.5 rounded-full font-medium ${
                accuracy >= 0.7
                  ? 'bg-green-100 text-green-700'
                  : accuracy >= 0.5
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                Rendimento: {formatPercent(accuracy)}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full font-medium ${reviewStatus.className}`}>
              {topic.fsrsNextReview ? `Prox. revisao: ${new Date(topic.fsrsNextReview + 'T00:00:00').toLocaleDateString('pt-BR')}` : 'Sem revisao agendada'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
              {FSRS_VERSION_LABEL[normalizedConfig.version]}
            </span>
          </div>

          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-purple-800">Sistema de revisao FSRS</h4>
                <p className="text-xs text-purple-600">Use Auto para sugerir dificuldade com base no seu desempenho.</p>
              </div>
              <button
                onClick={() => setAutoMode(prev => !prev)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1 ${
                  autoMode ? 'bg-purple-700 text-white hover:bg-purple-800' : 'bg-white text-purple-700 hover:bg-purple-100'
                }`}
              >
                <Sparkles size={12} />
                Auto {autoMode ? 'ON' : 'OFF'}
              </button>
            </div>

            {autoMode ? (
              <div className="mt-3 space-y-2">
                {suggestedOption ? (
                  <>
                    <p className="text-xs text-purple-700 bg-purple-100 rounded-lg px-3 py-2">
                      Sugestao automatica: {suggestedOption.emoji} {suggestedOption.label}
                      {accuracy !== null && ` (${formatPercent(accuracy)} de acerto)`}
                      {suggestedDeadline && ` | Prazo sugerido: ${new Date(suggestedDeadline + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                    </p>
                    <button
                      onClick={() => onRunReview(groupId, topic.id, suggestedOption.value)}
                      className="px-3 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: subjectColor }}
                    >
                      Aplicar Auto
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-purple-700 bg-purple-100 rounded-lg px-3 py-2">
                    Para usar Auto, informe quantidade de questoes e acertos.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-xs text-purple-700 mb-2">Modo manual: escolha a avaliacao da revisao.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {RATING_OPTIONS.map(option => {
                    const nextDate = previewNextReviewDate(option.value);
                    return (
                      <button
                        key={option.value}
                        onClick={() => onRunReview(groupId, topic.id, option.value)}
                        className={`py-2 px-2 rounded-lg text-white font-medium text-xs transition-all hover:scale-105 ${option.color} ${option.hoverColor}`}
                      >
                        <span className="text-base block">{option.emoji}</span>
                        <span className="block mt-0.5">{option.label}</span>
                        {nextDate && (
                          <span className="block mt-1 text-[10px] opacity-90">
                            {new Date(nextDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-gray-400">Anotacoes</label>
            <textarea
              value={topic.notes}
              onChange={event => onUpdateTopic(groupId, topic.id, { notes: event.target.value })}
              rows={3}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={getRingColorStyle(subjectColor)}
              placeholder="Observacoes deste assunto..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

