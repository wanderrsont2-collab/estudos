import { useState, useMemo, useCallback, memo, type ElementType, type ReactNode } from 'react';
import type { Subject, ReviewEntry, Topic } from '../types';
import {
  getReviewsDue, getUpcomingReviews, type ReviewDueItem,
} from '../store';
import {
  RATING_OPTIONS, type FSRSConfig, type FSRSRating,
  calculateRetrievabilityWithConfig, fsrsReview, generateReviewId,
  getDifficultyLabel, normalizeFSRSConfig,
} from '../fsrs';
import { calculateTopicMastery } from '../mastery';
import {
  Brain, ChevronDown, ChevronRight, History,
  ArrowRight, AlertTriangle, Search, X, Clock,
  BookOpen, Target, TrendingUp, Zap, CalendarDays,
  Settings, SlidersHorizontal, BarChart3, CheckCircle2,
} from 'lucide-react';

type RecoveryWave = 'critical' | 'second' | 'later';

interface ActiveTopicItem {
  subjectId: string;
  subjectName: string;
  subjectEmoji: string;
  subjectColor: string;
  groupId: string;
  groupName: string;
  topic: Topic;
}

interface UpcomingReviewItem extends ReviewDueItem {
  daysUntil: number;
}

interface DueReviewItemWithMeta extends ReviewDueItem {
  retrievability: number | null;
  wave: RecoveryWave;
}

interface ReviewSystemProps {
  subjects: Subject[];
  fsrsConfig: FSRSConfig;
  onUpdateFsrsConfig: (config: FSRSConfig) => void;
  onUpdateSubject: (subject: Subject) => void;
  onNavigateToSubject: (subjectId: string) => void;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value * 100)}%`;
}

function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR');
}

function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMasteryScore(topic: Topic): { score: number; label: string } {
  const res = calculateTopicMastery(topic);
  return { score: res.score, label: res.label };
}

function getMasteryColor(score: number): string {
  if (score < 45) return 'bg-rose-100 text-rose-700 dark:bg-rose-900/35 dark:text-rose-200';
  if (score < 65) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/35 dark:text-amber-200';
  if (score < 85) return 'bg-sky-100 text-sky-700 dark:bg-sky-900/35 dark:text-sky-200';
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-200';
}

function getRetrievability(topic: Topic, fsrsConfig: FSRSConfig): number | null {
  if (topic.fsrsStability <= 0 || !topic.fsrsLastReview) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastReview = new Date(topic.fsrsLastReview + 'T00:00:00');
  const elapsedDays = Math.max(0, Math.floor((today.getTime() - lastReview.getTime()) / 86400000));
  return calculateRetrievabilityWithConfig(topic.fsrsStability, elapsedDays, fsrsConfig);
}

function getRecoveryWave(retrievability: number | null): RecoveryWave {
  if (retrievability === null) return 'later';
  if (retrievability < 0.5) return 'critical';
  if (retrievability < 0.7) return 'second';
  return 'later';
}

function getActiveTopics(subjects: Subject[]): ActiveTopicItem[] {
  const items: ActiveTopicItem[] = [];
  for (const subject of subjects) {
    for (const group of subject.topicGroups) {
      for (const topic of group.topics) {
        if (!topic.studied) continue;
        if (topic.reviewHistory.length === 0 && !topic.fsrsNextReview) continue;
        items.push({
          subjectId: subject.id,
          subjectName: subject.name,
          subjectEmoji: subject.emoji,
          subjectColor: subject.color,
          groupId: group.id,
          groupName: group.name,
          topic,
        });
      }
    }
  }
  return items;
}

// ─── Stat Card ────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, accent }: {
  icon: ElementType;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm border border-slate-100">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

// ─── Recovery Wave Badge ────────────────────────────────────
function WaveBadge({ wave }: { wave: RecoveryWave }) {
  const config: Record<RecoveryWave, { bg: string; label: string }> = {
    critical: { bg: 'bg-rose-100 text-rose-700', label: 'Crítico' },
    second: { bg: 'bg-amber-100 text-amber-700', label: 'Atenção' },
    later: { bg: 'bg-sky-100 text-sky-700', label: 'Estável' },
  };
  const c = config[wave];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.bg}`}>{c.label}</span>;
}

// ─── Review History Timeline ────────────────────────────────
const ReviewHistoryTimeline = memo(function ReviewHistoryTimeline({ reviews }: { reviews: ReviewEntry[] }) {
  return (
    <div className="mt-3 space-y-2 pl-3 border-l-2 border-indigo-200">
      {reviews.map((rev) => {
        const opt = RATING_OPTIONS.find(r => r.value === rev.rating);
        return (
          <div key={rev.id} className={`rounded-lg p-3 border ${opt?.borderColor ?? 'border-slate-200'} ${opt?.lightBg ?? 'bg-slate-50'}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded-full text-white font-semibold ${opt?.color ?? 'bg-slate-500'}`}>
                #{rev.reviewNumber}
              </span>
              <span className="text-[11px] text-slate-500">{formatDate(rev.date)}</span>
              <span className="text-sm">{opt?.emoji}</span>
              <span className={`text-[11px] font-medium ${opt?.textColor ?? 'text-slate-700'}`}>{rev.ratingLabel}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500">
              <span>Dif: {rev.difficultyBefore.toFixed(1)} → <strong>{rev.difficultyAfter.toFixed(1)}</strong></span>
              <span>Estab: {rev.stabilityBefore.toFixed(1)} → <strong>{rev.stabilityAfter.toFixed(1)}</strong></span>
              <span>Intervalo: <strong>{rev.intervalDays}d</strong></span>
              {rev.retrievability !== null && <span>Ret: <strong>{formatPercent(rev.retrievability)}</strong></span>}
              {rev.performanceScore !== null && <span>Desemp: <strong>{formatPercent(rev.performanceScore)}</strong></span>}
            </div>
          </div>
        );
      })}
    </div>
  );
});

// ─── Due Review Card ────────────────────────────────────────
function DueReviewCard({
  item,
  isActive,
  historyExpanded,
  onToggleActive,
  onToggleHistory,
  onRate,
  onOpenSubject,
}: {
  item: DueReviewItemWithMeta;
  isActive: boolean;
  historyExpanded: boolean;
  onToggleActive: () => void;
  onToggleHistory: () => void;
  onRate: (rating: FSRSRating) => void;
  onOpenSubject: (subjectId: string) => void;
}) {
  const mastery = getMasteryScore(item.topic);
  const masteryColor = getMasteryColor(mastery.score);
  const diffLabel = getDifficultyLabel(item.topic.fsrsDifficulty);

  const borderAccent =
    item.wave === 'critical' ? 'border-l-rose-400' :
    item.wave === 'second' ? 'border-l-amber-400' : 'border-l-sky-400';

  return (
    <div className={`rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden border-l-4 ${borderAccent}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Subject badge */}
          <button
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm shadow-sm"
            style={{ backgroundColor: item.subjectColor, color: '#fff' }}
            onClick={() => onOpenSubject(item.subjectId)}
            title={`Abrir ${item.subjectName}`}
          >
            {item.subjectEmoji}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm font-semibold text-slate-800 truncate">{item.topic.name}</h3>
              {item.daysOverdue > 0 ? (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600 border border-rose-100">
                  {item.daysOverdue}d atrasada
                </span>
              ) : (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 border border-indigo-100">
                  Hoje
                </span>
              )}
              <WaveBadge wave={item.wave} />
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${masteryColor}`}>
                {mastery.score}% {mastery.label}
              </span>
            </div>

            <p className="mt-1 text-[11px] text-slate-400">
              {item.subjectName} / {item.groupName}
              {item.topic.reviewHistory.length > 0 && (
                <span className="ml-1.5">· Rev. #{item.topic.reviewHistory.length + 1}</span>
              )}
            </p>

            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
              {item.topic.questionsTotal > 0 && (
                <span className="flex items-center gap-1">
                  <Target size={11} />
                  {item.topic.questionsCorrect}/{item.topic.questionsTotal} ({formatPercent(item.topic.questionsCorrect / item.topic.questionsTotal)})
                </span>
              )}
              {item.topic.fsrsStability > 0 && (
                <span className="flex items-center gap-1">
                  <TrendingUp size={11} />
                  Estab: {item.topic.fsrsStability.toFixed(1)}
                </span>
              )}
              <span className={`flex items-center gap-1 ${diffLabel.color}`}>
                <BarChart3 size={11} />
                Dif: {item.topic.fsrsDifficulty.toFixed(1)} ({diffLabel.text})
              </span>
              {item.retrievability !== null && (
                <span className="flex items-center gap-1">
                  <Brain size={11} />
                  Ret: {formatPercent(item.retrievability)}
                </span>
              )}
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={onToggleActive}
            className={`shrink-0 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              isActive
                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm shadow-indigo-200'
            }`}
          >
            {isActive ? 'Cancelar' : 'Revisar'}
          </button>
        </div>

        {/* Rating panel */}
        {isActive && (
          <div className="mt-4 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 p-4 border border-indigo-100">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-700">
              <Zap size={16} />
              Como foi a revisão?
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RATING_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onRate(opt.value)}
                  className={`rounded-xl px-3 py-3 text-white font-medium transition-all hover:scale-[1.03] active:scale-[0.97] shadow-sm ${opt.color} ${opt.hoverColor}`}
                >
                  <span className="block text-xl">{opt.emoji}</span>
                  <span className="block mt-1 text-xs">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* History toggle */}
        {item.topic.reviewHistory.length > 0 && (
          <div className="mt-3">
            <button
              onClick={onToggleHistory}
              className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-600 transition-colors font-medium"
            >
              {historyExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <History size={13} />
              Histórico ({item.topic.reviewHistory.length})
            </button>
            {historyExpanded && <ReviewHistoryTimeline reviews={item.topic.reviewHistory} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Upcoming Review Row ────────────────────────────────────
function UpcomingRow({ item, onOpenSubject }: {
  item: UpcomingReviewItem;
  onOpenSubject: (subjectId: string) => void;
}) {
  const badgeColor = item.daysUntil <= 1
    ? 'bg-amber-100 text-amber-700 border-amber-200'
    : item.daysUntil <= 3
      ? 'bg-sky-50 text-sky-600 border-sky-100'
      : 'bg-slate-50 text-slate-500 border-slate-100';

  return (
    <button
      type="button"
      onClick={() => onOpenSubject(item.subjectId)}
      className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors group"
    >
      <span className="text-base">{item.subjectEmoji}</span>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-slate-700">{item.topic.name}</p>
        <p className="truncate text-[11px] text-slate-400">
          {item.subjectName} / {item.groupName}
        </p>
      </div>
      <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${badgeColor}`}>
        {item.daysUntil === 1 ? 'Amanhã' : `${item.daysUntil} dias`}
      </span>
      <ArrowRight size={14} className="shrink-0 text-slate-300 group-hover:text-indigo-400 transition-colors" />
    </button>
  );
}

// ─── Section Wrapper ────────────────────────────────────────
function Section({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden ${className}`}>
      {children}
    </section>
  );
}

function SectionHeader({ icon: Icon, title, count, accent, children }: {
  icon: ElementType;
  title: string;
  count?: number;
  accent: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
      <div className="flex items-center gap-2.5">
        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${accent}`}>
          <Icon size={14} className="text-white" />
        </div>
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {count !== undefined && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────
export function ReviewSystem({
  subjects,
  fsrsConfig,
  onUpdateFsrsConfig,
  onUpdateSubject,
  onNavigateToSubject,
}: ReviewSystemProps) {
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [showConfig, setShowConfig] = useState(false);
  const normalizedFsrsConfig = useMemo(() => normalizeFSRSConfig(fsrsConfig), [fsrsConfig]);
  const retentionPercent = Math.round(normalizedFsrsConfig.requestedRetention * 100);

  // Derived data
  const reviewsDue = useMemo<DueReviewItemWithMeta[]>(() => {
    let due = getReviewsDue(subjects);
    if (subjectFilter !== 'all') due = due.filter(d => d.subjectId === subjectFilter);
    if (searchFilter.trim()) {
      const tokens = searchFilter.toLowerCase().split(/\s+/).filter(Boolean);
      due = due.filter(d => {
        const hay = `${d.topic.name} ${d.subjectName} ${d.groupName}`.toLowerCase();
        return tokens.every(t => hay.includes(t));
      });
    }
    return due.map(d => ({
      ...d,
      retrievability: getRetrievability(d.topic, normalizedFsrsConfig),
      wave: getRecoveryWave(getRetrievability(d.topic, normalizedFsrsConfig)),
    }));
  }, [subjects, subjectFilter, searchFilter, normalizedFsrsConfig]);

  const upcoming = useMemo<UpcomingReviewItem[]>(() => {
    let u = getUpcomingReviews(subjects);
    if (subjectFilter !== 'all') u = u.filter(d => d.subjectId === subjectFilter);
    if (searchFilter.trim()) {
      const tokens = searchFilter.toLowerCase().split(/\s+/).filter(Boolean);
      u = u.filter(d => {
        const hay = `${d.topic.name} ${d.subjectName} ${d.groupName}`.toLowerCase();
        return tokens.every(t => hay.includes(t));
      });
    }
    return u.slice(0, 20).map(item => ({
      ...item,
      daysUntil: Math.abs(item.daysOverdue),
    }));
  }, [subjects, subjectFilter, searchFilter]);

  const activeTopics = useMemo(() => {
    let a = getActiveTopics(subjects);
    if (subjectFilter !== 'all') a = a.filter(d => d.subjectId === subjectFilter);
    if (searchFilter.trim()) {
      const tokens = searchFilter.toLowerCase().split(/\s+/).filter(Boolean);
      a = a.filter(d => {
        const hay = `${d.topic.name} ${d.subjectName} ${d.groupName}`.toLowerCase();
        return tokens.every(t => hay.includes(t));
      });
    }
    return a;
  }, [subjects, subjectFilter, searchFilter]);

  const activeSubjectsSummary = useMemo(() => {
    const bySubject = new Map<string, { subjectId: string; name: string; emoji: string; color: string; count: number }>();
    for (const item of activeTopics) {
      const current = bySubject.get(item.subjectId);
      if (current) {
        current.count += 1;
        continue;
      }
      bySubject.set(item.subjectId, {
        subjectId: item.subjectId,
        name: item.subjectName,
        emoji: item.subjectEmoji,
        color: item.subjectColor,
        count: 1,
      });
    }
    return Array.from(bySubject.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
  }, [activeTopics]);

  const recoverySummary = useMemo(() => ({
    critical: reviewsDue.filter(d => d.wave === 'critical').length,
    attention: reviewsDue.filter(d => d.wave === 'second').length,
    stable: reviewsDue.filter(d => d.wave === 'later').length,
  }), [reviewsDue]);

  const toggleHistory = useCallback((key: string) => {
    setExpandedHistory(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const hasFilters = searchFilter.trim() !== '' || subjectFilter !== 'all';

  const handleRateTopic = useCallback((item: DueReviewItemWithMeta, rating: FSRSRating) => {
    const subject = subjects.find(s => s.id === item.subjectId);
    if (!subject) return;
    const group = subject.topicGroups.find(g => g.id === item.groupId);
    if (!group) return;
    const topic = group.topics.find(t => t.id === item.topic.id);
    if (!topic) return;

    const reviewResult = fsrsReview({
      difficulty: topic.fsrsDifficulty,
      stability: topic.fsrsStability,
      lastReview: topic.fsrsLastReview,
      nextReview: topic.fsrsNextReview,
    }, rating, normalizedFsrsConfig);

    const ratingMeta = RATING_OPTIONS.find(opt => opt.value === rating);
    const now = reviewResult.newState.lastReview ?? toDateOnlyString(new Date());
    const performanceScore = topic.questionsTotal > 0
      ? topic.questionsCorrect / topic.questionsTotal
      : null;

    const entry: ReviewEntry = {
      id: generateReviewId(),
      reviewNumber: topic.reviewHistory.length + 1,
      date: now,
      rating,
      ratingLabel: ratingMeta?.label ?? 'Bom',
      difficultyBefore: topic.fsrsDifficulty,
      difficultyAfter: reviewResult.newState.difficulty,
      stabilityBefore: topic.fsrsStability,
      stabilityAfter: reviewResult.newState.stability,
      intervalDays: reviewResult.intervalDays,
      scheduledDays: reviewResult.scheduledDays,
      retrievability: reviewResult.retrievability,
      performanceScore,
      questionsTotal: topic.questionsTotal,
      questionsCorrect: topic.questionsCorrect,
      algorithmVersion: normalizedFsrsConfig.version,
      requestedRetention: normalizedFsrsConfig.requestedRetention,
      usedCustomWeights: normalizedFsrsConfig.customWeights !== null,
    };

    const updatedSubject: Subject = {
      ...subject,
      topicGroups: subject.topicGroups.map(topicGroup => (
        topicGroup.id !== group.id
          ? topicGroup
          : {
              ...topicGroup,
              topics: topicGroup.topics.map(topicItem => (
                topicItem.id !== topic.id
                  ? topicItem
                  : {
                      ...topicItem,
                      studied: true,
                      fsrsDifficulty: reviewResult.newState.difficulty,
                      fsrsStability: reviewResult.newState.stability,
                      fsrsLastReview: reviewResult.newState.lastReview,
                      fsrsNextReview: reviewResult.newState.nextReview,
                      reviewHistory: [...topicItem.reviewHistory, entry],
                    }
              )),
            }
      )),
    };
    onUpdateSubject(updatedSubject);
    setActiveTopicId(null);
  }, [normalizedFsrsConfig, onUpdateSubject, subjects]);

  return (
    <div className="review-system min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/20">
      <div className="mx-auto max-w-5xl px-4 py-6 pb-24 lg:pb-8 space-y-5">

        {/* ─── Header ──────────────────────────── */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500 p-6 shadow-lg shadow-indigo-200/50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <Brain size={22} className="text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Sistema de Revisões</h1>
                  <p className="text-xs text-indigo-200">{normalizedFsrsConfig.version === 'fsrs6' ? 'FSRS v6' : 'FSRS v5'} · Retenção alvo {retentionPercent}%</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowConfig(v => !v)}
              className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-xs font-medium text-white backdrop-blur-sm hover:bg-white/25 transition-colors"
            >
              <Settings size={14} />
              Configurações
            </button>
          </div>
        </div>

        {/* ─── Stats Row ───────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={BookOpen} label="Ativos" value={activeTopics.length} accent="bg-indigo-500" />
          <StatCard icon={AlertTriangle} label="Pendentes" value={reviewsDue.length} accent="bg-rose-500" />
          <StatCard icon={Clock} label="Próximas" value={upcoming.length} accent="bg-amber-500" />
          <StatCard icon={Target} label="Retenção" value={`${retentionPercent}%`} accent="bg-emerald-500" />
        </div>

        {/* ─── FSRS Config (collapsible) ─────── */}
        {showConfig && (
          <Section>
            <SectionHeader icon={Settings} title="Configuração FSRS" accent="bg-slate-600">
              <button onClick={() => setShowConfig(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </SectionHeader>
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium text-slate-600">Versão:</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onUpdateFsrsConfig(normalizeFSRSConfig({ ...normalizedFsrsConfig, version: 'fsrs5', customWeights: null }))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${normalizedFsrsConfig.version === 'fsrs5' ? 'bg-indigo-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}
                  >
                    FSRS-5
                  </button>
                  <button
                    onClick={() => onUpdateFsrsConfig(normalizeFSRSConfig({ ...normalizedFsrsConfig, version: 'fsrs6', customWeights: null }))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${normalizedFsrsConfig.version === 'fsrs6' ? 'bg-indigo-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}
                  >
                    FSRS-6
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Retenção alvo</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={70}
                    max={99}
                    value={retentionPercent}
                    onChange={e => onUpdateFsrsConfig(normalizeFSRSConfig({
                      ...normalizedFsrsConfig,
                      requestedRetention: Number(e.target.value) / 100,
                    }))}
                    className="h-2 flex-1 accent-indigo-500 cursor-pointer"
                  />
                  <span className="rounded-lg bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-700 border border-indigo-100">{retentionPercent}%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Pesos personalizados</label>
                <textarea
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 resize-none"
                  placeholder="0.40, 1.18, 3.00, 15.69..."
                  defaultValue=""
                />
                <div className="flex gap-2 mt-2">
                  <button
                    disabled
                    className="rounded-lg bg-indigo-500/60 px-3 py-1.5 text-xs font-medium text-white/90 cursor-not-allowed"
                  >
                    Aplicar
                  </button>
                  <button
                    onClick={() => onUpdateFsrsConfig(normalizeFSRSConfig({ ...normalizedFsrsConfig, customWeights: null }))}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    Usar padrão
                  </button>
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* ─── Filters ─────────────────────────── */}
        <Section>
          <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={15} className="text-indigo-400" />
              <span className="text-sm font-semibold text-slate-600">Filtros</span>
            </div>

            <div className="flex flex-1 items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 min-w-[200px]">
              <Search size={14} className="text-slate-400" />
              <input
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Buscar assunto..."
                className="flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
              />
              {searchFilter && (
                <button onClick={() => setSearchFilter('')} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>

            <select
              value={subjectFilter}
              onChange={e => setSubjectFilter(e.target.value)}
              className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
            >
              <option value="all">Todas disciplinas</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
              ))}
            </select>

            {hasFilters && (
              <button
                onClick={() => { setSearchFilter(''); setSubjectFilter('all'); }}
                className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-200 transition-colors"
              >
                Limpar
              </button>
            )}
          </div>
        </Section>

        {/* ─── Pending Reviews ─────────────────── */}
        {reviewsDue.length > 0 ? (
          <Section>
            <SectionHeader icon={AlertTriangle} title="Revisões Pendentes" count={reviewsDue.length} accent="bg-rose-500">
              {/* Recovery summary pills */}
              <div className="flex items-center gap-1.5 text-[10px]">
                {recoverySummary.critical > 0 && (
                  <span className="rounded-full bg-rose-50 border border-rose-100 px-2 py-0.5 text-rose-600 font-semibold">
                    {recoverySummary.critical} críticos
                  </span>
                )}
                {recoverySummary.attention > 0 && (
                  <span className="rounded-full bg-amber-50 border border-amber-100 px-2 py-0.5 text-amber-600 font-semibold">
                    {recoverySummary.attention} atenção
                  </span>
                )}
                {recoverySummary.stable > 0 && (
                  <span className="rounded-full bg-sky-50 border border-sky-100 px-2 py-0.5 text-sky-600 font-semibold">
                    {recoverySummary.stable} estáveis
                  </span>
                )}
              </div>
            </SectionHeader>
            <div className="p-4 space-y-3">
              {reviewsDue.map((item, i) => (
                <DueReviewCard
                  key={`due-${item.topic.id}-${i}`}
                  item={item}
                  isActive={activeTopicId === item.topic.id}
                  historyExpanded={expandedHistory.has(item.topic.id)}
                  onToggleActive={() => setActiveTopicId(prev => prev === item.topic.id ? null : item.topic.id)}
                  onToggleHistory={() => toggleHistory(item.topic.id)}
                  onRate={(rating) => handleRateTopic(item, rating)}
                  onOpenSubject={onNavigateToSubject}
                />
              ))}
            </div>
          </Section>
        ) : (
          <Section>
            <div className="p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 size={24} className="text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                {hasFilters ? 'Nenhuma revisão encontrada' : 'Tudo em dia!'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {hasFilters ? 'Tente ajustar os filtros.' : 'Nenhuma revisão pendente no momento.'}
              </p>
            </div>
          </Section>
        )}

        {/* ─── Upcoming Reviews ────────────────── */}
        {upcoming.length > 0 && (
          <Section>
            <SectionHeader icon={CalendarDays} title="Próximas Revisões" count={upcoming.length} accent="bg-amber-500" />
            <div className="divide-y divide-slate-50">
              {upcoming.map(item => (
                <UpcomingRow key={item.topic.id} item={item} onOpenSubject={onNavigateToSubject} />
              ))}
            </div>
          </Section>
        )}

        {/* ─── Active Topics Summary ───────────── */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-violet-100 dark:border-violet-900/40 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-violet-50 dark:border-violet-900/30 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/30 dark:to-purple-900/20">
            <h2 className="font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <BookOpen size={18} className="text-violet-500" />
              Assuntos Ativos
              <span className="ml-2 text-xs font-normal text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {activeTopics.length} no total
              </span>
            </h2>
          </div>

          <div className="p-5">
            {activeSubjectsSummary.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm font-medium text-slate-500">Nenhum assunto com revisão ativa.</p>
                <p className="mt-1 text-xs text-slate-400">Marque assuntos como estudados para começar.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeSubjectsSummary.map((subject) => (
                  <button
                    key={subject.subjectId}
                    onClick={() => onNavigateToSubject(subject.subjectId)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-slate-800 hover:border-violet-200 dark:hover:border-violet-700/60 hover:bg-violet-50/30 dark:hover:bg-violet-900/20 transition-colors cursor-pointer w-full text-left"
                    type="button"
                  >
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center text-lg"
                      style={{ backgroundColor: `${subject.color}15` }}
                    >
                      {subject.emoji}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-slate-100">{subject.name}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{subject.count} tópicos em revisão</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 dark:text-slate-500" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}

