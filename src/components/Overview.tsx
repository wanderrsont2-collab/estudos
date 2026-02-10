import { useMemo } from 'react';
import { Subject, WeeklySchedule, EssayEntry, StudyGoals } from '../types';
import {
  getOverallStats,
  getSubjectStats,
  getUpcomingDeadlines,
  getPriorityStats,
  getDeadlineInfo,
  getReviewsDue,
} from '../store';
import { getReviewStatus } from '../fsrs';
import { ScheduleWidget } from './ScheduleWidget';
import {
  AlertTriangle,
  Brain,
  Target,
  TrendingUp,
  Flame,
  CheckCircle2,
  LineChart,
} from 'lucide-react';

interface OverviewProps {
  subjects: Subject[];
  schedule: WeeklySchedule;
  goals: StudyGoals;
  essays: EssayEntry[];
  onUpdateSchedule: (schedule: WeeklySchedule) => void;
  onUpdateGoals: (goals: StudyGoals) => void;
  onSelectSubject: (id: string) => void;
  onOpenReviews: () => void;
}

function formatPercent(v: number) {
  return `${Math.round(v * 100)}%`;
}

function toIsoDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


function clampGoalValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

interface ActivityDay {
  date: string;
  questionsMade: number;
  questionsCorrect: number;
  total: number;
}

function ensureActivityDay(map: Map<string, ActivityDay>, date: string): ActivityDay {
  const existing = map.get(date);
  if (existing) return existing;
  const created: ActivityDay = { date, questionsMade: 0, questionsCorrect: 0, total: 0 };
  map.set(date, created);
  return created;
}

export function Overview({
  subjects,
  schedule,
  goals,
  essays,
  onUpdateSchedule,
  onUpdateGoals,
  onSelectSubject,
  onOpenReviews,
}: OverviewProps) {
  const overall = getOverallStats(subjects);
  const deadlines = getUpcomingDeadlines(subjects);
  const priorityStats = getPriorityStats(subjects);
  const reviewsDue = getReviewsDue(subjects);

  const overdueDeadlines = deadlines.filter(item => getDeadlineInfo(item.topic.deadline)?.urgency === 'overdue');
  const upcomingDeadlines = deadlines
    .filter(item => {
      const info = getDeadlineInfo(item.topic.deadline);
      return info && info.urgency !== 'overdue';
    })
    .slice(0, 8);

  const sortedSubjects = [...subjects]
    .map(subject => ({
      subject,
      stats: getSubjectStats(subject),
    }))
    .sort((a, b) => b.stats.progresso - a.stats.progresso);


  const activityMap = useMemo(() => {
    const nextMap = new Map<string, ActivityDay>();
    const todayIso = toIsoDateLocal(new Date());

    for (const subject of subjects) {
      for (const group of subject.topicGroups) {
        for (const topic of group.topics) {
          const logs = topic.questionLogs ?? [];
          if (logs.length > 0) {
            for (const log of logs) {
              if (!/^\d{4}-\d{2}-\d{2}$/.test(log.date)) continue;
              const day = ensureActivityDay(nextMap, log.date);
              day.questionsMade += Math.max(0, log.questionsMade);
              day.questionsCorrect += Math.max(0, log.questionsCorrect);
            }
            continue;
          }

          // Backward-compatible fallback para dados antigos sem histórico diário.
          if (topic.reviewHistory.length > 0) {
            const sortedReviews = [...topic.reviewHistory].sort((a, b) => (a.date < b.date ? -1 : 1));
            let previousTotal = 0;
            let previousCorrect = 0;
            for (const review of sortedReviews) {
              if (!/^\d{4}-\d{2}-\d{2}$/.test(review.date)) continue;
              const deltaMade = Math.max(0, review.questionsTotal - previousTotal);
              const deltaCorrect = Math.max(0, review.questionsCorrect - previousCorrect);
              const day = ensureActivityDay(nextMap, review.date);
              day.questionsMade += deltaMade;
              day.questionsCorrect += deltaCorrect;
              previousTotal = Math.max(previousTotal, review.questionsTotal);
              previousCorrect = Math.max(previousCorrect, review.questionsCorrect);
            }
            continue;
          }

          if (topic.questionsTotal > 0) {
            const fallbackDate = topic.dateStudied && /^\d{4}-\d{2}-\d{2}/.test(topic.dateStudied)
              ? topic.dateStudied.slice(0, 10)
              : todayIso;
            const day = ensureActivityDay(nextMap, fallbackDate);
            day.questionsMade += topic.questionsTotal;
            day.questionsCorrect += topic.questionsCorrect;
          }
        }
      }
    }

    nextMap.forEach(day => {
      day.total = day.questionsMade;
    });
    return nextMap;
  }, [subjects]);

  const evolutionDays = useMemo(() => {
    const list: ActivityDay[] = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let offset = 13; offset >= 0; offset--) {
      const dayDate = new Date(base);
      dayDate.setDate(base.getDate() - offset);
      const date = toIsoDateLocal(dayDate);
      const found = activityMap.get(date);
      list.push(found ? { ...found } : { date, questionsMade: 0, questionsCorrect: 0, total: 0 });
    }
    return list;
  }, [activityMap]);

  const last14Total = evolutionDays.reduce((sum, day) => sum + day.total, 0);
  const previous14Total = useMemo(() => {
    let total = 0;
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let offset = 27; offset >= 14; offset--) {
      const dayDate = new Date(base);
      dayDate.setDate(base.getDate() - offset);
      const date = toIsoDateLocal(dayDate);
      total += activityMap.get(date)?.total ?? 0;
    }
    return total;
  }, [activityMap]);
  const evolutionTrend = previous14Total > 0
    ? (last14Total - previous14Total) / previous14Total
    : (last14Total > 0 ? 1 : 0);

  const streakInfo = useMemo(() => {
    const activeDays = Array.from(activityMap.values())
      .filter(day => day.total > 0)
      .map(day => day.date);
    const activeSet = new Set(activeDays);

    let current = 0;
    const walker = new Date();
    walker.setHours(0, 0, 0, 0);
    while (activeSet.has(toIsoDateLocal(walker))) {
      current += 1;
      walker.setDate(walker.getDate() - 1);
    }

    const ordered = activeDays.sort();
    let longest = 0;
    let running = 0;
    let previousDate: string | null = null;
    for (const date of ordered) {
      if (!previousDate) {
        running = 1;
      } else {
        const prev = new Date(previousDate + 'T00:00:00');
        prev.setDate(prev.getDate() + 1);
        running = toIsoDateLocal(prev) === date ? running + 1 : 1;
      }
      longest = Math.max(longest, running);
      previousDate = date;
    }
    return { current, longest, activeDays: activeDays.length };
  }, [activityMap]);

  const todayIso = toIsoDateLocal(new Date());
  const todayActivity = activityMap.get(todayIso) ?? { date: todayIso, questionsMade: 0, questionsCorrect: 0, total: 0 };
  const weeklyActivityDays = evolutionDays.slice(-7);
  const weeklyQuestionsMade = weeklyActivityDays.reduce((sum, day) => sum + day.questionsMade, 0);
  const weeklyReviews = useMemo(() => {
    const weeklyDates = new Set(weeklyActivityDays.map(day => day.date));
    let total = 0;
    for (const subject of subjects) {
      for (const group of subject.topicGroups) {
        for (const topic of group.topics) {
          total += topic.reviewHistory.filter(review => weeklyDates.has(review.date)).length;
        }
      }
    }
    return total;
  }, [subjects, weeklyActivityDays]);
  const weeklyEssays = useMemo(() => {
    const weeklyDates = new Set(weeklyActivityDays.map(day => day.date));
    return essays.filter(essay => weeklyDates.has(essay.date)).length;
  }, [essays, weeklyActivityDays]);


  function updateGoal<K extends keyof StudyGoals>(key: K, value: number) {
    const nextGoals: StudyGoals = {
      ...goals,
      [key]:
        key === 'dailyQuestionsTarget'
          ? clampGoalValue(value, 1, 200)
          : key === 'weeklyReviewTarget'
            ? clampGoalValue(value, 1, 100)
            : clampGoalValue(value, 1, 14),
    };
    onUpdateGoals(nextGoals);
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <section className="rounded-3xl overflow-hidden bg-gradient-to-r from-cyan-900 via-slate-900 to-blue-900 text-white shadow-xl">
        <div className="px-5 md:px-7 py-6 md:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80 mb-2">Painel Central</p>
              <h1 className="text-2xl md:text-3xl font-extrabold leading-tight">Visão Geral + Cronograma Semanal</h1>
              <p className="text-sm text-slate-200 mt-1">Resumo rápido das disciplinas e sua planilha de segunda a domingo no mesmo lugar.</p>
            </div>
            <button
              onClick={onOpenReviews}
              className="rounded-xl bg-white/15 hover:bg-white/25 transition-colors px-4 py-2 text-sm font-medium inline-flex items-center gap-2"
            >
              <Brain size={16} /> Revisões pendentes
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-2xl bg-white/10 p-3 border border-white/15">
              <p className="text-[11px] uppercase tracking-wide text-cyan-200">Conteúdos</p>
              <p className="text-2xl font-bold mt-1">{overall.studiedTopics}/{overall.totalTopics}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 border border-white/15">
              <p className="text-[11px] uppercase tracking-wide text-cyan-200">Progresso</p>
              <p className="text-2xl font-bold mt-1">{formatPercent(overall.progresso)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 border border-white/15">
              <p className="text-[11px] uppercase tracking-wide text-cyan-200">Rendimento</p>
              <p className="text-2xl font-bold mt-1">{formatPercent(overall.rendimento)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 border border-white/15">
              <p className="text-[11px] uppercase tracking-wide text-cyan-200">Pendências FSRS</p>
              <p className="text-2xl font-bold mt-1">{overall.reviewsDue}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 border border-white/15">
              <p className="text-[11px] uppercase tracking-wide text-cyan-200">Questões</p>
              <p className="text-2xl font-bold mt-1">{overall.questionsCorrect}/{overall.questionsTotal}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-5">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-sm p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-100 inline-flex items-center gap-2">
              <LineChart size={16} /> Dashboard de evolução real (14 dias)
            </h2>
            <span className={`text-xs px-2 py-1 rounded-full ${
              evolutionTrend >= 0
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200'
            }`}>
              {evolutionTrend >= 0 ? '+' : ''}{Math.round(evolutionTrend * 100)}% vs 14 dias anteriores
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Questões feitas (14d)</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-0.5">{last14Total}</p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Questões hoje</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-0.5">{todayActivity.questionsMade}</p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Média diária (14d)</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-0.5">{Math.round(last14Total / 14)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Taxa de acerto (14d)</p>
              <p className="text-xl font-bold text-violet-600 mt-0.5">
                {last14Total > 0 ? `${Math.round((evolutionDays.reduce((sum, day) => sum + day.questionsCorrect, 0) / last14Total) * 100)}%` : '--'}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="h-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-3 py-2">
              <div className="h-full grid grid-cols-14 gap-1 items-end">
                {evolutionDays.map(day => {
                  const max = Math.max(...evolutionDays.map(item => item.questionsMade), 1);
                  const barHeight = Math.max(6, Math.round((day.questionsMade / max) * 100));
                  return (
                    <div key={day.date} className="flex flex-col items-center justify-end gap-1">
                      <div
                        className={`w-full rounded-t transition-all ${
                          day.questionsMade > 0 ? 'bg-cyan-500 dark:bg-cyan-400' : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                        style={{ height: `${barHeight}%` }}
                        title={`${new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR')}: ${day.questionsMade} questões feitas`}
                      />
                      <span className="text-[9px] text-slate-500 dark:text-slate-400">{new Date(day.date + 'T00:00:00').getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-100 inline-flex items-center gap-2">
            <Flame size={16} /> Metas e streaks
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ajuste suas metas e acompanhe progresso real com base em estudo, revisões FSRS e redações.
          </p>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Questões feitas na última semana: <strong>{weeklyQuestionsMade}</strong>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 px-2.5 py-2 text-xs text-orange-700 dark:text-orange-200">
              Streak atual: <strong>{streakInfo.current}</strong> dia(s)
            </div>
            <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 px-2.5 py-2 text-xs text-violet-700 dark:text-violet-200">
              Maior streak: <strong>{streakInfo.longest}</strong> dia(s)
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-600 dark:text-slate-300">Meta diária de questões feitas</span>
                <span className="text-slate-500">{todayActivity.questionsMade}/{goals.dailyQuestionsTarget}</span>
              </div>
              <input
                type="number"
                min={1}
                max={200}
                value={goals.dailyQuestionsTarget}
                onChange={event => updateGoal('dailyQuestionsTarget', Number(event.target.value))}
                className="mt-2 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs"
              />
              <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${Math.min(100, (todayActivity.questionsMade / goals.dailyQuestionsTarget) * 100)}%` }} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-600 dark:text-slate-300">Meta semanal de revisões</span>
                <span className="text-slate-500">{weeklyReviews}/{goals.weeklyReviewTarget}</span>
              </div>
              <input
                type="number"
                min={1}
                max={100}
                value={goals.weeklyReviewTarget}
                onChange={event => updateGoal('weeklyReviewTarget', Number(event.target.value))}
                className="mt-2 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs"
              />
              <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-2 rounded-full bg-violet-500" style={{ width: `${Math.min(100, (weeklyReviews / goals.weeklyReviewTarget) * 100)}%` }} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-600 dark:text-slate-300">Meta semanal de redações</span>
                <span className="text-slate-500">{weeklyEssays}/{goals.weeklyEssayTarget}</span>
              </div>
              <input
                type="number"
                min={1}
                max={14}
                value={goals.weeklyEssayTarget}
                onChange={event => updateGoal('weeklyEssayTarget', Number(event.target.value))}
                className="mt-2 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs"
              />
              <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (weeklyEssays / goals.weeklyEssayTarget) * 100)}%` }} />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-200 inline-flex items-center gap-2">
            <CheckCircle2 size={14} />
            Dias ativos no histórico: {streakInfo.activeDays}
          </div>
        </div>
      </section>

      {(overdueDeadlines.length > 0 || reviewsDue.length > 0) && (
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
              <AlertTriangle size={16} /> Prazos vencidos ({overdueDeadlines.length})
            </div>
            {overdueDeadlines.length === 0 ? (
              <p className="text-xs text-red-500 mt-2">Nenhum prazo vencido no momento.</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {overdueDeadlines.slice(0, 5).map(item => {
                  const subject = subjects.find(s => s.name === item.subjectName);
                  return (
                    <button
                      key={item.topic.id}
                      onClick={() => subject && onSelectSubject(subject.id)}
                      className="block w-full text-left text-xs text-red-700 bg-white/70 hover:bg-white px-2 py-1.5 rounded-lg transition-colors"
                    >
                      {item.subjectEmoji} {item.topic.name} ({item.groupName})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-indigo-700 font-semibold text-sm">
                <Brain size={16} /> Revisões pendentes ({reviewsDue.length})
              </div>
              <button
                onClick={onOpenReviews}
                className="text-xs rounded-md bg-indigo-600 text-white px-2.5 py-1.5 hover:bg-indigo-700 transition-colors"
              >
                Abrir
              </button>
            </div>
            {reviewsDue.length === 0 ? (
              <p className="text-xs text-indigo-500 mt-2">Nenhuma revisão pendente.</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {reviewsDue.slice(0, 5).map(item => {
                  const status = getReviewStatus(item.topic.fsrsNextReview);
                  return (
                    <div key={item.topic.id} className="text-xs text-indigo-800 bg-white/70 px-2 py-1.5 rounded-lg flex items-center justify-between gap-2">
                      <span>{item.subjectEmoji} {item.topic.name}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${status.className}`}>{status.text}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.6fr] gap-5">
        <div className="space-y-5">
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 inline-flex items-center gap-2">
                <TrendingUp size={16} /> Desempenho por disciplina
              </h2>
              <span className="text-xs text-gray-400">{subjects.length} disciplinas</span>
            </div>
            <div className="divide-y divide-gray-100">
              {sortedSubjects.map(({ subject, stats }) => (
                <button
                  key={subject.id}
                  onClick={() => onSelectSubject(subject.id)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: subject.color }}>
                        {subject.emoji} {subject.name}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {stats.studied}/{stats.total} estudados - {stats.questionsCorrect}/{stats.questionsTotal} questões
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-700">{formatPercent(stats.progresso)}</p>
                      <p className="text-[11px] text-gray-400">{formatPercent(stats.rendimento)} rend.</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.min(stats.progresso * 100, 100)}%`, backgroundColor: subject.color }} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-700 inline-flex items-center gap-2">
              <Target size={16} /> Prioridades e prazos
            </h2>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-red-50 border border-red-100 p-2.5">
                <p className="text-red-700 font-medium">Alta prioridade</p>
                <p className="text-xl font-bold text-red-700 mt-0.5">{priorityStats.alta}</p>
              </div>
              <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-2.5">
                <p className="text-yellow-700 font-medium">Média prioridade</p>
                <p className="text-xl font-bold text-yellow-700 mt-0.5">{priorityStats.media}</p>
              </div>
              <div className="rounded-lg bg-green-50 border border-green-100 p-2.5">
                <p className="text-green-700 font-medium">Baixa prioridade</p>
                <p className="text-xl font-bold text-green-700 mt-0.5">{priorityStats.baixa}</p>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-2.5">
                <p className="text-gray-600 font-medium">Sem prioridade</p>
                <p className="text-xl font-bold text-gray-700 mt-0.5">{priorityStats.sem}</p>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Próximos prazos</h3>
              {upcomingDeadlines.length === 0 ? (
                <p className="text-xs text-gray-400">Nenhum prazo definido.</p>
              ) : (
                <div className="space-y-1.5">
                  {upcomingDeadlines.map(item => {
                    const info = getDeadlineInfo(item.topic.deadline);
                    const subject = subjects.find(s => s.name === item.subjectName);
                    return (
                      <button
                        key={item.topic.id}
                        onClick={() => subject && onSelectSubject(subject.id)}
                        className="w-full text-left text-xs rounded-lg border border-gray-100 hover:border-gray-200 px-2.5 py-2 bg-gray-50 hover:bg-white transition-colors flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{item.subjectEmoji} {item.topic.name}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${info?.className || 'text-gray-500 bg-gray-100'}`}>
                          {info?.text || '-'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <ScheduleWidget
          subjects={subjects}
          schedule={schedule}
          onUpdateSchedule={onUpdateSchedule}
        />
      </section>
    </div>
  );
}

