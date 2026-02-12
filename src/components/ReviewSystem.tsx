import { memo, useEffect, useMemo, useState } from 'react';
import { Subject, Topic, ReviewEntry } from '../types';
import {
  fsrsReview, RATING_OPTIONS, suggestRatingFromPerformance,
  getReviewStatus, getDifficultyLabel, generateReviewId, daysUntilReview,
  FSRSRating, calculateRetrievabilityWithConfig, type FSRSConfig,
  type FSRSState,
  type FSRSVersion, FSRS_VERSION_LABEL, getExpectedWeightCount,
  getDefaultWeights, normalizeFSRSConfig,
} from '../fsrs';
import {
  getReviewsDue, getUpcomingReviews, getAllTopics,
} from '../store';
import {
  Brain, TrendingUp, ChevronDown, ChevronRight,
  History, Zap, BarChart3, ArrowRight, RotateCcw,
  Calendar, Star, AlertTriangle, Filter, Search, X,
} from 'lucide-react';

interface ReviewSystemProps {
  subjects: Subject[];
  fsrsConfig: FSRSConfig;
  onUpdateFsrsConfig: (config: FSRSConfig) => void;
  onUpdateSubject: (subject: Subject) => void;
  onNavigateToSubject: (subjectId: string) => void;
}

const VISIBLE_COUNT_OPTIONS = [10, 20, 30] as const;
type VisibleCount = (typeof VISIBLE_COUNT_OPTIONS)[number];
type PriorityFilter = 'all' | 'alta' | 'media' | 'baixa' | 'none';
type DueUrgencyFilter = 'all' | 'overdue' | 'today';

interface TopicFilterConfig {
  subjectFilter: string;
  priorityFilter: PriorityFilter;
  tagFilter: string;
  searchTokens: string[];
}

function formatPercent(v: number) {
  return `${Math.round(v * 100)}%`;
}

function formatDate(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function parseNonNegativeInt(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseWeightsInput(raw: string): number[] {
  return raw
    .split(/[,\s]+/)
    .map(v => v.trim())
    .filter(Boolean)
    .map(Number)
    .filter(n => Number.isFinite(n));
}

function formatWeightsForInput(weights: readonly number[]): string {
  return weights.map(w => Number(w).toString()).join(', ');
}

function readVisibleCount(key: string): VisibleCount {
  if (typeof window === 'undefined') return VISIBLE_COUNT_OPTIONS[0];
  const stored = Number(window.localStorage.getItem(key));
  return VISIBLE_COUNT_OPTIONS.includes(stored as VisibleCount)
    ? (stored as VisibleCount)
    : VISIBLE_COUNT_OPTIONS[0];
}

function topicMatchesFilters(
  topic: Topic,
  context: {
    subjectId: string;
    subjectName: string;
    groupName: string;
  },
  filters: TopicFilterConfig,
) {
  if (filters.subjectFilter !== 'all' && context.subjectId !== filters.subjectFilter) return false;
  if (filters.priorityFilter !== 'all') {
    if (filters.priorityFilter === 'none' && topic.priority !== null) return false;
    if (filters.priorityFilter !== 'none' && topic.priority !== filters.priorityFilter) return false;
  }
  if (filters.tagFilter !== 'all' && !(topic.tags ?? []).includes(filters.tagFilter)) return false;
  if (filters.searchTokens.length === 0) return true;

  const haystack = [
    topic.name,
    topic.notes,
    topic.priority ?? '',
    context.subjectName,
    context.groupName,
    (topic.tags ?? []).join(' '),
    topic.fsrsNextReview ?? '',
  ]
    .join(' ')
    .toLocaleLowerCase('pt-BR');

  return filters.searchTokens.every(token => haystack.includes(token));
}

function createReviewEntry(params: {
  topic: Topic;
  rating: FSRSRating;
  currentState: FSRSState;
  newState: FSRSState;
  intervalDays: number;
  retrievability: number | null;
  fsrsConfig: FSRSConfig;
}): ReviewEntry {
  const ratingOption = RATING_OPTIONS.find(r => r.value === params.rating)!;
  const performanceScore = params.topic.questionsTotal > 0
    ? params.topic.questionsCorrect / params.topic.questionsTotal
    : null;

  return {
    id: generateReviewId(),
    reviewNumber: params.topic.reviewHistory.length + 1,
    date: toDateOnlyString(new Date()),
    rating: params.rating,
    ratingLabel: ratingOption.label,
    difficultyBefore: params.currentState.difficulty,
    difficultyAfter: params.newState.difficulty,
    stabilityBefore: params.currentState.stability,
    stabilityAfter: params.newState.stability,
    intervalDays: params.intervalDays,
    retrievability: params.retrievability,
    performanceScore,
    questionsTotal: params.topic.questionsTotal,
    questionsCorrect: params.topic.questionsCorrect,
    algorithmVersion: params.fsrsConfig.version,
    requestedRetention: params.fsrsConfig.requestedRetention,
    usedCustomWeights: params.fsrsConfig.customWeights !== null,
  };
}

export function ReviewSystem({
  subjects,
  fsrsConfig,
  onUpdateFsrsConfig,
  onUpdateSubject,
  onNavigateToSubject,
}: ReviewSystemProps) {
  const [activeReviewTopicId, setActiveReviewTopicId] = useState<string | null>(null);
  const [reviewPopup, setReviewPopup] = useState<{
    subjectId: string;
    groupId: string;
    topicId: string;
    questionsMade: number;
    questionsCorrect: number;
  } | null>(null);
  const [reviewPopupError, setReviewPopupError] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [weightsDraft, setWeightsDraft] = useState(() => {
    const normalized = normalizeFSRSConfig(fsrsConfig);
    return formatWeightsForInput(normalized.customWeights ?? getDefaultWeights(normalized.version));
  });
  const [weightsError, setWeightsError] = useState<string | null>(null);
  const [upcomingVisibleCount, setUpcomingVisibleCount] = useState<VisibleCount>(() => (
    readVisibleCount('reviews_upcoming_visible_count')
  ));
  const [activeTopicsVisibleCount, setActiveTopicsVisibleCount] = useState<VisibleCount>(() => (
    readVisibleCount('reviews_active_visible_count')
  ));
  const [searchFilter, setSearchFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [dueUrgencyFilter, setDueUrgencyFilter] = useState<DueUrgencyFilter>('all');
  const [upcomingRangeDays, setUpcomingRangeDays] = useState<7 | 30 | 3650>(30);
  const currentFsrsConfig = useMemo(() => normalizeFSRSConfig(fsrsConfig), [fsrsConfig]);
  const reviewsDue = useMemo(() => getReviewsDue(subjects), [subjects]);
  const upcomingReviewsAll = useMemo(() => getUpcomingReviews(subjects, 500), [subjects]);

  const availableTags = useMemo(() => {
    const unique = new Set<string>();
    for (const subject of subjects) {
      for (const topic of getAllTopics(subject)) {
        for (const tag of topic.tags ?? []) unique.add(tag);
      }
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [subjects]);

  const searchTokens = useMemo(
    () => searchFilter.trim().toLocaleLowerCase('pt-BR').split(/\s+/).filter(Boolean),
    [searchFilter],
  );
  const hasSearchFilter = searchTokens.length > 0;
  const baseFilters = useMemo<TopicFilterConfig>(() => ({
    subjectFilter,
    priorityFilter,
    tagFilter,
    searchTokens,
  }), [subjectFilter, priorityFilter, tagFilter, searchTokens]);
  const hasAdvancedFilters = hasSearchFilter
    || subjectFilter !== 'all'
    || priorityFilter !== 'all'
    || tagFilter !== 'all'
    || dueUrgencyFilter !== 'all'
    || upcomingRangeDays !== 30;

  const filteredDueReviews = useMemo(() => (
    reviewsDue.filter(item => {
      if (!topicMatchesFilters(item.topic, item, baseFilters)) return false;
      if (dueUrgencyFilter === 'all') return true;
      const status = getReviewStatus(item.topic.fsrsNextReview);
      if (dueUrgencyFilter === 'today') return status.urgency === 'today';
      return status.urgency === 'overdue';
    })
  ), [reviewsDue, baseFilters, dueUrgencyFilter]);

  const filteredUpcomingAll = useMemo(() => (
    upcomingReviewsAll.filter(item => {
      if (!topicMatchesFilters(item.topic, item, baseFilters)) return false;
      const days = daysUntilReview(item.topic.fsrsNextReview);
      if (days === null) return false;
      return days <= upcomingRangeDays;
    })
  ), [upcomingReviewsAll, baseFilters, upcomingRangeDays]);
  const upcomingReviews = useMemo(
    () => filteredUpcomingAll.slice(0, upcomingVisibleCount),
    [filteredUpcomingAll, upcomingVisibleCount],
  );

  const activeTopicsAll = useMemo(() => {
    const rows: Array<{
      subjectId: string;
      subjectName: string;
      subjectEmoji: string;
      subjectColor: string;
      groupName: string;
      topic: Topic;
    }> = [];
    for (const subject of subjects) {
      for (const group of subject.topicGroups) {
        for (const topic of group.topics) {
          if (topic.reviewHistory.length === 0) continue;
          if (!topicMatchesFilters(topic, {
            subjectId: subject.id,
            subjectName: subject.name,
            groupName: group.name,
          }, baseFilters)) continue;
          rows.push({
            subjectId: subject.id,
            subjectName: subject.name,
            subjectEmoji: subject.emoji,
            subjectColor: subject.color,
            groupName: group.name,
            topic,
          });
        }
      }
    }
    rows.sort((a, b) => (a.topic.fsrsNextReview || '9999-12-31').localeCompare(b.topic.fsrsNextReview || '9999-12-31'));
    return rows;
  }, [subjects, baseFilters]);

  // Count totals (respecting active filters)
  const totalWithReviews = activeTopicsAll.length;
  const totalDue = filteredDueReviews.length;
  const totalUpcoming = filteredUpcomingAll.length;
  const retentionPercent = Math.round(currentFsrsConfig.requestedRetention * 100);

  useEffect(() => {
    window.localStorage.setItem('reviews_upcoming_visible_count', String(upcomingVisibleCount));
  }, [upcomingVisibleCount]);

  useEffect(() => {
    window.localStorage.setItem('reviews_active_visible_count', String(activeTopicsVisibleCount));
  }, [activeTopicsVisibleCount]);

  useEffect(() => {
    setWeightsDraft(formatWeightsForInput(
      currentFsrsConfig.customWeights ?? getDefaultWeights(currentFsrsConfig.version),
    ));
    setWeightsError(null);
  }, [currentFsrsConfig]);

  function findReviewTopic(subjectId: string, groupId: string, topicId: string) {
    const subject = subjects.find(s => s.id === subjectId);
    const group = subject?.topicGroups.find(g => g.id === groupId);
    const topic = group?.topics.find(t => t.id === topicId);
    if (!subject || !group || !topic) return null;
    return { subject, group, topic };
  }

  function updateReviewQuestionProgress(
    subjectId: string,
    groupId: string,
    topicId: string,
    deltaMade: number,
    deltaCorrect: number,
  ) {
    const found = findReviewTopic(subjectId, groupId, topicId);
    if (!found) return;

    const safeMade = parseNonNegativeInt(deltaMade);
    const safeCorrect = Math.min(safeMade, parseNonNegativeInt(deltaCorrect));
    const nextLogs = [...(found.topic.questionLogs ?? [])];

    if (safeMade > 0 || safeCorrect > 0) {
      const today = toDateOnlyString(new Date());
      const existingIdx = nextLogs.findIndex(log => log.date === today);
      if (existingIdx >= 0) {
        const existing = nextLogs[existingIdx];
        nextLogs[existingIdx] = {
          ...existing,
          questionsMade: existing.questionsMade + safeMade,
          questionsCorrect: existing.questionsCorrect + safeCorrect,
        };
      } else {
        nextLogs.push({
          date: today,
          questionsMade: safeMade,
          questionsCorrect: safeCorrect,
        });
      }
    }

    onUpdateSubject({
      ...found.subject,
      topicGroups: found.subject.topicGroups.map(group =>
        group.id === groupId
          ? {
              ...group,
              topics: group.topics.map(topic =>
                topic.id === topicId
                  ? {
                      ...topic,
                      questionsTotal: topic.questionsTotal + safeMade,
                      questionsCorrect: topic.questionsCorrect + safeCorrect,
                      questionLogs: nextLogs,
                    }
                  : topic
              ),
            }
          : group
      ),
    });
  }

  function openReviewPopup(subjectId: string, groupId: string, topicId: string) {
    setActiveReviewTopicId(null);
    setReviewPopup({ subjectId, groupId, topicId, questionsMade: 0, questionsCorrect: 0 });
    setReviewPopupError(null);
  }

  function closeReviewPopup() {
    setReviewPopup(null);
    setReviewPopupError(null);
  }

  function confirmReviewPopup() {
    if (!reviewPopup) return;
    if (reviewPopup.questionsCorrect > reviewPopup.questionsMade) {
      setReviewPopupError('Os acertos nao podem ser maiores que as questoes feitas.');
      return;
    }
    updateReviewQuestionProgress(
      reviewPopup.subjectId,
      reviewPopup.groupId,
      reviewPopup.topicId,
      reviewPopup.questionsMade,
      reviewPopup.questionsCorrect,
    );
    setActiveReviewTopicId(reviewPopup.topicId);
    closeReviewPopup();
  }

  function performReview(subjectId: string, groupId: string, topicId: string, rating: FSRSRating) {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;

    const group = subject.topicGroups.find(g => g.id === groupId);
    if (!group) return;

    const topic = group.topics.find(t => t.id === topicId);
    if (!topic) return;

    const currentState = {
      difficulty: topic.fsrsDifficulty,
      stability: topic.fsrsStability,
      lastReview: topic.fsrsLastReview,
      nextReview: topic.fsrsNextReview,
    };

    const normalizedFsrsConfig = currentFsrsConfig;
    const { newState, intervalDays, retrievability } = fsrsReview(currentState, rating, normalizedFsrsConfig);

    const reviewEntry = createReviewEntry({
      topic,
      rating,
      currentState,
      newState,
      intervalDays,
      retrievability,
      fsrsConfig: normalizedFsrsConfig,
    });

    onUpdateSubject({
      ...subject,
      topicGroups: subject.topicGroups.map(g =>
        g.id === groupId
          ? {
              ...g,
              topics: g.topics.map(t =>
                t.id === topicId
                  ? {
                      ...t,
                      fsrsDifficulty: newState.difficulty,
                      fsrsStability: newState.stability,
                      fsrsLastReview: newState.lastReview,
                      fsrsNextReview: newState.nextReview,
                      reviewHistory: [...t.reviewHistory, reviewEntry],
                    }
                  : t
              ),
            }
          : g
      ),
    });

    setActiveReviewTopicId(null);
  }

  function updateVersion(version: FSRSVersion) {
    const next = normalizeFSRSConfig({
      ...fsrsConfig,
      version,
      // clear custom weights when switching version (length can differ)
      customWeights: null,
    });
    onUpdateFsrsConfig(next);
  }

  function updateRetention(value: number) {
    const next = normalizeFSRSConfig({
      ...fsrsConfig,
      requestedRetention: value,
    });
    onUpdateFsrsConfig(next);
  }

  function applyCustomWeights() {
    const normalized = normalizeFSRSConfig(fsrsConfig);
    const parsed = parseWeightsInput(weightsDraft);
    const expected = getExpectedWeightCount(normalized.version);
    if (parsed.length !== expected) {
      setWeightsError(`A versÃ£o ${FSRS_VERSION_LABEL[normalized.version]} exige ${expected} pesos.`);
      return;
    }

    const next = normalizeFSRSConfig({
      ...normalized,
      customWeights: parsed,
    });
    onUpdateFsrsConfig(next);
    setWeightsError(null);
  }

  function useDefaultWeights() {
    const normalized = normalizeFSRSConfig(fsrsConfig);
    onUpdateFsrsConfig({ ...normalized, customWeights: null });
    setWeightsDraft(formatWeightsForInput(getDefaultWeights(normalized.version)));
    setWeightsError(null);
  }

  function toggleHistory(topicId: string) {
    setExpandedHistory(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-700 p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzEuNjU3IDAgMy0xLjM0MyAzLTNzLTEuMzQzLTMtMy0zLTMgMS4zNDMtMyAzIDEuMzQzIDMgMyAzem0wIDMwYzEuNjU3IDAgMy0xLjM0MyAzLTNzLTEuMzQzLTMtMy0zLTMgMS4zNDMtMyAzIDEuMzQzIDMgMyAzem0tMTgtMTVjMS42NTcgMCAzLTEuMzQzIDMtM3MtMS4zNDMtMy0zLTMtMyAxLjM0My0zIDMgMS4zNDMgMyAzIDN6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        <div className="relative">
          <h1 className="text-2xl md:text-3xl font-bold text-center flex items-center justify-center gap-3">
            <Brain size={32} /> Sistema de RevisÃ£o Espacada (FSRS)
          </h1>
          <p className="text-center text-purple-200 mt-1 text-sm italic">
            Algoritmo {FSRS_VERSION_LABEL[currentFsrsConfig.version]} - Otimize sua retenÃ§Ã£o com revisÃµes inteligentes
          </p>
        </div>
      </div>

      {/* FSRS Config */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-semibold text-gray-700">VersÃ£o do algoritmo:</span>
          {(['fsrs5', 'fsrs6'] as FSRSVersion[]).map(version => (
            <button
              key={version}
              onClick={() => updateVersion(version)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentFsrsConfig.version === version
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {FSRS_VERSION_LABEL[version]}
            </button>
          ))}
          <span className="text-xs text-gray-500">
            {currentFsrsConfig.version === 'fsrs6'
              ? 'Modo recente, com curva de esquecimento treinÃ¡vel.'
              : 'Modo estÃ¡vel e amplamente validado.'}
          </span>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">RetenÃ§Ã£o alvo (0.01-0.999)</label>
            <input
              type="number"
              min="0.01"
              max="0.999"
              step="0.01"
              value={currentFsrsConfig.requestedRetention}
              onChange={e => updateRetention(Number(e.target.value))}
              className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
          <div className="text-xs text-gray-500 pb-2">
            Equivale a <strong>{retentionPercent}%</strong> de retenÃ§Ã£o esperada.
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 block">
            Pesos treinados (opcional, separados por vÃ­rgula ou espaÃ§o)
          </label>
          <textarea
            value={weightsDraft}
            onChange={e => setWeightsDraft(e.target.value)}
            className="w-full min-h-20 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder={formatWeightsForInput(getDefaultWeights(currentFsrsConfig.version))}
          />
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={applyCustomWeights}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
            >
              Aplicar pesos personalizados
            </button>
            <button
              onClick={useDefaultWeights}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Usar pesos padrÃ£o
            </button>
            <span className="text-[11px] text-gray-500">
              Esperado: {getExpectedWeightCount(currentFsrsConfig.version)} valores para {FSRS_VERSION_LABEL[currentFsrsConfig.version]}.
            </span>
          </div>
          {weightsError && <p className="text-xs text-red-600">{weightsError}</p>}
          {currentFsrsConfig.customWeights && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              Pesos personalizados ativos.
            </p>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-xs text-gray-500 font-medium mb-1">Com RevisÃµes</p>
          <p className="text-2xl font-bold text-purple-700">{totalWithReviews}</p>
        </div>
        <div className={`rounded-xl shadow-sm border p-4 text-center ${totalDue > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
          <p className="text-xs text-gray-500 font-medium mb-1">Para Revisar</p>
          <p className={`text-2xl font-bold ${totalDue > 0 ? 'text-red-600' : 'text-gray-400'}`}>{totalDue}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-xs text-gray-500 font-medium mb-1">Agendadas</p>
          <p className="text-2xl font-bold text-blue-600">{totalUpcoming}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-xs text-gray-500 font-medium mb-1">RetenÃ§Ã£o Alvo</p>
          <p className="text-2xl font-bold text-green-600">{retentionPercent}%</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-700 inline-flex items-center gap-2">
            <Filter size={15} /> Filtros avanÃ§ados de revisÃ£o
          </h2>
          {hasAdvancedFilters && (
            <button
              onClick={() => {
                setSearchFilter('');
                setSubjectFilter('all');
                setPriorityFilter('all');
                setTagFilter('all');
                setDueUrgencyFilter('all');
                setUpcomingRangeDays(30);
              }}
              className="text-xs px-2.5 py-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              Limpar filtros
            </button>
          )}
        </div>
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1 pr-2">
          <div className="flex flex-1 min-w-[260px] items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5">
            <Search size={14} className="text-gray-400" />
            <input
              value={searchFilter}
              onChange={event => setSearchFilter(event.target.value)}
              placeholder="Buscar por assunto, nota ou tag..."
              className="flex-1 min-w-0 text-xs bg-transparent outline-none"
            />
          </div>
          <select
            value={subjectFilter}
            onChange={event => setSubjectFilter(event.target.value)}
            className="shrink-0 min-w-[170px] rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white"
          >
            <option value="all">Todas disciplinas</option>
            {subjects.map(subject => (
              <option key={`subject-filter-${subject.id}`} value={subject.id}>{subject.emoji} {subject.name}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={event => setPriorityFilter(event.target.value as 'all' | 'alta' | 'media' | 'baixa' | 'none')}
            className="shrink-0 min-w-[155px] rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white"
          >
            <option value="all">Todas prioridades</option>
            <option value="alta">Alta</option>
            <option value="media">MÃ©dia</option>
            <option value="baixa">Baixa</option>
            <option value="none">Sem prioridade</option>
          </select>
          <select
            value={tagFilter}
            onChange={event => setTagFilter(event.target.value)}
            className="shrink-0 min-w-[140px] rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white"
          >
            <option value="all">Todas tags</option>
            {availableTags.map(tag => (
              <option key={`tag-filter-${tag}`} value={tag}>#{tag}</option>
            ))}
          </select>
          <select
            value={dueUrgencyFilter}
            onChange={event => setDueUrgencyFilter(event.target.value as 'all' | 'overdue' | 'today')}
            className="shrink-0 min-w-[165px] rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white"
          >
            <option value="all">Pendentes: todas</option>
            <option value="overdue">Somente atrasadas</option>
            <option value="today">Somente hoje</option>
          </select>
          <select
            value={upcomingRangeDays}
            onChange={event => setUpcomingRangeDays(Number(event.target.value) as 7 | 30 | 3650)}
            className="shrink-0 min-w-[150px] rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white"
          >
            <option value={7}>PrÃ³ximas: 7d</option>
            <option value={30}>PrÃ³ximas: 30d</option>
            <option value={3650}>PrÃ³ximas: todas</option>
          </select>
        </div>
      </div>

      {/* Reviews Due NOW */}
      {totalDue > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
          <div className="px-5 py-3 bg-red-50 border-b border-red-200 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            <h2 className="font-bold text-red-700 text-lg">
              RevisÃµes Pendentes ({totalDue})
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {filteredDueReviews.map(item => {
              const isActive = activeReviewTopicId === item.topic.id;
              const suggestedRating = suggestRatingFromPerformance(item.topic.questionsTotal, item.topic.questionsCorrect);
              const historyExpanded = expandedHistory.has(item.topic.id);
              const currentRetrievability = item.topic.fsrsStability > 0
                ? calculateRetrievabilityWithConfig(
                    item.topic.fsrsStability,
                    item.daysOverdue + Math.round(item.topic.fsrsStability),
                    currentFsrsConfig,
                  )
                : null;

              return (
                <div key={item.topic.id} className="px-5 py-4">
                  {/* Topic Info Row */}
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg shrink-0"
                      style={{ backgroundColor: item.subjectColor }}
                    >
                      {item.subjectEmoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-800">{item.topic.name}</h3>
                        {item.daysOverdue > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                            {item.daysOverdue}d atrasada
                          </span>
                        )}
                        {item.daysOverdue === 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                            Hoje!
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.subjectName}{' -> '}{item.groupName}
                        {item.topic.reviewHistory.length > 0 && (
                          <span className="ml-2">- RevisÃ£o #{item.topic.reviewHistory.length + 1}</span>
                        )}
                      </p>

                      {/* Quick Stats */}
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                        {item.topic.questionsTotal > 0 && (
                          <span className="flex items-center gap-1">
                            <BarChart3 size={12} />
                            {item.topic.questionsCorrect}/{item.topic.questionsTotal} questÃµes
                            ({formatPercent(item.topic.questionsCorrect / item.topic.questionsTotal)})
                          </span>
                        )}
                        {item.topic.fsrsStability > 0 && (
                          <span className="flex items-center gap-1">
                            <Zap size={12} />
                            Estab: {item.topic.fsrsStability.toFixed(1)}
                          </span>
                        )}
                        {item.topic.fsrsDifficulty > 0 && (
                          <span className={`flex items-center gap-1 ${getDifficultyLabel(item.topic.fsrsDifficulty).color}`}>
                            <Star size={12} />
                            Dif: {item.topic.fsrsDifficulty.toFixed(1)} ({getDifficultyLabel(item.topic.fsrsDifficulty).text})
                          </span>
                        )}
                        {currentRetrievability !== null && (
                          <span className="flex items-center gap-1">
                            <Brain size={12} />
                            RetenÃ§Ã£o estimada: {formatPercent(currentRetrievability)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (isActive) {
                          setActiveReviewTopicId(null);
                          return;
                        }
                        openReviewPopup(item.subjectId, item.groupId, item.topic.id);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${
                        isActive
                          ? 'bg-gray-200 text-gray-700'
                          : 'bg-purple-600 text-white hover:bg-purple-700 shadow-md'
                      }`}
                    >
                      {isActive ? 'Cancelar' : 'Revisar'}
                    </button>
                  </div>

                  {/* Rating Buttons (when active) */}
                  {isActive && (
                    <div className="mt-4 bg-purple-50 rounded-xl p-4 border border-purple-200">
                      <p className="text-sm font-medium text-purple-800 mb-3 flex items-center gap-2">
                        <RotateCcw size={16} />
                        Como foi a revisÃ£o deste assunto?
                      </p>
                      {suggestedRating && (
                        <p className="text-xs text-purple-600 mb-3 bg-purple-100 px-3 py-1.5 rounded-lg">
                          SugestÃ£o baseada no desempenho ({formatPercent(item.topic.questionsCorrect / item.topic.questionsTotal)}):
                          <strong className="ml-1">{RATING_OPTIONS.find(r => r.value === suggestedRating)?.emoji} {RATING_OPTIONS.find(r => r.value === suggestedRating)?.label}</strong>
                        </p>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {RATING_OPTIONS.map(opt => {
                          const isSuggested = suggestedRating === opt.value;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => performReview(item.subjectId, item.groupId, item.topic.id, opt.value)}
                              className={`py-3 px-3 rounded-xl text-white font-medium text-sm transition-all hover:scale-105 hover:shadow-lg ${opt.color} ${opt.hoverColor} ${
                                isSuggested ? 'ring-2 ring-offset-2 ring-purple-500 scale-105' : ''
                              }`}
                            >
                              <span className="text-xl block">{opt.emoji}</span>
                              <span className="block mt-1">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Review History Toggle */}
                  {item.topic.reviewHistory.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => toggleHistory(item.topic.id)}
                        className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1 transition-colors"
                      >
                        {historyExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <History size={14} />
                        HistÃ³rico ({item.topic.reviewHistory.length} revisÃµes)
                      </button>
                      {historyExpanded && (
                        <ReviewHistoryTimeline reviews={item.topic.reviewHistory} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Reviews Due */}
      {totalDue === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-2">OK</div>
          <p className="font-bold text-green-700 text-lg">
            {hasAdvancedFilters ? 'Nenhuma revisÃ£o encontrada com os filtros atuais.' : 'Nenhuma revisÃ£o pendente!'}
          </p>
          <p className="text-green-600 text-sm mt-1">
            {hasAdvancedFilters
              ? 'Ajuste os filtros para ampliar os resultados.'
              : 'Todas as revisÃµes estÃ£o em dia. Continue estudando e marcando assuntos para revisÃ£o.'}
          </p>
        </div>
      )}

      {/* Upcoming Reviews */}
      {totalUpcoming > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-blue-600" />
              <h2 className="font-bold text-blue-700">PrÃ³ximas RevisÃµes</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-700">
              <span>Mostrar:</span>
              <select
                value={upcomingVisibleCount}
                onChange={event => setUpcomingVisibleCount(Number(event.target.value) as VisibleCount)}
                aria-label="Quantidade de prÃ³ximas revisÃµes"
                className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs"
              >
                {VISIBLE_COUNT_OPTIONS.map(option => (
                  <option key={`upcoming-${option}`} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {upcomingReviews.map(item => {
              const days = daysUntilReview(item.topic.fsrsNextReview);
              const status = getReviewStatus(item.topic.fsrsNextReview);
              return (
                <div
                  key={item.topic.id}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onNavigateToSubject(item.subjectId)}
                >
                  <span className="text-lg">{item.subjectEmoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.topic.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {item.subjectName}{' -> '}{item.groupName}
                      {item.topic.reviewHistory.length > 0 && ` - Rev. #${item.topic.reviewHistory.length + 1}`}
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${status.className}`}>
                    {days !== null && days === 1 ? 'AmanhÃ£' : status.text}
                  </span>
                  <ArrowRight size={14} className="text-gray-300 shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Topics with FSRS Data */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-gray-600" />
            <h2 className="font-bold text-gray-700">Assuntos com RevisÃ£o Ativa</h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span>Mostrar:</span>
            <select
              value={activeTopicsVisibleCount}
              onChange={event => setActiveTopicsVisibleCount(Number(event.target.value) as VisibleCount)}
              aria-label="Quantidade de assuntos ativos"
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
            >
              {VISIBLE_COUNT_OPTIONS.map(option => (
                <option key={`active-${option}`} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>
        {totalWithReviews === 0 ? (
          <div className="p-8 text-center">
            <Brain size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium mb-1">Nenhum assunto com revisÃ£o ativa</p>
            <p className="text-gray-400 text-sm">
              Para iniciar, vÃ¡ a uma disciplina, marque um assunto como estudado e clique em "Iniciar RevisÃ£o FSRS".
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {activeTopicsAll.slice(0, activeTopicsVisibleCount).map(item => {
              const status = getReviewStatus(item.topic.fsrsNextReview);
              const diffLabel = getDifficultyLabel(item.topic.fsrsDifficulty);
              const historyExpanded2 = expandedHistory.has('all-' + item.topic.id);
              return (
                <div key={`active-topic-${item.topic.id}`} className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onNavigateToSubject(item.subjectId)}
                      className="w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0"
                      style={{ backgroundColor: item.subjectColor }}
                      title={item.subjectName}
                    >
                      {item.subjectEmoji}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.topic.name}</p>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                        <span>{item.subjectName}</span>
                        <span>-</span>
                        <span>RevisÃµes: {item.topic.reviewHistory.length}</span>
                        <span>-</span>
                        <span className={diffLabel.color}>Dif: {item.topic.fsrsDifficulty.toFixed(1)}</span>
                        <span>-</span>
                        <span>Estab: {item.topic.fsrsStability.toFixed(1)}</span>
                        {(item.topic.tags ?? []).slice(0, 2).map(tag => (
                          <span key={`tag-${item.topic.id}-${tag}`} className="rounded-full bg-slate-100 text-slate-600 px-1.5 py-0.5 text-[10px]">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${status.className}`}>
                      {status.text}
                    </span>
                  </div>
                  {item.topic.reviewHistory.length > 0 && (
                    <button
                      onClick={() => {
                        const key = 'all-' + item.topic.id;
                        setExpandedHistory(prev => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        });
                      }}
                      className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1 mt-2 transition-colors"
                    >
                      {historyExpanded2 ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <History size={14} />
                      Ver histÃ³rico
                    </button>
                  )}
                  {historyExpanded2 && (
                    <ReviewHistoryTimeline reviews={item.topic.reviewHistory} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* How FSRS Works */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
        <h3 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
          <Brain size={18} />
          Como funciona o FSRS?
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-purple-700">
          <div className="space-y-2">
            <p><strong>Esqueci (1):</strong> Estabilidade cai drasticamente, revisÃ£o em breve</p>
            <p><strong>DifÃ­cil (2):</strong> Intervalo cresce pouco, dificuldade aumenta</p>
          </div>
          <div className="space-y-2">
            <p><strong>Bom (3):</strong> Crescimento normal do intervalo</p>
            <p><strong>FÃ¡cil (4):</strong> Intervalo cresce bastante, revisÃ£o mais distante</p>
          </div>
        </div>
        <div className="mt-3 text-xs text-purple-600 bg-purple-100 rounded-lg p-3">
          O sistema sugere automaticamente uma avaliaÃ§Ã£o baseada no seu desempenho em questÃµes.
          Cada revisÃ£o cria um novo bloco no histÃ³rico, permitindo acompanhar a evoluÃ§Ã£o ao longo do tempo.
        </div>
      </div>

      {reviewPopup && (() => {
        const info = findReviewTopic(reviewPopup.subjectId, reviewPopup.groupId, reviewPopup.topicId);
        if (!info) return null;
        const total = info.topic.questionsTotal;
        const correct = info.topic.questionsCorrect;
        return (
          <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4" onClick={closeReviewPopup}>
            <div
              className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl"
              onClick={event => event.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">Revisao pendente</p>
                  <h3 className="text-base font-semibold text-slate-800">Registrar desempenho da revisao</h3>
                </div>
                <button
                  onClick={closeReviewPopup}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  title="Fechar"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <p className="font-medium text-slate-700">{info.subject.name} - {info.topic.name}</p>
                  <p>Total atual: {correct}/{total} questoes</p>
                  <p>Os valores abaixo serao somados ao total do assunto.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Questoes feitas</label>
                    <input
                      type="number"
                      min="0"
                      value={reviewPopup.questionsMade}
                      onChange={event => setReviewPopup(prev => prev ? {
                        ...prev,
                        questionsMade: parseNonNegativeInt(event.target.value),
                        questionsCorrect: Math.min(prev.questionsCorrect, parseNonNegativeInt(event.target.value)),
                      } : prev)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Acertos</label>
                    <input
                      type="number"
                      min="0"
                      max={reviewPopup.questionsMade}
                      value={reviewPopup.questionsCorrect}
                      onChange={event => setReviewPopup(prev => prev ? {
                        ...prev,
                        questionsCorrect: Math.min(parseNonNegativeInt(event.target.value), prev.questionsMade),
                      } : prev)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                </div>

                {reviewPopupError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {reviewPopupError}
                  </p>
                )}
              </div>

              <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={closeReviewPopup}
                  className="px-3 py-2 rounded-lg text-sm bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmReviewPopup}
                  className="px-3 py-2 rounded-lg text-sm text-white bg-purple-600 hover:bg-purple-700"
                >
                  Continuar para revisao
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

// ---- Review History Timeline Component ----
const ReviewHistoryTimeline = memo(function ReviewHistoryTimeline({ reviews }: { reviews: ReviewEntry[] }) {
  return (
    <div className="mt-3 pl-4 border-l-2 border-purple-200 space-y-3">
      {reviews.map((rev) => {
        const ratingOpt = RATING_OPTIONS.find(r => r.value === rev.rating);
        return (
          <div key={rev.id} className={`rounded-lg p-3 border ${ratingOpt?.borderColor || 'border-gray-200'} ${ratingOpt?.lightBg || 'bg-gray-50'}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full text-white font-medium ${ratingOpt?.color || 'bg-gray-500'}`}>
                RevisÃ£o #{rev.reviewNumber}
              </span>
              <span className="text-xs text-gray-500">{formatDate(rev.date)}</span>
              <span className="text-sm">{ratingOpt?.emoji}</span>
              <span className={`text-xs font-medium ${ratingOpt?.textColor || 'text-gray-700'}`}>{rev.ratingLabel}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-600">
              <span>
                Dificuldade: {rev.difficultyBefore.toFixed(1)}{' -> '}<strong>{rev.difficultyAfter.toFixed(1)}</strong>
              </span>
              <span>
                Estabilidade: {rev.stabilityBefore.toFixed(1)}{' -> '}<strong>{rev.stabilityAfter.toFixed(1)}</strong>
              </span>
              <span>
                Intervalo: <strong>{rev.intervalDays} dia{rev.intervalDays !== 1 ? 's' : ''}</strong>
              </span>
              {rev.retrievability !== null && (
                <span>
                  RetenÃ§Ã£o: <strong>{formatPercent(rev.retrievability)}</strong>
                </span>
              )}
              {rev.performanceScore !== null && (
                <span>
                  Desempenho: <strong>{formatPercent(rev.performanceScore)}</strong> ({rev.questionsCorrect}/{rev.questionsTotal})
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});
ReviewHistoryTimeline.displayName = 'ReviewHistoryTimeline';

// ---- Inline Review Widget for SubjectDetail ----
export function TopicReviewWidget({
  topic,
  groupId,
  subjectId,
  subjectColor,
  fsrsConfig,
  onUpdate,
}: {
  topic: Topic;
  groupId: string;
  subjectId: string;
  subjectColor: string;
  fsrsConfig: FSRSConfig;
  onUpdate: (subjectId: string, groupId: string, topicId: string, changes: Partial<Topic>) => void;
}) {
  const [showRating, setShowRating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const hasReviews = topic.reviewHistory.length > 0;
  const normalizedFsrsConfig = normalizeFSRSConfig(fsrsConfig);
  const status = getReviewStatus(topic.fsrsNextReview);
  const isDue = topic.fsrsNextReview !== null
    && topic.fsrsNextReview <= toDateOnlyString(new Date());
  const suggestedRating = suggestRatingFromPerformance(topic.questionsTotal, topic.questionsCorrect);

  function doReview(rating: FSRSRating) {
    const currentState = {
      difficulty: topic.fsrsDifficulty,
      stability: topic.fsrsStability,
      lastReview: topic.fsrsLastReview,
      nextReview: topic.fsrsNextReview,
    };

    const { newState, intervalDays, retrievability } = fsrsReview(currentState, rating, normalizedFsrsConfig);
    const reviewEntry = createReviewEntry({
      topic,
      rating,
      currentState,
      newState,
      intervalDays,
      retrievability,
      fsrsConfig: normalizedFsrsConfig,
    });

    onUpdate(subjectId, groupId, topic.id, {
      fsrsDifficulty: newState.difficulty,
      fsrsStability: newState.stability,
      fsrsLastReview: newState.lastReview,
      fsrsNextReview: newState.nextReview,
      reviewHistory: [...topic.reviewHistory, reviewEntry],
    });

    setShowRating(false);
  }

  return (
    <div className="mt-2 pt-2 border-t border-gray-100">
      <div className="flex items-center gap-2 flex-wrap">
        <Brain size={14} className="text-purple-500" />
        <span className="text-xs font-medium text-purple-700">FSRS</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
          {FSRS_VERSION_LABEL[normalizedFsrsConfig.version]}
        </span>

        {!hasReviews && !showRating && (
          <button
            onClick={() => setShowRating(true)}
            className="text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors font-medium"
          >
            Iniciar RevisÃ£o
          </button>
        )}

        {hasReviews && (
          <>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.className}`}>
              {isDue ? '! ' : ''}{status.text}
            </span>
            <span className="text-xs text-gray-400">
              Rev. #{topic.reviewHistory.length}
            </span>
            {topic.fsrsStability > 0 && (
              <span className="text-xs text-gray-400">
                - Estab: {topic.fsrsStability.toFixed(1)}
              </span>
            )}
            {isDue && !showRating && (
              <button
                onClick={() => setShowRating(true)}
                className="text-xs px-2.5 py-1 rounded-full text-white font-medium hover:opacity-90 transition-opacity ml-auto animate-pulse"
                style={{ backgroundColor: subjectColor }}
              >
                Revisar Agora
              </button>
            )}
            {!isDue && !showRating && (
              <button
                onClick={() => setShowRating(true)}
                className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors font-medium ml-auto"
              >
                Revisar antecipado
              </button>
            )}
          </>
        )}
      </div>

      {/* Rating buttons */}
      {showRating && (
        <div className="mt-2 bg-purple-50 rounded-lg p-3 border border-purple-200">
          <p className="text-xs text-purple-700 font-medium mb-2">
            {hasReviews ? `RevisÃ£o #${topic.reviewHistory.length + 1}` : 'Primeira revisÃ£o'} - Como foi?
          </p>
          {suggestedRating && topic.questionsTotal > 0 && (
            <p className="text-[10px] text-purple-600 mb-2 bg-purple-100 px-2 py-1 rounded">
              SugestÃ£o: {RATING_OPTIONS.find(r => r.value === suggestedRating)?.emoji} {RATING_OPTIONS.find(r => r.value === suggestedRating)?.label}
              {' '}(baseado em {formatPercent(topic.questionsCorrect / topic.questionsTotal)} de acerto)
            </p>
          )}
          <div className="grid grid-cols-4 gap-1.5">
            {RATING_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => doReview(opt.value)}
                className={`py-2 px-1 rounded-lg text-white font-medium text-xs transition-all hover:scale-105 ${opt.color} ${opt.hoverColor} ${
                  suggestedRating === opt.value ? 'ring-2 ring-offset-1 ring-purple-400' : ''
                }`}
              >
                <span className="text-base block">{opt.emoji}</span>
                <span className="block mt-0.5 text-[10px]">{opt.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowRating(false)}
            className="text-xs text-gray-500 hover:text-gray-700 mt-2 transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* History toggle */}
      {hasReviews && (
        <div className="mt-1">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-[10px] text-purple-500 hover:text-purple-700 flex items-center gap-1 transition-colors"
          >
            {showHistory ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <History size={12} />
            HistÃ³rico ({topic.reviewHistory.length} revisÃµes)
          </button>
          {showHistory && (
            <div className="mt-1">
              <ReviewHistoryTimeline reviews={topic.reviewHistory} />
            </div>
          )}
        </div>
      )}

    </div>
  );
}





