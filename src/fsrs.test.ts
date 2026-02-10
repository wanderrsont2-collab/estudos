import { describe, expect, it } from "vitest";
import {
  DEFAULT_FSRS_CONFIG,
  calculateIntervalDaysWithConfig,
  fsrsReview,
  normalizeFSRSConfig,
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
});
