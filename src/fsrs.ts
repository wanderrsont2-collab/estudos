// ========================================
// FSRS v5 Algorithm - Ported from Obsidian Script
// ========================================

export const FSRS5_DEFAULT_WEIGHTS = [
  0.40255, 1.18385, 3.173, 15.69105,
  7.1949, 0.5345,
  1.4604, 0.0046, 1.54575, 0.1192,
  1.01925, 1.9395, 0.11, 0.29605,
  2.2698, 0.2315, 2.9898,
  0.51655, 0.6621,
] as const;

export const FSRS6_DEFAULT_WEIGHTS = [
  0.212, 1.2931, 2.3065, 8.2956,
  6.4133, 0.8334,
  3.0194, 0.001, 1.8722, 0.1666,
  0.796, 1.4835, 0.0614, 0.2629,
  1.6483, 0.6014, 1.8729,
  0.5425, 0.0912, 0.0658,
  0.1542,
] as const;

const FSRS5_DECAY = -0.5;
const FSRS5_FACTOR = 19 / 81;

export type FSRSVersion = 'fsrs5' | 'fsrs6';

export interface FSRSConfig {
  version: FSRSVersion;
  requestedRetention: number; // [0.01, 0.999]
  customWeights: number[] | null; // user-trained/optimized parameters
}

export const FSRS_VERSION_LABEL: Record<FSRSVersion, string> = {
  fsrs5: 'FSRS-5',
  fsrs6: 'FSRS-6',
};

export const REQUESTED_RETENTION = 0.90;
export const DEFAULT_FSRS_CONFIG: FSRSConfig = {
  version: 'fsrs5',
  requestedRetention: REQUESTED_RETENTION,
  customWeights: null,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundTo(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function daysSince(dateStr: string, today: Date): number {
  const date = new Date(dateStr + 'T00:00:00');
  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)));
}

export function getExpectedWeightCount(version: FSRSVersion): number {
  return version === 'fsrs6' ? FSRS6_DEFAULT_WEIGHTS.length : FSRS5_DEFAULT_WEIGHTS.length;
}

export function getDefaultWeights(version: FSRSVersion): readonly number[] {
  return version === 'fsrs6' ? FSRS6_DEFAULT_WEIGHTS : FSRS5_DEFAULT_WEIGHTS;
}

function getCurveParams(version: FSRSVersion, weights: readonly number[]): { decay: number; factor: number } {
  if (version === 'fsrs6') {
    const decay = -weights[20];
    const factor = Math.pow(0.9, 1 / decay) - 1;
    return { decay, factor };
  }
  return { decay: FSRS5_DECAY, factor: FSRS5_FACTOR };
}

export function normalizeFSRSConfig(config: Partial<FSRSConfig> | null | undefined): FSRSConfig {
  const version: FSRSVersion = config?.version === 'fsrs6' ? 'fsrs6' : 'fsrs5';
  const expectedWeightCount = getExpectedWeightCount(version);
  const isValidCustomWeights =
    Array.isArray(config?.customWeights) &&
    config.customWeights.length === expectedWeightCount &&
    config.customWeights.every(v => Number.isFinite(v));

  return {
    version,
    requestedRetention: clamp(config?.requestedRetention ?? REQUESTED_RETENTION, 0.01, 0.999),
    customWeights: isValidCustomWeights ? [...config!.customWeights!] : null,
  };
}

function getActiveWeights(config: FSRSConfig): readonly number[] {
  return config.customWeights ?? getDefaultWeights(config.version);
}

function getInitialDifficulty(grade: FSRSRating, weights: readonly number[]): number {
  // FSRS-5: D0(G) = w4 - exp(w5 * (G - 1)) + 1
  return weights[4] - Math.exp(weights[5] * (grade - 1)) + 1;
}

export type FSRSRating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

export interface FSRSState {
  difficulty: number;
  stability: number;
  lastReview: string | null; // ISO date string
  nextReview: string | null; // ISO date string
}

export interface ReviewEntry {
  id: string;
  reviewNumber: number;
  date: string;           // ISO date
  rating: FSRSRating;
  ratingLabel: string;
  difficultyBefore: number;
  difficultyAfter: number;
  stabilityBefore: number;
  stabilityAfter: number;
  intervalDays: number;
  retrievability: number | null;
  performanceScore: number | null; // from questions accuracy
}

export const RATING_OPTIONS = [
  { value: 1 as FSRSRating, label: 'Esqueci', emoji: '\u{1F534}', color: 'bg-red-500', hoverColor: 'hover:bg-red-600', lightBg: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200' },
  { value: 2 as FSRSRating, label: 'Difícil', emoji: '\u{1F7E0}', color: 'bg-orange-500', hoverColor: 'hover:bg-orange-600', lightBg: 'bg-orange-50', textColor: 'text-orange-700', borderColor: 'border-orange-200' },
  { value: 3 as FSRSRating, label: 'Bom', emoji: '\u{1F7E1}', color: 'bg-yellow-500', hoverColor: 'hover:bg-yellow-600', lightBg: 'bg-yellow-50', textColor: 'text-yellow-700', borderColor: 'border-yellow-200' },
  { value: 4 as FSRSRating, label: 'Fácil', emoji: '\u{1F7E2}', color: 'bg-green-500', hoverColor: 'hover:bg-green-600', lightBg: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-200' },
];

/**
 * Calculate the performance-based suggested rating from questions accuracy.
 * Uses the accuracy percentage to suggest a rating.
 */
export function suggestRatingFromPerformance(questionsTotal: number, questionsCorrect: number): FSRSRating | null {
  if (questionsTotal === 0) return null;
  const accuracy = questionsCorrect / questionsTotal;
  if (accuracy >= 0.9) return 4;  // Easy
  if (accuracy >= 0.7) return 3;  // Good
  if (accuracy >= 0.5) return 2;  // Hard
  return 1;                        // Again
}

/**
 * Calculate retrievability - the probability of recall at elapsed_days.
 */
export function calculateRetrievability(stability: number, elapsedDays: number): number {
  if (stability <= 0) return 0;
  return calculateRetrievabilityWithConfig(stability, elapsedDays, DEFAULT_FSRS_CONFIG);
}

export function calculateRetrievabilityWithConfig(
  stability: number,
  elapsedDays: number,
  config: Partial<FSRSConfig> | null | undefined,
): number {
  if (stability <= 0) return 0;
  const normalizedConfig = normalizeFSRSConfig(config);
  const weights = getActiveWeights(normalizedConfig);
  const { decay, factor } = getCurveParams(normalizedConfig.version, weights);
  return Math.pow(1 + (factor * elapsedDays) / stability, decay);
}

/**
 * Calculate interval in days from stability and desired retention.
 * FSRS: I(r,S) = (S / FACTOR) * (r^(1/DECAY) - 1)
 */
export function calculateIntervalDays(stability: number, retention = REQUESTED_RETENTION): number {
  return calculateIntervalDaysWithConfig(stability, { ...DEFAULT_FSRS_CONFIG, requestedRetention: retention });
}

export function calculateIntervalDaysWithConfig(
  stability: number,
  config: Partial<FSRSConfig> | null | undefined,
): number {
  if (stability <= 0) return 1;
  const normalizedConfig = normalizeFSRSConfig(config);
  const weights = getActiveWeights(normalizedConfig);
  const { decay, factor } = getCurveParams(normalizedConfig.version, weights);
  const interval = (stability / factor) * (Math.pow(normalizedConfig.requestedRetention, 1 / decay) - 1);
  return Math.max(1, Math.round(interval));
}

/**
 * Core FSRS v5 algorithm - calculates new state after a review.
 */
export function fsrsReview(
  currentState: FSRSState,
  grade: FSRSRating, // 1=Again, 2=Hard, 3=Good, 4=Easy
  config: Partial<FSRSConfig> | null | undefined = DEFAULT_FSRS_CONFIG,
): { newState: FSRSState; intervalDays: number; retrievability: number | null } {
  const normalizedConfig = normalizeFSRSConfig(config);
  const weights = getActiveWeights(normalizedConfig);
  const today = startOfToday();
  const todayStr = toDateOnlyString(today);

  const { difficulty, stability, lastReview } = currentState;

  // Calculate elapsed days
  let elapsedDays = 0;
  if (lastReview) {
    elapsedDays = daysSince(lastReview, today);
  }

  let newDifficulty: number;
  let newStability: number;
  let retrievability: number | null = null;

  if (stability <= 0) {
    // --- FIRST REVIEW (New item) ---
    // S0 = w[grade - 1]
    newStability = weights[grade - 1];

    // FSRS-5 initial difficulty
    newDifficulty = clamp(getInitialDifficulty(grade, weights), 1, 10);
  } else {
    // --- EXISTING REVIEW ---
    // 1. Calculate Retrievability (R)
    retrievability = calculateRetrievabilityWithConfig(stability, elapsedDays, normalizedConfig);

    // 2. Update Difficulty (D)
    // FSRS-5:
    // delta = -w6 * (G - 3)
    // D' = D + delta * (10 - D) / 9
    // D'' = w7 * D0(4) + (1 - w7) * D'
    const deltaDifficulty = -weights[6] * (grade - 3);
    const dampedDifficulty = difficulty + (deltaDifficulty * (10 - difficulty)) / 9;
    const difficultyMeanReversion = (weights[7] * getInitialDifficulty(4, weights)) + ((1 - weights[7]) * dampedDifficulty);
    newDifficulty = clamp(difficultyMeanReversion, 1, 10);

    // 3. Update Stability (S)
    if (elapsedDays === 0) {
      const shortTermBoost = Math.exp(weights[17] * (grade - 3 + weights[18]));
      const sameDayInc =
        normalizedConfig.version === 'fsrs6'
          ? shortTermBoost * Math.pow(stability, -weights[19])
          : shortTermBoost;

      // Guard rail from official FSRS-6 notes: Good/Easy should not shrink stability.
      const boundedInc = grade >= 3 ? Math.max(1, sameDayInc) : sameDayInc;
      newStability = stability * boundedInc;
    } else if (grade === 1) {
      // -- FORGET --
      newStability = weights[11] * Math.pow(newDifficulty, -weights[12]) *
        (Math.pow(stability + 1, weights[13]) - 1) *
        Math.exp(weights[14] * (1 - retrievability));
    } else {
      // -- RECALL (Hard/Good/Easy) --
      let sCurve = Math.exp(weights[8]) *
        (11 - newDifficulty) *
        Math.pow(stability, -weights[9]) *
        (Math.exp(weights[10] * (1 - retrievability)) - 1);

      if (grade === 2) { // Hard penalty
        sCurve *= weights[15];
      }
      if (grade === 4) { // Easy bonus
        sCurve *= weights[16];
      }

      newStability = stability * (1 + sCurve);
    }
  }

  // Limits
  newStability = roundTo(newStability, 2);
  newDifficulty = roundTo(newDifficulty, 2);
  if (newStability < 0.1) newStability = 0.1;

  // Calculate interval for requested retention
  const nextInterval = calculateIntervalDaysWithConfig(newStability, normalizedConfig);

  const nextDate = new Date(today);
  nextDate.setDate(nextDate.getDate() + nextInterval);
  const nextReviewStr = toDateOnlyString(nextDate);

  return {
    newState: {
      difficulty: newDifficulty,
      stability: newStability,
      lastReview: todayStr,
      nextReview: nextReviewStr,
    },
    intervalDays: nextInterval,
    retrievability,
  };
}

/**
 * Check if a review is due (today or overdue).
 */
export function isReviewDue(nextReview: string | null): boolean {
  if (!nextReview) return false;
  const today = startOfToday();
  const reviewDate = new Date(nextReview + 'T00:00:00');
  return reviewDate <= today;
}

/**
 * Get days until next review. Negative = overdue.
 */
export function daysUntilReview(nextReview: string | null): number | null {
  if (!nextReview) return null;
  const today = startOfToday();
  const reviewDate = new Date(nextReview + 'T00:00:00');
  return Math.ceil((reviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Get a human-readable review status.
 */
export function getReviewStatus(nextReview: string | null): {
  text: string;
  className: string;
  urgency: 'overdue' | 'today' | 'tomorrow' | 'soon' | 'normal' | 'none';
} {
  if (!nextReview) return { text: 'Sem revisão', className: 'text-gray-400 bg-gray-100', urgency: 'none' };

  const days = daysUntilReview(nextReview)!;

  if (days < 0) return { text: `Atrasada (${Math.abs(days)}d)`, className: 'text-red-700 bg-red-100', urgency: 'overdue' };
  if (days === 0) return { text: 'Hoje!', className: 'text-orange-700 bg-orange-100', urgency: 'today' };
  if (days === 1) return { text: 'Amanhã', className: 'text-amber-700 bg-amber-100', urgency: 'tomorrow' };
  if (days <= 3) return { text: `Em ${days} dias`, className: 'text-yellow-700 bg-yellow-100', urgency: 'soon' };
  if (days <= 7) return { text: `Em ${days} dias`, className: 'text-blue-700 bg-blue-100', urgency: 'normal' };
  return { text: `Em ${days} dias`, className: 'text-gray-600 bg-gray-100', urgency: 'normal' };
}

/**
 * Calculate difficulty label for display.
 */
export function getDifficultyLabel(difficulty: number): { text: string; color: string } {
  if (difficulty <= 2) return { text: 'Muito Fácil', color: 'text-green-600' };
  if (difficulty <= 4) return { text: 'Fácil', color: 'text-green-500' };
  if (difficulty <= 6) return { text: 'Medio', color: 'text-yellow-600' };
  if (difficulty <= 8) return { text: 'Difícil', color: 'text-orange-600' };
  return { text: 'Muito Difícil', color: 'text-red-600' };
}

/**
 * Generate a unique ID.
 */
export function generateReviewId(): string {
  return 'rev_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}
