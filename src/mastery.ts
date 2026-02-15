import type { Topic } from './types';

export type MasteryLabel = 'Iniciante' | 'Aprendendo' | 'Dominado' | 'Mestre';

export interface TopicMasteryResult {
  score: number; // 0..100
  label: MasteryLabel;
  accuracyScore: number; // 0..1
  stabilityScore: number; // 0..1
  consistencyScore: number; // 0..1
  trendScore: number; // 0..1
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toDayIndex(date: string): number {
  const parts = date.split('-').map(Number);
  if (parts.length !== 3) return Number.NaN;
  const [year, month, day] = parts;
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return Number.NaN;
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function getConsistencyScore(topic: Topic): number {
  const reviews = [...topic.reviewHistory].sort((a, b) => a.date.localeCompare(b.date));
  if (reviews.length === 0) return 0;
  if (reviews.length === 1) return 1;

  let opportunities = 0;
  let onTime = 0;

  for (let i = 1; i < reviews.length; i += 1) {
    const previous = reviews[i - 1];
    const current = reviews[i];
    const previousDay = toDayIndex(previous.date);
    const currentDay = toDayIndex(current.date);
    if (!Number.isFinite(previousDay) || !Number.isFinite(currentDay)) continue;

    const expectedGap = Math.max(1, Math.round(previous.scheduledDays ?? previous.intervalDays ?? 1));
    const dueDay = previousDay + expectedGap;
    const daysLate = currentDay - dueDay;
    opportunities += 1;

    // Tolerancia de 1 dia para nao punir pequenas variacoes de agenda.
    if (daysLate <= 1) onTime += 1;
  }

  if (opportunities === 0) return 1;
  return clamp01(onTime / opportunities);
}

function getTrendScore(topic: Topic, fallback: number): number {
  const recentPerformance = topic.reviewHistory
    .map(review => review.performanceScore)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .slice(-3)
    .map(clamp01);

  if (recentPerformance.length < 2) return clamp01(fallback);

  let positiveSteps = 0;
  for (let i = 1; i < recentPerformance.length; i += 1) {
    if (recentPerformance[i] >= recentPerformance[i - 1] - 0.01) positiveSteps += 1;
  }

  const stepScore = positiveSteps / (recentPerformance.length - 1);
  const slope = recentPerformance[recentPerformance.length - 1] - recentPerformance[0];
  const slopeScore = clamp01((slope + 1) / 2);
  return clamp01(stepScore * 0.6 + slopeScore * 0.4);
}

export function getMasteryLabel(score: number): MasteryLabel {
  if (score < 45) return 'Iniciante';
  if (score < 65) return 'Aprendendo';
  if (score < 85) return 'Dominado';
  return 'Mestre';
}

export function getMasteryBadgeClass(score: number): string {
  if (score < 45) return 'bg-red-100 text-red-700';
  if (score < 65) return 'bg-amber-100 text-amber-700';
  if (score < 85) return 'bg-blue-100 text-blue-700';
  return 'bg-emerald-100 text-emerald-700';
}

export function calculateTopicMastery(topic: Topic): TopicMasteryResult {
  const accuracyScore = topic.questionsTotal > 0
    ? clamp01(topic.questionsCorrect / topic.questionsTotal)
    : 0;
  const stabilityScore = clamp01(topic.fsrsStability / (topic.fsrsStability + 30));
  const consistencyScore = getConsistencyScore(topic);
  const trendScore = getTrendScore(topic, accuracyScore);

  const normalized = clamp01(
    (0.40 * accuracyScore)
    + (0.35 * stabilityScore)
    + (0.15 * consistencyScore)
    + (0.10 * trendScore),
  );

  const score = Math.round(normalized * 100);
  return {
    score,
    label: getMasteryLabel(score),
    accuracyScore,
    stabilityScore,
    consistencyScore,
    trendScore,
  };
}
