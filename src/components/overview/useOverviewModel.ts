import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EssayEntry, StudyGoals, StudySession, Subject } from '../../types';
import {
  getDeadlineInfo,
  getOverallStats,
  getPriorityStats,
  getReviewsDue,
  getSubjectStats,
  getUpcomingDeadlines,
} from '../../store';
import type {
  ActivityDay,
  CompletionEstimate,
  ConsistencyPanelMode,
  DeadlineDisplayItem,
  HeatmapDay,
  UpcomingReviewItem,
  WeeklyReviewDay,
} from './types';
import { formatPercent } from './utils';

type DeadlineInfo = NonNullable<ReturnType<typeof getDeadlineInfo>>;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function toIsoDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekStartMonday(baseDate: Date) {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);
  const weekday = start.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  start.setDate(start.getDate() + offset);
  return start;
}

function clampGoalValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function ensureActivityDay(map: Map<string, ActivityDay>, date: string): ActivityDay {
  const existing = map.get(date);
  if (existing) return existing;
  const created: ActivityDay = { date, questionsMade: 0, questionsCorrect: 0, total: 0 };
  map.set(date, created);
  return created;
}

function isAscendingByDate<T extends { date: string }>(items: readonly T[]): boolean {
  for (let i = 1; i < items.length; i += 1) {
    if (items[i - 1].date > items[i].date) return false;
  }
  return true;
}

function getEntriesSortedAsc<T extends { date: string }>(items: readonly T[]): readonly T[] {
  if (items.length < 2) return items;
  if (isAscendingByDate(items)) return items;
  return [...items].sort((a, b) => a.date.localeCompare(b.date));
}

interface UseOverviewModelParams {
  subjects: Subject[];
  essays: EssayEntry[];
  goals: StudyGoals;
  onUpdateGoals: (goals: StudyGoals) => void;
}

export function useOverviewModel({ subjects, essays, goals, onUpdateGoals }: UseOverviewModelParams) {
  const overall = useMemo(() => getOverallStats(subjects), [subjects]);
  const deadlines = useMemo(() => getUpcomingDeadlines(subjects), [subjects]);
  const priorityStats = useMemo(() => getPriorityStats(subjects), [subjects]);
  const reviewsDue = useMemo(() => getReviewsDue(subjects), [subjects]);

  const [consistencyPanelMode, setConsistencyPanelMode] = useState<ConsistencyPanelMode>('heatmap');
  const [todayIso, setTodayIso] = useState(() => toIsoDateLocal(new Date()));
  const [studySessions, setStudySessions] = useState<StudySession[]>(() => {
    try {
      const stored = window.localStorage.getItem('study-sessions');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const syncToday = () => {
      const nextIso = toIsoDateLocal(new Date());
      setTodayIso(prev => (prev === nextIso ? prev : nextIso));
    };
    syncToday();
    const intervalId = window.setInterval(syncToday, 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('study-sessions', JSON.stringify(studySessions));
    } catch {
      // quota exceeded or other error
    }
  }, [studySessions]);

  const { overdueDeadlines, upcomingDeadlines } = useMemo(() => {
    const overdue: DeadlineDisplayItem[] = [];
    const upcoming: DeadlineDisplayItem[] = [];
    for (const item of deadlines) {
      const info = getDeadlineInfo(item.topic.deadline);
      if (!info) continue;
      const enriched: DeadlineDisplayItem = {
        ...item,
        deadlineInfo: info as DeadlineInfo,
      };
      if (info.urgency === 'overdue') overdue.push(enriched);
      else upcoming.push(enriched);
    }
    return { overdueDeadlines: overdue, upcomingDeadlines: upcoming.slice(0, 8) };
  }, [deadlines]);

  const sortedSubjects = useMemo(
    () => [...subjects].map(subject => ({ subject, stats: getSubjectStats(subject) })).sort((a, b) => b.stats.progresso - a.stats.progresso),
    [subjects],
  );

  const weakSubjects = useMemo(
    () => sortedSubjects.filter(({ stats }) => stats.questionsTotal >= 10 && stats.rendimento < 0.6).sort((a, b) => a.stats.rendimento - b.stats.rendimento).slice(0, 3),
    [sortedSubjects],
  );

  const neglectedSubjects = useMemo(() => {
    const now = new Date(todayIso + 'T00:00:00').getTime();
    return subjects
      .map(subject => {
        let lastActivity = 0;
        for (const group of subject.topicGroups) {
          for (const topic of group.topics) {
            if (!topic.dateStudied) continue;
            const studiedTime = new Date(topic.dateStudied).getTime();
            if (!Number.isNaN(studiedTime) && studiedTime > lastActivity) lastActivity = studiedTime;
          }
        }
        const daysSince = lastActivity > 0 ? Math.floor((now - lastActivity) / 86400000) : Infinity;
        return { subject, daysSince };
      })
      .filter(item => item.daysSince > 7 && item.daysSince < Infinity)
      .sort((a, b) => b.daysSince - a.daysSince)
      .slice(0, 3);
  }, [subjects, todayIso]);

  const activityMap = useMemo(() => {
    const nextMap = new Map<string, ActivityDay>();
    const fallbackIso = todayIso;
    for (const subject of subjects) {
      for (const group of subject.topicGroups) {
        for (const topic of group.topics) {
          const safeTopicTotal = Math.max(0, topic.questionsTotal);
          const safeTopicCorrect = Math.max(0, Math.min(safeTopicTotal, topic.questionsCorrect));
          if (safeTopicTotal === 0) continue;

          const logs = topic.questionLogs ?? [];
          if (logs.length > 0) {
            let remainingMade = safeTopicTotal;
            let remainingCorrect = safeTopicCorrect;
            const orderedLogs = getEntriesSortedAsc(logs);

            // Prioritize latest logs so recent corrections/edits are reflected first.
            for (let idx = orderedLogs.length - 1; idx >= 0; idx -= 1) {
              const log = orderedLogs[idx];
              if (remainingMade <= 0 && remainingCorrect <= 0) break;
              if (!DATE_ONLY_RE.test(log.date)) continue;

              const madeInc = Math.min(remainingMade, Math.max(0, log.questionsMade));
              const correctInc = Math.min(
                remainingCorrect,
                madeInc,
                Math.max(0, log.questionsCorrect),
              );
              if (madeInc <= 0 && correctInc <= 0) continue;

              const day = ensureActivityDay(nextMap, log.date);
              day.questionsMade += madeInc;
              day.questionsCorrect += correctInc;

              remainingMade -= madeInc;
              remainingCorrect -= correctInc;
            }
            continue;
          }

          if (topic.reviewHistory.length > 0) {
            let remainingMade = safeTopicTotal;
            let remainingCorrect = safeTopicCorrect;
            const orderedReviews = getEntriesSortedAsc(topic.reviewHistory);
            let previousTotal = 0;
            let previousCorrect = 0;
            const deltas: Array<{ date: string; made: number; correct: number }> = [];

            for (const review of orderedReviews) {
              if (!DATE_ONLY_RE.test(review.date)) continue;

              const rawMadeDelta = Math.max(0, review.questionsTotal - previousTotal);
              const rawCorrectDelta = Math.max(0, review.questionsCorrect - previousCorrect);
              deltas.push({
                date: review.date,
                made: rawMadeDelta,
                correct: rawCorrectDelta,
              });
              previousTotal = Math.max(previousTotal, review.questionsTotal);
              previousCorrect = Math.max(previousCorrect, review.questionsCorrect);
            }

            for (let idx = deltas.length - 1; idx >= 0; idx--) {
              if (remainingMade <= 0 && remainingCorrect <= 0) break;
              const delta = deltas[idx];
              const madeInc = Math.min(remainingMade, delta.made);
              const correctInc = Math.min(remainingCorrect, madeInc, delta.correct);
              if (madeInc <= 0 && correctInc <= 0) continue;

              const day = ensureActivityDay(nextMap, delta.date);
              day.questionsMade += madeInc;
              day.questionsCorrect += correctInc;

              remainingMade -= madeInc;
              remainingCorrect -= correctInc;
            }
            continue;
          }

          const fallbackDate = topic.dateStudied && DATE_ONLY_RE.test(topic.dateStudied.slice(0, 10))
            ? topic.dateStudied.slice(0, 10)
            : fallbackIso;
          const day = ensureActivityDay(nextMap, fallbackDate);
          day.questionsMade += safeTopicTotal;
          day.questionsCorrect += safeTopicCorrect;
        }
      }
    }
    nextMap.forEach(day => { day.total = day.questionsMade; });
    return nextMap;
  }, [subjects, todayIso]);

  const evolutionDays = useMemo(() => {
    const list: ActivityDay[] = [];
    const base = new Date(todayIso + 'T00:00:00');
    base.setHours(0, 0, 0, 0);
    for (let offset = 13; offset >= 0; offset--) {
      const dayDate = new Date(base);
      dayDate.setDate(base.getDate() - offset);
      const date = toIsoDateLocal(dayDate);
      const found = activityMap.get(date);
      list.push(found ? { ...found } : { date, questionsMade: 0, questionsCorrect: 0, total: 0 });
    }
    return list;
  }, [activityMap, todayIso]);

  const last14Total = useMemo(() => evolutionDays.reduce((sum, day) => sum + day.total, 0), [evolutionDays]);
  const last14Correct = useMemo(() => evolutionDays.reduce((sum, day) => sum + day.questionsCorrect, 0), [evolutionDays]);
  const evolutionMax = useMemo(() => Math.max(...evolutionDays.map(day => day.questionsMade), 1), [evolutionDays]);

  const previous14Total = useMemo(() => {
    let total = 0;
    const base = new Date(todayIso + 'T00:00:00');
    base.setHours(0, 0, 0, 0);
    for (let offset = 27; offset >= 14; offset--) {
      const dayDate = new Date(base);
      dayDate.setDate(base.getDate() - offset);
      total += activityMap.get(toIsoDateLocal(dayDate))?.total ?? 0;
    }
    return total;
  }, [activityMap, todayIso]);

  const evolutionTrend = previous14Total > 0 ? (last14Total - previous14Total) / previous14Total : (last14Total > 0 ? 1 : 0);

  const todayLabel = useMemo(() => new Date(todayIso + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }), [todayIso]);
  const todayActivity = useMemo(() => activityMap.get(todayIso) ?? { date: todayIso, questionsMade: 0, questionsCorrect: 0, total: 0 }, [activityMap, todayIso]);

  const weeklyActivityDays = useMemo(() => evolutionDays.slice(-7), [evolutionDays]);
  const weeklyDateSet = useMemo(
    () => new Set(weeklyActivityDays.map(day => day.date)),
    [weeklyActivityDays],
  );
  const weeklyQuestionsMade = useMemo(() => weeklyActivityDays.reduce((sum, day) => sum + day.questionsMade, 0), [weeklyActivityDays]);

  const streakInfo = useMemo(() => {
    const activeDates = new Set<string>();
    activityMap.forEach(day => {
      if (day.total > 0) activeDates.add(day.date);
    });

    let current = 0;
    const walker = new Date(todayIso + 'T00:00:00');
    walker.setHours(0, 0, 0, 0);
    while (activeDates.has(toIsoDateLocal(walker))) {
      current += 1;
      walker.setDate(walker.getDate() - 1);
    }

    const ordered = Array.from(activeDates).sort();
    let longest = 0;
    let running = 0;
    let prevDate: string | null = null;
    for (const date of ordered) {
      if (!prevDate) {
        running = 1;
      } else {
        const prev = new Date(prevDate + 'T00:00:00');
        prev.setDate(prev.getDate() + 1);
        running = toIsoDateLocal(prev) === date ? running + 1 : 1;
      }
      longest = Math.max(longest, running);
      prevDate = date;
    }

    return { current, longest, activeDays: activeDates.size };
  }, [activityMap, todayIso]);

  const reviewCountByDate = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const subject of subjects) {
      for (const group of subject.topicGroups) {
        for (const topic of group.topics) {
          for (const review of topic.reviewHistory) {
            if (!DATE_ONLY_RE.test(review.date)) continue;
            byDate.set(review.date, (byDate.get(review.date) ?? 0) + 1);
          }
        }
      }
    }
    return byDate;
  }, [subjects]);

  const weeklyReviews = useMemo(() => {
    let total = 0;
    for (const date of weeklyDateSet) {
      total += reviewCountByDate.get(date) ?? 0;
    }
    return total;
  }, [reviewCountByDate, weeklyDateSet]);

  const weeklyEssays = useMemo(() => {
    return essays.filter(essay => weeklyDateSet.has(essay.date)).length;
  }, [essays, weeklyDateSet]);

  const weekComparison = useMemo(() => {
    const thisWeek = weeklyActivityDays;
    const base = new Date(todayIso + 'T00:00:00');
    base.setHours(0, 0, 0, 0);
    const lastWeekDays: ActivityDay[] = [];
    for (let offset = 13; offset >= 7; offset--) {
      const dayDate = new Date(base);
      dayDate.setDate(base.getDate() - offset);
      const date = toIsoDateLocal(dayDate);
      lastWeekDays.push(activityMap.get(date) ?? { date, questionsMade: 0, questionsCorrect: 0, total: 0 });
    }
    const thisWeekTotal = thisWeek.reduce((s, d) => s + d.questionsMade, 0);
    const lastWeekTotal = lastWeekDays.reduce((s, d) => s + d.questionsMade, 0);
    const thisWeekCorrect = thisWeek.reduce((s, d) => s + d.questionsCorrect, 0);
    const lastWeekCorrect = lastWeekDays.reduce((s, d) => s + d.questionsCorrect, 0);

    return {
      thisWeek: { total: thisWeekTotal, correct: thisWeekCorrect },
      lastWeek: { total: lastWeekTotal, correct: lastWeekCorrect },
      questionsDelta: thisWeekTotal - lastWeekTotal,
      accuracyThis: thisWeekTotal > 0 ? thisWeekCorrect / thisWeekTotal : 0,
      accuracyLast: lastWeekTotal > 0 ? lastWeekCorrect / lastWeekTotal : 0,
    };
  }, [activityMap, weeklyActivityDays, todayIso]);

  const heatmapDays = useMemo<HeatmapDay[]>(() => {
    const days: HeatmapDay[] = [];
    const base = new Date(todayIso + 'T00:00:00');
    base.setHours(0, 0, 0, 0);
    for (let offset = 27; offset >= 0; offset--) {
      const day = new Date(base);
      day.setDate(base.getDate() - offset);
      const isoDate = toIsoDateLocal(day);
      days.push({ date: isoDate, count: activityMap.get(isoDate)?.questionsMade ?? 0 });
    }
    return days;
  }, [activityMap, todayIso]);

  const weeklyReviewCalendar = useMemo<WeeklyReviewDay[]>(() => {
    const labels = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado', 'Domingo'];
    const start = getWeekStartMonday(new Date(todayIso + 'T00:00:00'));
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return { label: labels[i], isoDate: toIsoDateLocal(day) };
    });
    const bucket = new Map<string, UpcomingReviewItem[]>();
    for (const day of days) bucket.set(day.isoDate, []);

    for (const subject of subjects) {
      for (const group of subject.topicGroups) {
        for (const topic of group.topics) {
          if (!topic.studied) continue;
          if (!topic.fsrsNextReview) continue;
          const list = bucket.get(topic.fsrsNextReview);
          if (!list) continue;
          list.push({
            topicId: topic.id,
            topicName: topic.name,
            subjectId: subject.id,
            subjectEmoji: subject.emoji,
            groupName: group.name,
            nextReview: topic.fsrsNextReview,
          });
        }
      }
    }

    return days.map(day => ({
      ...day,
      items: (bucket.get(day.isoDate) ?? []).sort((a, b) => a.topicName.localeCompare(b.topicName, 'pt-BR')),
    }));
  }, [subjects, todayIso]);

  const todayStudyMinutes = useMemo(
    () => studySessions.reduce((sum, session) => session.startTime.slice(0, 10) === todayIso ? sum + session.durationMinutes : sum, 0),
    [studySessions, todayIso],
  );

  const weeklyStudyMinutes = useMemo(() => {
    return studySessions.reduce((sum, session) => weeklyDateSet.has(session.startTime.slice(0, 10)) ? sum + session.durationMinutes : sum, 0);
  }, [studySessions, weeklyDateSet]);

  const handleSessionEnd = useCallback((session: Omit<StudySession, 'id'>) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cutoffIso = cutoffDate.toISOString();
    setStudySessions(prev => {
      const filtered = prev.filter(item => item.startTime >= cutoffIso);
      return [
        ...filtered,
        {
          id: `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          ...session,
        },
      ];
    });
  }, []);

  const goalsRef = useRef(goals);
  goalsRef.current = goals;

  const updateGoal = useCallback(function updateGoal<K extends keyof StudyGoals>(key: K, value: number) {
    const clampConfig: Record<keyof StudyGoals, [number, number]> = {
      dailyQuestionsTarget: [1, 200],
      weeklyReviewTarget: [1, 100],
      weeklyEssayTarget: [1, 14],
    };
    const [min, max] = clampConfig[key];
    onUpdateGoals({ ...goalsRef.current, [key]: clampGoalValue(value, min, max) });
  }, [onUpdateGoals]);

  const accuracyDeltaPp = useMemo(() => Math.round((weekComparison.accuracyThis - weekComparison.accuracyLast) * 100), [weekComparison.accuracyThis, weekComparison.accuracyLast]);

  const completionEstimate = useMemo<CompletionEstimate>(() => {
    const remaining = overall.totalTopics - overall.studiedTopics;
    if (remaining <= 0) return { type: 'complete' };

    const sortedDates = Array.from(activityMap.keys()).sort();
    if (sortedDates.length < 2) return null;

    const firstDate = new Date(sortedDates[0] + 'T00:00:00');
    const todayDate = new Date(todayIso + 'T00:00:00');
    const totalDays = Math.max(1, Math.floor((todayDate.getTime() - firstDate.getTime()) / 86400000));
    const topicsPerDay = overall.studiedTopics / totalDays;
    if (topicsPerDay <= 0) return null;

    const daysRemaining = Math.ceil(remaining / topicsPerDay);
    const estimatedDate = new Date(todayDate);
    estimatedDate.setDate(estimatedDate.getDate() + daysRemaining);

    return {
      type: 'estimate',
      daysRemaining,
      estimatedDate,
      topicsPerDay: topicsPerDay.toFixed(1),
      remaining,
    };
  }, [overall, activityMap, todayIso]);

  const exportReport = useCallback(() => {
    const lines = [
      `Relatorio de Estudos - ${new Date().toLocaleDateString('pt-BR')}`,
      '',
      `Progresso geral: ${formatPercent(overall.progresso)}`,
      `Rendimento: ${formatPercent(overall.rendimento)}`,
      `Questoes: ${overall.questionsCorrect}/${overall.questionsTotal}`,
      `Streak: ${streakInfo.current} dia(s) | Recorde: ${streakInfo.longest}`,
      `Dias ativos: ${streakInfo.activeDays}`,
      '',
      'Por disciplina:',
      ...sortedSubjects.map(({ subject, stats }) =>
        `  ${subject.emoji} ${subject.name}: ${formatPercent(stats.progresso)} prog | ${formatPercent(stats.rendimento)} rend | ${stats.questionsCorrect}/${stats.questionsTotal} questoes`,
      ),
      '',
      'Metas da semana:',
      `  Questoes: ${weeklyQuestionsMade}`,
      `  Revisoes: ${weeklyReviews}/${goals.weeklyReviewTarget}`,
      `  Redacoes: ${weeklyEssays}/${goals.weeklyEssayTarget}`,
      `  Tempo: ${weeklyStudyMinutes} min`,
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${todayIso}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [overall, streakInfo, sortedSubjects, weeklyQuestionsMade, weeklyReviews, weeklyEssays, weeklyStudyMinutes, goals, todayIso]);

  return {
    overall,
    priorityStats,
    reviewsDue,
    overdueDeadlines,
    upcomingDeadlines,
    sortedSubjects,
    weakSubjects,
    neglectedSubjects,
    consistencyPanelMode,
    setConsistencyPanelMode,
    todayLabel,
    todayActivity,
    weeklyQuestionsMade,
    weekComparison,
    streakInfo,
    todayStudyMinutes,
    weeklyStudyMinutes,
    heatmapDays,
    evolutionTrend,
    last14Total,
    last14Correct,
    evolutionDays,
    evolutionMax,
    weeklyReviews,
    weeklyEssays,
    weeklyReviewCalendar,
    handleSessionEnd,
    updateGoal,
    accuracyDeltaPp,
    completionEstimate,
    exportReport,
  };
}
