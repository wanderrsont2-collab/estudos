import { useEffect, useState } from 'react';
import { Subject, Topic, ReviewEntry } from '../types';
import {
  fsrsReview, RATING_OPTIONS, suggestRatingFromPerformance,
  getReviewStatus, getDifficultyLabel, generateReviewId, daysUntilReview,
  FSRSRating, calculateRetrievabilityWithConfig, type FSRSConfig,
  type FSRSVersion, FSRS_VERSION_LABEL, getExpectedWeightCount,
  getDefaultWeights, normalizeFSRSConfig,
} from '../fsrs';
import {
  getReviewsDue, getUpcomingReviews, getAllTopics,
} from '../store';
import {
  Brain, TrendingUp, ChevronDown, ChevronRight,
  History, Zap, BarChart3, ArrowRight, RotateCcw,
  Calendar, Star, AlertTriangle,
} from 'lucide-react';

interface ReviewSystemProps {
  subjects: Subject[];
  fsrsConfig: FSRSConfig;
  onUpdateFsrsConfig: (config: FSRSConfig) => void;
  onUpdateSubject: (subject: Subject) => void;
  onNavigateToSubject: (subjectId: string) => void;
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

export function ReviewSystem({
  subjects,
  fsrsConfig,
  onUpdateFsrsConfig,
  onUpdateSubject,
  onNavigateToSubject,
}: ReviewSystemProps) {
  const [activeReviewTopicId, setActiveReviewTopicId] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [weightsDraft, setWeightsDraft] = useState(() => {
    const normalized = normalizeFSRSConfig(fsrsConfig);
    return formatWeightsForInput(normalized.customWeights ?? getDefaultWeights(normalized.version));
  });
  const [weightsError, setWeightsError] = useState<string | null>(null);

  const reviewsDue = getReviewsDue(subjects);
  const upcomingReviews = getUpcomingReviews(subjects, 15);

  // Count totals
  const totalWithReviews = subjects.reduce((sum, s) =>
    sum + getAllTopics(s).filter(t => t.reviewHistory.length > 0).length, 0
  );
  const totalDue = reviewsDue.length;
  const totalUpcoming = upcomingReviews.length;
  const currentFsrsConfig = normalizeFSRSConfig(fsrsConfig);
  const retentionPercent = Math.round(currentFsrsConfig.requestedRetention * 100);

  useEffect(() => {
    const normalized = normalizeFSRSConfig(fsrsConfig);
    setWeightsDraft(formatWeightsForInput(normalized.customWeights ?? getDefaultWeights(normalized.version)));
    setWeightsError(null);
  }, [fsrsConfig]);

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

    const ratingOption = RATING_OPTIONS.find(r => r.value === rating)!;
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
      setWeightsError(`A versao ${FSRS_VERSION_LABEL[normalized.version]} exige ${expected} pesos.`);
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
            <Brain size={32} /> Sistema de Revisao Espacada (FSRS)
          </h1>
          <p className="text-center text-purple-200 mt-1 text-sm italic">
            Algoritmo {FSRS_VERSION_LABEL[currentFsrsConfig.version]} - Otimize sua retencao com revisoes inteligentes
          </p>
        </div>
      </div>

      {/* FSRS Config */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-semibold text-gray-700">Versao do algoritmo:</span>
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
              ? 'Modo recente, com curva de esquecimento treinavel.'
              : 'Modo estavel e amplamente validado.'}
          </span>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Retencao alvo (0.01-0.999)</label>
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
            Equivale a <strong>{retentionPercent}%</strong> de retencao esperada.
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 block">
            Pesos treinados (opcional, separados por virgula ou espaco)
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
              Usar pesos padrao
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
          <p className="text-xs text-gray-500 font-medium mb-1">Com Revisoes</p>
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
          <p className="text-xs text-gray-500 font-medium mb-1">Retencao Alvo</p>
          <p className="text-2xl font-bold text-green-600">{retentionPercent}%</p>
        </div>
      </div>

      {/* Reviews Due NOW */}
      {totalDue > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
          <div className="px-5 py-3 bg-red-50 border-b border-red-200 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            <h2 className="font-bold text-red-700 text-lg">
              Revisoes Pendentes ({totalDue})
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {reviewsDue.map(item => {
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
                          <span className="ml-2">- Revisao #{item.topic.reviewHistory.length + 1}</span>
                        )}
                      </p>

                      {/* Quick Stats */}
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                        {item.topic.questionsTotal > 0 && (
                          <span className="flex items-center gap-1">
                            <BarChart3 size={12} />
                            {item.topic.questionsCorrect}/{item.topic.questionsTotal} questoes
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
                            Retencao estimada: {formatPercent(currentRetrievability)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveReviewTopicId(isActive ? null : item.topic.id)}
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
                        Como foi a revisao deste assunto?
                      </p>
                      {suggestedRating && (
                        <p className="text-xs text-purple-600 mb-3 bg-purple-100 px-3 py-1.5 rounded-lg">
                          Sugestao baseada no desempenho ({formatPercent(item.topic.questionsCorrect / item.topic.questionsTotal)}):
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
                        Historico ({item.topic.reviewHistory.length} revisoes)
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
          <p className="font-bold text-green-700 text-lg">Nenhuma revisao pendente!</p>
          <p className="text-green-600 text-sm mt-1">
            Todas as revisoes estao em dia. Continue estudando e marcando assuntos para revisao.
          </p>
        </div>
      )}

      {/* Upcoming Reviews */}
      {totalUpcoming > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-blue-50 border-b border-blue-200 flex items-center gap-2">
            <Calendar size={18} className="text-blue-600" />
            <h2 className="font-bold text-blue-700">Proximas Revisoes</h2>
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
                    {days !== null && days === 1 ? 'Amanha' : status.text}
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
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <TrendingUp size={18} className="text-gray-600" />
          <h2 className="font-bold text-gray-700">Assuntos com Revisao Ativa</h2>
        </div>
        {totalWithReviews === 0 ? (
          <div className="p-8 text-center">
            <Brain size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium mb-1">Nenhum assunto com revisao ativa</p>
            <p className="text-gray-400 text-sm">
              Para iniciar, va a uma disciplina, marque um assunto como estudado e clique em "Iniciar Revisao FSRS".
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {subjects.map(subject => {
              const topicsWithReview = getAllTopics(subject).filter(t => t.reviewHistory.length > 0);
              if (topicsWithReview.length === 0) return null;
              return (
                <div key={subject.id}>
                  <div
                    className="px-5 py-2 bg-gray-50 flex items-center gap-2 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => onNavigateToSubject(subject.id)}
                  >
                    <span>{subject.emoji}</span>
                    <span className="text-sm font-bold" style={{ color: subject.color }}>{subject.name}</span>
                    <span className="text-xs text-gray-400 ml-1">({topicsWithReview.length} assuntos)</span>
                    <ArrowRight size={14} className="text-gray-300 ml-auto" />
                  </div>
                  {topicsWithReview.map(topic => {
                    const status = getReviewStatus(topic.fsrsNextReview);
                    const diffLabel = getDifficultyLabel(topic.fsrsDifficulty);
                    const historyExpanded2 = expandedHistory.has('all-' + topic.id);
                    return (
                      <div key={topic.id} className="px-5 py-3 pl-12 border-t border-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{topic.name}</p>
                            <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                              <span>Revisoes: {topic.reviewHistory.length}</span>
                              <span>-</span>
                              <span className={diffLabel.color}>Dif: {topic.fsrsDifficulty.toFixed(1)}</span>
                              <span>-</span>
                              <span>Estab: {topic.fsrsStability.toFixed(1)}</span>
                              {topic.questionsTotal > 0 && (
                                <>
                                  <span>-</span>
                                  <span>{formatPercent(topic.questionsCorrect / topic.questionsTotal)} acerto</span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${status.className}`}>
                            {status.text}
                          </span>
                        </div>
                        {topic.reviewHistory.length > 0 && (
                          <button
                            onClick={() => {
                              const key = 'all-' + topic.id;
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
                            Ver historico
                          </button>
                        )}
                        {historyExpanded2 && (
                          <ReviewHistoryTimeline reviews={topic.reviewHistory} />
                        )}
                      </div>
                    );
                  })}
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
            <p><strong>Esqueci (1):</strong> Estabilidade cai drasticamente, revisao em breve</p>
            <p><strong>Dificil (2):</strong> Intervalo cresce pouco, dificuldade aumenta</p>
          </div>
          <div className="space-y-2">
            <p><strong>Bom (3):</strong> Crescimento normal do intervalo</p>
            <p><strong>Facil (4):</strong> Intervalo cresce bastante, revisao mais distante</p>
          </div>
        </div>
        <div className="mt-3 text-xs text-purple-600 bg-purple-100 rounded-lg p-3">
          O sistema sugere automaticamente uma avaliacao baseada no seu desempenho em questoes.
          Cada revisao cria um novo bloco no historico, permitindo acompanhar a evolucao ao longo do tempo.
        </div>
      </div>
    </div>
  );
}

// ---- Review History Timeline Component ----
function ReviewHistoryTimeline({ reviews }: { reviews: ReviewEntry[] }) {
  return (
    <div className="mt-3 pl-4 border-l-2 border-purple-200 space-y-3">
      {reviews.map((rev) => {
        const ratingOpt = RATING_OPTIONS.find(r => r.value === rev.rating);
        return (
          <div key={rev.id} className={`rounded-lg p-3 border ${ratingOpt?.borderColor || 'border-gray-200'} ${ratingOpt?.lightBg || 'bg-gray-50'}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full text-white font-medium ${ratingOpt?.color || 'bg-gray-500'}`}>
                Revisao #{rev.reviewNumber}
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
                  Retencao: <strong>{formatPercent(rev.retrievability)}</strong>
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
}

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
  const isDue = topic.fsrsNextReview ? (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(topic.fsrsNextReview + 'T00:00:00') <= today;
  })() : false;
  const suggestedRating = suggestRatingFromPerformance(topic.questionsTotal, topic.questionsCorrect);

  function doReview(rating: FSRSRating) {
    const currentState = {
      difficulty: topic.fsrsDifficulty,
      stability: topic.fsrsStability,
      lastReview: topic.fsrsLastReview,
      nextReview: topic.fsrsNextReview,
    };

    const { newState, intervalDays, retrievability } = fsrsReview(currentState, rating, normalizedFsrsConfig);
    const ratingOption = RATING_OPTIONS.find(r => r.value === rating)!;
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
            Iniciar Revisao
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
            {hasReviews ? `Revisao #${topic.reviewHistory.length + 1}` : 'Primeira revisao'} - Como foi?
          </p>
          {suggestedRating && topic.questionsTotal > 0 && (
            <p className="text-[10px] text-purple-600 mb-2 bg-purple-100 px-2 py-1 rounded">
              Sugestao: {RATING_OPTIONS.find(r => r.value === suggestedRating)?.emoji} {RATING_OPTIONS.find(r => r.value === suggestedRating)?.label}
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
            Historico ({topic.reviewHistory.length} revisoes)
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




