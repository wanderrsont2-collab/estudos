import { describe, expect, it } from "vitest";
import {
  DEFAULT_FSRS_CONFIG,
  calculateIntervalDaysWithConfig,
  fsrsReview,
  normalizeFSRSConfig,
  previewAllRatings,
} from "./fsrs";

describe("fsrs core", () => {
  it("normaliza configuracao com limites validos", () => {
    const config = normalizeFSRSConfig({
      version: "fsrs6",
      requestedRetention: 2,
      customWeights: null,
    });
    expect(config.version).toBe("fsrs6");
    expect(config.requestedRetention).toBeLessThanOrEqual(0.999);
    expect(config.requestedRetention).toBeGreaterThanOrEqual(0.01);
  });

  it("calcula proxima revisao para item novo", () => {
    const result = fsrsReview(
      {
        difficulty: 0,
        stability: 0,
        lastReview: null,
        nextReview: null,
      },
      3,
      DEFAULT_FSRS_CONFIG,
    );

    expect(result.intervalDays).toBeGreaterThanOrEqual(1);
    expect(result.newState.stability).toBeGreaterThan(0);
    expect(result.newState.nextReview).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("gera intervalos maiores para estabilidade maior", () => {
    const low = calculateIntervalDaysWithConfig(2, DEFAULT_FSRS_CONFIG);
    const high = calculateIntervalDaysWithConfig(20, DEFAULT_FSRS_CONFIG);
    expect(high).toBeGreaterThan(low);
  });

  it("mantem separacao entre esqueci e dificil no agendamento", () => {
    const currentState = {
      difficulty: 7,
      stability: 0.4,
      lastReview: "2026-02-14",
      nextReview: "2026-02-15",
    };

    const forgot = fsrsReview(currentState, 1, DEFAULT_FSRS_CONFIG, 1);
    const hard = fsrsReview(currentState, 2, DEFAULT_FSRS_CONFIG, 1);

    expect(forgot.scheduledDays).toBeGreaterThanOrEqual(0);
    expect(hard.scheduledDays).toBeGreaterThan(forgot.scheduledDays);
  });

  it("aplica cap de intervalo maximo configuravel", () => {
    const capped = calculateIntervalDaysWithConfig(100000, {
      ...DEFAULT_FSRS_CONFIG,
      maxIntervalDays: 30,
    });
    expect(capped).toBeLessThanOrEqual(30);
  });

  it("nao quebra com fsrs6 e custom weight[20] invalido", () => {
    const customWeights = [
      0.212, 1.2931, 2.3065, 8.2956,
      6.4133, 0.8334,
      3.0194, 0.001, 1.8722, 0.1666,
      0.796, 1.4835, 0.0614, 0.2629,
      1.6483, 0.6014, 1.8729,
      0.5425, 0.0912, 0.0658,
      0,
    ];
    const interval = calculateIntervalDaysWithConfig(10, {
      version: "fsrs6",
      requestedRetention: 0.9,
      customWeights,
      againMinIntervalDays: 0,
      maxIntervalDays: 36500,
    });
    expect(Number.isFinite(interval)).toBe(true);
    expect(interval).toBeGreaterThanOrEqual(1);
  });

  it("preview garante easy maior que good", () => {
    const previews = previewAllRatings(
      {
        difficulty: 7,
        stability: 0.4,
        lastReview: "2026-02-14",
        nextReview: "2026-02-15",
      },
      DEFAULT_FSRS_CONFIG,
      1,
    );
    const good = previews.find(p => p.rating === 3);
    const easy = previews.find(p => p.rating === 4);
    expect(good).toBeDefined();
    expect(easy).toBeDefined();
    expect(easy!.scheduledDays).toBeGreaterThan(good!.scheduledDays);
  });

  it("fsrsReview sem fuzz por padrao fica consistente com preview", () => {
    const currentState = {
      difficulty: 7,
      stability: 0.4,
      lastReview: "2026-02-14",
      nextReview: "2026-02-15",
    };

    const previews = previewAllRatings(currentState, DEFAULT_FSRS_CONFIG, 1);
    const hardPreview = previews.find(p => p.rating === 2);
    const hardReview = fsrsReview(currentState, 2, DEFAULT_FSRS_CONFIG, 1);

    expect(hardPreview).toBeDefined();
    expect(hardReview.scheduledDays).toBe(hardPreview!.scheduledDays);
  });

  it("aceita options object e mantem resultado do formato legado", () => {
    const currentState = {
      difficulty: 7,
      stability: 0.4,
      lastReview: "2026-02-14",
      nextReview: "2026-02-15",
    };

    const legacy = fsrsReview(currentState, 2, DEFAULT_FSRS_CONFIG, 1, false);
    const options = fsrsReview(currentState, 2, DEFAULT_FSRS_CONFIG, {
      customElapsedDays: 1,
      applyFuzzing: false,
    });

    expect(options.intervalDays).toBe(legacy.intervalDays);
    expect(options.scheduledDays).toBe(legacy.scheduledDays);
    expect(options.newState.nextReview).toBe(legacy.newState.nextReview);
  });

  it("permite injetar today via options", () => {
    const currentState = {
      difficulty: 6,
      stability: 2,
      lastReview: "2026-02-18",
      nextReview: "2026-02-19",
    };

    const result = fsrsReview(currentState, 3, DEFAULT_FSRS_CONFIG, {
      today: new Date(2026, 1, 20, 15, 45, 0),
    });

    expect(result.newState.lastReview).toBe("2026-02-20");
  });
});
