import { describe, expect, it } from "vitest";
import type { Subject } from "./types";
import { getPriorityStats, getReviewsDue, getUpcomingReviews } from "./store";

function makeSubject(): Subject {
  const today = new Date();
  const toIso = (offsetDays: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };

  return {
    id: "mat",
    name: "Matematica",
    emoji: "📐",
    color: "#1565c0",
    colorLight: "#e3f2fd",
    topicGroups: [
      {
        id: "g1",
        name: "Algebra",
        topics: [
          {
            id: "t_due",
            name: "Funcoes",
            studied: true,
            questionsTotal: 10,
            questionsCorrect: 8,
            questionLogs: [],
            notes: "",
            tags: [],
            dateStudied: null,
            priority: "alta",
            deadline: null,
            fsrsDifficulty: 5,
            fsrsStability: 6,
            fsrsLastReview: toIso(-7),
            fsrsNextReview: toIso(-1),
            reviewHistory: [],
          },
          {
            id: "t_up_1",
            name: "Equacoes",
            studied: true,
            questionsTotal: 10,
            questionsCorrect: 5,
            questionLogs: [],
            notes: "",
            tags: [],
            dateStudied: null,
            priority: "media",
            deadline: null,
            fsrsDifficulty: 5,
            fsrsStability: 6,
            fsrsLastReview: toIso(-2),
            fsrsNextReview: toIso(1),
            reviewHistory: [],
          },
          {
            id: "t_up_3",
            name: "Inequacoes",
            studied: false,
            questionsTotal: 0,
            questionsCorrect: 0,
            questionLogs: [],
            notes: "",
            tags: [],
            dateStudied: null,
            priority: "baixa",
            deadline: null,
            fsrsDifficulty: 0,
            fsrsStability: 0,
            fsrsLastReview: null,
            fsrsNextReview: toIso(3),
            reviewHistory: [],
          },
        ],
      },
    ],
  };
}

describe("store selectors", () => {
  it("retorna revisoes pendentes e futuras corretamente", () => {
    const subject = makeSubject();
    const due = getReviewsDue([subject]);
    const upcoming = getUpcomingReviews([subject], 10);

    expect(due).toHaveLength(1);
    expect(due[0].topic.id).toBe("t_due");

    expect(upcoming).toHaveLength(2);
    expect(upcoming[0].topic.id).toBe("t_up_1");
    expect(upcoming[1].topic.id).toBe("t_up_3");
  });

  it("conta prioridades de topicos pendentes", () => {
    const subject = makeSubject();
    const stats = getPriorityStats([subject]);
    expect(stats.alta).toBe(0); // t_due estudado
    expect(stats.media).toBe(0); // t_up_1 estudado
    expect(stats.baixa).toBe(1); // t_up_3 pendente
  });
});
