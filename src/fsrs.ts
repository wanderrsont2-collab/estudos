// ========================================
// FSRS v5/v6 Algorithm Implementation (Corrigido)
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
const MAX_STABILITY = 36500; // ~100 years
const DEFAULT_MAX_INTERVAL_DAYS = 36500; // ~100 years
const MIN_STABILITY = 0.1;

export type FSRSVersion = 'fsrs5' | 'fsrs6';

export interface FSRSConfig {
  version: FSRSVersion;
  requestedRetention: number;
  customWeights: number[] | null;
  /**
   * Intervalo mínimo (em dias) quando o usuário marca "Esqueci".
   * 0 = revisar no mesmo dia (padrão, recomendado).
   * 1 = revisar no dia seguinte.
   */
  againMinIntervalDays: number;
  maxIntervalDays: number;
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
  againMinIntervalDays: 0,
  maxIntervalDays: DEFAULT_MAX_INTERVAL_DAYS,
};


function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundTo(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

function assertNever(value: never, context: string): never {
  throw new Error(`Unexpected ${context}: ${String(value)}`);
}

function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfToday(referenceDate: Date = new Date()): Date {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  return today;
}

function daysSince(dateStr: string, today: Date): number {
  const date = new Date(dateStr + 'T00:00:00');
  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)));
}


export function applyFuzz(interval: number): number {
  if (interval < 3) return interval;

  let minIvl: number, maxIvl: number;

  if (interval < 8) {
    minIvl = Math.max(2, Math.round(interval * 0.85));
    maxIvl = Math.round(interval * 1.15);
  } else if (interval < 30) {
    minIvl = Math.round(interval * 0.9);
    maxIvl = Math.round(interval * 1.1);
  } else {
    minIvl = Math.round(interval * 0.95);
    maxIvl = Math.round(interval * 1.05);
  }

  minIvl = Math.min(minIvl, interval - 1);
  maxIvl = Math.max(maxIvl, interval + 1);
  if (minIvl < 2) minIvl = 2;

  return Math.floor(Math.random() * (maxIvl - minIvl + 1)) + minIvl;
}


export function getExpectedWeightCount(version: FSRSVersion): number {
  return version === 'fsrs6' ? FSRS6_DEFAULT_WEIGHTS.length : FSRS5_DEFAULT_WEIGHTS.length;
}

export function getDefaultWeights(version: FSRSVersion): readonly number[] {
  return version === 'fsrs6' ? FSRS6_DEFAULT_WEIGHTS : FSRS5_DEFAULT_WEIGHTS;
}

function getCurveParams(version: FSRSVersion, weights: readonly number[]): { decay: number; factor: number } {
  if (version === 'fsrs6') {
    const rawDecayWeight = weights[20];
    const safeDecayWeight =
      Number.isFinite(rawDecayWeight) && rawDecayWeight > 0
        ? rawDecayWeight
        : FSRS6_DEFAULT_WEIGHTS[20];
    const decay = -safeDecayWeight;
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
    againMinIntervalDays: clamp(config?.againMinIntervalDays ?? 0, 0, 7),
    maxIntervalDays: clamp(config?.maxIntervalDays ?? DEFAULT_MAX_INTERVAL_DAYS, 1, DEFAULT_MAX_INTERVAL_DAYS),
  };
}

function getActiveWeights(config: FSRSConfig): readonly number[] {
  return config.customWeights ?? getDefaultWeights(config.version);
}

function getInitialDifficulty(grade: FSRSRating, weights: readonly number[]): number {
  return weights[4] - Math.exp(weights[5] * (grade - 1)) + 1;
}


export type FSRSRating = 1 | 2 | 3 | 4;

export interface FSRSState {
  difficulty: number;
  stability: number;
  lastReview: string | null;
  nextReview: string | null;
}

export interface ReviewEntry {
  id: string;
  reviewNumber: number;
  date: string;
  rating: FSRSRating;
  ratingLabel: string;
  difficultyBefore: number;
  difficultyAfter: number;
  stabilityBefore: number;
  stabilityAfter: number;
  intervalDays: number;
  scheduledDays: number;
  retrievability: number | null;
  performanceScore: number | null;
  questionsTotal?: number;
  questionsCorrect?: number;
  algorithmVersion?: FSRSVersion;
  requestedRetention?: number;
  usedCustomWeights?: boolean;
}

export const RATING_OPTIONS = [
  { value: 1 as FSRSRating, label: 'Esqueci',  emoji: '\u{1F534}', color: 'bg-red-500',    hoverColor: 'hover:bg-red-600',    lightBg: 'bg-red-50',    textColor: 'text-red-700',    borderColor: 'border-red-200' },
  { value: 2 as FSRSRating, label: 'Difícil',  emoji: '\u{1F7E0}', color: 'bg-orange-500', hoverColor: 'hover:bg-orange-600', lightBg: 'bg-orange-50', textColor: 'text-orange-700', borderColor: 'border-orange-200' },
  { value: 3 as FSRSRating, label: 'Bom',      emoji: '\u{1F7E1}', color: 'bg-yellow-500', hoverColor: 'hover:bg-yellow-600', lightBg: 'bg-yellow-50', textColor: 'text-yellow-700', borderColor: 'border-yellow-200' },
  { value: 4 as FSRSRating, label: 'Fácil',    emoji: '\u{1F7E2}', color: 'bg-green-500',  hoverColor: 'hover:bg-green-600',  lightBg: 'bg-green-50',  textColor: 'text-green-700',  borderColor: 'border-green-200' },
];

export function suggestRatingFromPerformance(questionsTotal: number, questionsCorrect: number): FSRSRating | null {
  if (questionsTotal === 0) return null;
  const accuracy = questionsCorrect / questionsTotal;
  if (accuracy >= 0.9) return 4;
  if (accuracy >= 0.7) return 3;
  if (accuracy >= 0.5) return 2;
  return 1;
}


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
  return computeRetrievability(stability, elapsedDays, decay, factor);
}

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
  return computeIntervalDays(
    stability,
    normalizedConfig.requestedRetention,
    normalizedConfig.maxIntervalDays,
    decay,
    factor,
  );
}

function computeRetrievability(stability: number, elapsedDays: number, decay: number, factor: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (factor * elapsedDays) / stability, decay);
}

function computeIntervalDays(
  stability: number,
  requestedRetention: number,
  maxIntervalDays: number,
  decay: number,
  factor: number,
): number {
  if (stability <= 0) return 1;
  const interval = (stability / factor) * (Math.pow(requestedRetention, 1 / decay) - 1);
  return clamp(Math.round(interval), 1, maxIntervalDays);
}


interface FSRSRawResult {
  newDifficulty: number;
  newStability: number;
  intervalDays: number;
  retrievability: number | null;
}

interface ResolvedFSRSParams {
  config: FSRSConfig;
  weights: readonly number[];
  decay: number;
  factor: number;
}

export interface FSRSReviewOptions {
  customElapsedDays?: number;
  applyFuzzing?: boolean;
  today?: Date;
}

interface ResolvedFSRSReviewOptions {
  customElapsedDays?: number;
  applyFuzzing: boolean;
  today: Date;
}

function resolveFSRSParams(rawConfig: Partial<FSRSConfig> | null | undefined): ResolvedFSRSParams {
  const config = normalizeFSRSConfig(rawConfig);
  const weights = getActiveWeights(config);
  const { decay, factor } = getCurveParams(config.version, weights);
  return { config, weights, decay, factor };
}

function resolveFSRSReviewOptions(
  optionsOrCustomElapsedDays: FSRSReviewOptions | number | undefined,
  legacyApplyFuzzing: boolean,
): ResolvedFSRSReviewOptions {
  if (typeof optionsOrCustomElapsedDays === 'number' || optionsOrCustomElapsedDays === undefined) {
    return {
      customElapsedDays: optionsOrCustomElapsedDays,
      applyFuzzing: legacyApplyFuzzing,
      today: startOfToday(),
    };
  }

  return {
    customElapsedDays: optionsOrCustomElapsedDays.customElapsedDays,
    applyFuzzing: optionsOrCustomElapsedDays.applyFuzzing ?? legacyApplyFuzzing,
    today: startOfToday(optionsOrCustomElapsedDays.today ?? new Date()),
  };
}

function resolveElapsedDays(lastReview: string | null, today: Date, customElapsedDays?: number): number {
  if (customElapsedDays !== undefined) return Math.max(0, Math.round(customElapsedDays));
  if (!lastReview) return 0;
  return daysSince(lastReview, today);
}

function fsrsComputeRaw(
  currentState: FSRSState,
  grade: FSRSRating,
  config: FSRSConfig,
  weights: readonly number[],
  decay: number,
  factor: number,
  elapsedDays: number,
): FSRSRawResult {
  const { difficulty, stability } = currentState;

  let newDifficulty: number;
  let newStability: number;
  let retrievability: number | null = null;

  if (stability <= 0) {
    newStability = weights[grade - 1];
    newDifficulty = clamp(getInitialDifficulty(grade, weights), 1, 10);
  } else {
    retrievability = computeRetrievability(stability, elapsedDays, decay, factor);

    const deltaDifficulty = -weights[6] * (grade - 3);
    const dampedDifficulty = difficulty + (deltaDifficulty * (10 - difficulty)) / 9;
    const difficultyMeanReversion = (weights[7] * getInitialDifficulty(4, weights)) + ((1 - weights[7]) * dampedDifficulty);
    newDifficulty = clamp(difficultyMeanReversion, 1, 10);

    if (elapsedDays === 0) {
      // FSRS behavior: same-day reviews always use short-term stability update,
      // including grade=1. The lapse formula only applies when elapsedDays > 0.
      const shortTermBoost = Math.exp(weights[17] * (grade - 3 + weights[18]));
      const sameDayInc = config.version === 'fsrs6'
        ? shortTermBoost * Math.pow(stability, -weights[19])
        : shortTermBoost;
      const boundedInc = grade >= 3 ? Math.max(1, sameDayInc) : sameDayInc;
      newStability = stability * boundedInc;
    } else if (grade === 1) {
      newStability = weights[11] * Math.pow(newDifficulty, -weights[12]) *
        (Math.pow(stability + 1, weights[13]) - 1) *
        Math.exp(weights[14] * (1 - retrievability));
      newStability = Math.min(newStability, stability);
    } else {
      let sCurve = Math.exp(weights[8]) *
        (11 - newDifficulty) *
        Math.pow(stability, -weights[9]) *
        (Math.exp(weights[10] * (1 - retrievability)) - 1);
      if (grade === 2) sCurve *= weights[15];
      if (grade === 4) sCurve *= weights[16];
      newStability = stability * (1 + sCurve);
    }
  }

  // Sanitize
  if (!Number.isFinite(newDifficulty)) {
    newDifficulty = clamp(getInitialDifficulty(grade, weights), 1, 10);
  }
  if (!Number.isFinite(newStability) || newStability < MIN_STABILITY) {
    newStability = MIN_STABILITY;
  }
  newStability = Math.min(newStability, MAX_STABILITY);

  newStability = roundTo(newStability, 2);
  newDifficulty = roundTo(newDifficulty, 2);

  const intervalDays = computeIntervalDays(
    newStability,
    config.requestedRetention,
    config.maxIntervalDays,
    decay,
    factor,
  );

  return { newDifficulty, newStability, intervalDays, retrievability };
}


/**
 * Processa uma revisão FSRS e retorna o novo estado + agendamento.
 *
 * Regras de agendamento por rating:
 * - Esqueci: intervalo mínimo configurado por `againMinIntervalDays`.
 * - Difícil/Bom/Fácil: respeitam mínimo por rating e podem aplicar fuzz.
 *
 * Novo formato recomendado:
 * - `fsrsReview(state, grade, config, { customElapsedDays, applyFuzzing, today })`
 *
 * Compatibilidade legada mantida:
 * - `fsrsReview(state, grade, config, customElapsedDays?, applyFuzzing?)`
 */
export function fsrsReview(
  currentState: FSRSState,
  grade: FSRSRating,
  config?: Partial<FSRSConfig> | null,
  options?: FSRSReviewOptions,
): { newState: FSRSState; intervalDays: number; scheduledDays: number; retrievability: number | null };
export function fsrsReview(
  currentState: FSRSState,
  grade: FSRSRating,
  config?: Partial<FSRSConfig> | null,
  customElapsedDays?: number,
  applyFuzzing?: boolean,
): { newState: FSRSState; intervalDays: number; scheduledDays: number; retrievability: number | null };
export function fsrsReview(
  currentState: FSRSState,
  grade: FSRSRating,
  config: Partial<FSRSConfig> | null | undefined = DEFAULT_FSRS_CONFIG,
  optionsOrCustomElapsedDays?: FSRSReviewOptions | number,
  legacyApplyFuzzing = false,
): { newState: FSRSState; intervalDays: number; scheduledDays: number; retrievability: number | null } {
  const resolvedOptions = resolveFSRSReviewOptions(optionsOrCustomElapsedDays, legacyApplyFuzzing);
  const { config: normalizedConfig, weights, decay, factor } = resolveFSRSParams(config);
  const today = resolvedOptions.today;
  const todayStr = toDateOnlyString(today);
  const elapsedDays = resolveElapsedDays(currentState.lastReview, today, resolvedOptions.customElapsedDays);

  const raw = fsrsComputeRaw(
    currentState,
    grade,
    normalizedConfig,
    weights,
    decay,
    factor,
    elapsedDays,
  );

  const againMin = normalizedConfig.againMinIntervalDays; // default 0
  const intervalWithFuzz = (intervalDays: number): number => (
    resolvedOptions.applyFuzzing ? applyFuzz(intervalDays) : intervalDays
  );

  let scheduledDays: number;

  switch (grade) {
    case 1:
      scheduledDays = againMin;
      break;

    case 2:
      scheduledDays = Math.max(againMin + 1, intervalWithFuzz(raw.intervalDays));
      break;

    case 3:
      scheduledDays = intervalWithFuzz(raw.intervalDays);
      scheduledDays = Math.max(againMin + 2, scheduledDays);
      break;

    case 4:
      scheduledDays = intervalWithFuzz(raw.intervalDays);
      scheduledDays = Math.max(againMin + 3, scheduledDays);
      break;

    default:
      scheduledDays = assertNever(grade, 'FSRS rating');
  }
  scheduledDays = Math.min(scheduledDays, normalizedConfig.maxIntervalDays);

  const nextDate = new Date(today);
  nextDate.setDate(nextDate.getDate() + scheduledDays);
  const nextReviewStr = toDateOnlyString(nextDate);

  return {
    newState: {
      difficulty: raw.newDifficulty,
      stability: raw.newStability,
      lastReview: todayStr,
      nextReview: nextReviewStr,
    },
    intervalDays: raw.intervalDays,
    scheduledDays,
    retrievability: raw.retrievability,
  };
}


export interface RatingPreview {
  rating: FSRSRating;
  label: string;
  emoji: string;
  scheduledDays: number;
  displayText: string;        // "Hoje", "Amanhã", "3 dias", etc.
  newStability: number;
  newDifficulty: number;
}

/**
 * Retorna um preview determinístico (sem fuzz) dos 4 ratings.
 *
 * Os intervalos são garantidos em ordem estritamente crescente.
 */
export function previewAllRatings(
  currentState: FSRSState,
  config?: Partial<FSRSConfig> | null,
  customElapsedDays?: number,
): RatingPreview[] {
  const { config: normalizedConfig, weights, decay, factor } = resolveFSRSParams(config);
  const today = startOfToday();
  const elapsedDays = resolveElapsedDays(currentState.lastReview, today, customElapsedDays);
  const againMin = normalizedConfig.againMinIntervalDays;
  const maxIntervalDays = normalizedConfig.maxIntervalDays;

  const rawResults = ([1, 2, 3, 4] as FSRSRating[]).map(grade => ({
    grade,
    ...fsrsComputeRaw(
      currentState,
      grade,
      normalizedConfig,
      weights,
      decay,
      factor,
      elapsedDays,
    ),
  }));

  // Apply minimum interval rules per rating
  const scheduled: number[] = rawResults.map(r => {
    switch (r.grade) {
      case 1: return againMin;
      case 2: return Math.max(againMin + 1, r.intervalDays);
      case 3: return Math.max(againMin + 2, r.intervalDays);
      case 4: return Math.max(againMin + 3, r.intervalDays);
      default: return assertNever(r.grade, 'FSRS preview rating');
    }
  });

  for (let i = 1; i < scheduled.length; i++) {
    if (scheduled[i] <= scheduled[i - 1]) {
      scheduled[i] = scheduled[i - 1] + 1;
    }
  }
  for (let i = 0; i < scheduled.length; i++) {
    scheduled[i] = Math.min(scheduled[i], maxIntervalDays);
  }

  const option = (grade: FSRSRating) => RATING_OPTIONS.find(o => o.value === grade)!;

  return rawResults.map((r, i) => ({
    rating: r.grade,
    label: option(r.grade).label,
    emoji: option(r.grade).emoji,
    scheduledDays: scheduled[i],
    displayText: formatIntervalShort(scheduled[i]),
    newStability: r.newStability,
    newDifficulty: r.newDifficulty,
  }));
}

function formatIntervalShort(days: number): string {
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  if (days < 30) return `${days}d`;
  if (days < 345) {
    const months = Math.round(days / 30.44);
    return months === 1 ? '1 mês' : `${months}m`;
  }
  const years = roundTo(days / 365.25, 1);
  return years <= 1 ? '1 ano' : `${years}a`;
}


export function isReviewDue(nextReview: string | null, today = startOfToday()): boolean {
  if (!nextReview) return false;
  return nextReview <= toDateOnlyString(today);
}

export function daysUntilReview(nextReview: string | null, today = startOfToday()): number | null {
  if (!nextReview) return null;
  const reviewDate = new Date(nextReview + 'T00:00:00');
  return Math.ceil((reviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getReviewStatus(nextReview: string | null): {
  text: string;
  className: string;
  urgency: 'overdue' | 'today' | 'tomorrow' | 'soon' | 'normal' | 'none';
} {
  const today = startOfToday();
  if (!nextReview) return { text: 'Sem revisão', className: 'text-gray-400 bg-gray-100', urgency: 'none' };
  const days = daysUntilReview(nextReview, today)!;
  if (days < 0) return { text: `Atrasada (${Math.abs(days)}d)`, className: 'text-red-700 bg-red-100', urgency: 'overdue' };
  if (days === 0) return { text: 'Hoje!', className: 'text-orange-700 bg-orange-100', urgency: 'today' };
  if (days === 1) return { text: 'Amanhã', className: 'text-amber-700 bg-amber-100', urgency: 'tomorrow' };
  if (days <= 3) return { text: `Em ${days} dias`, className: 'text-yellow-700 bg-yellow-100', urgency: 'soon' };
  if (days <= 7) return { text: `Em ${days} dias`, className: 'text-blue-700 bg-blue-100', urgency: 'normal' };
  return { text: `Em ${days} dias`, className: 'text-gray-600 bg-gray-100', urgency: 'normal' };
}

export function getDifficultyLabel(difficulty: number): { text: string; color: string } {
  if (difficulty <= 2) return { text: 'Muito Fácil', color: 'text-green-600' };
  if (difficulty <= 4) return { text: 'Fácil', color: 'text-green-500' };
  if (difficulty <= 6) return { text: 'Médio', color: 'text-yellow-600' };
  if (difficulty <= 8) return { text: 'Difícil', color: 'text-orange-600' };
  return { text: 'Muito Difícil', color: 'text-red-600' };
}

export function generateReviewId(): string {
  return 'rev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

