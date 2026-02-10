import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewSystem } from "./ReviewSystem";
import type { FSRSConfig } from "../fsrs";
import type { Subject } from "../types";

function makeSubjectsWithUpcoming(count: number): Subject[] {
  const today = new Date();
  const toIso = (offset: number) => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  return [
    {
      id: "subj",
      name: "Matematica",
      emoji: "📐",
      color: "#1565c0",
      colorLight: "#e3f2fd",
      topicGroups: [
        {
          id: "g1",
          name: "Geral",
          topics: Array.from({ length: count }, (_, idx) => ({
            id: `t_${idx + 1}`,
            name: `Topic ${idx + 1}`,
            studied: true,
            questionsTotal: 0,
            questionsCorrect: 0,
            questionLogs: [],
            notes: "",
            tags: [],
            dateStudied: null,
            priority: null,
            deadline: null,
            fsrsDifficulty: 2,
            fsrsStability: 3,
            fsrsLastReview: toIso(-2),
            fsrsNextReview: toIso(idx + 1),
            reviewHistory: [],
          })),
        },
      ],
    },
  ];
}

describe("ReviewSystem visible count", () => {
  it("mostra 10 por padrao e permite trocar para 20 em proximas revisoes", () => {
    const fsrsConfig: FSRSConfig = {
      version: "fsrs5",
      requestedRetention: 0.9,
      customWeights: null,
    };

    render(
      <ReviewSystem
        subjects={makeSubjectsWithUpcoming(25)}
        fsrsConfig={fsrsConfig}
        onUpdateFsrsConfig={vi.fn()}
        onUpdateSubject={vi.fn()}
        onNavigateToSubject={vi.fn()}
      />,
    );

    expect(screen.getByText("Topic 10")).toBeInTheDocument();
    expect(screen.queryByText("Topic 11")).not.toBeInTheDocument();

    const upcomingSelect = screen.getByLabelText("Quantidade de próximas revisões");
    fireEvent.change(upcomingSelect, { target: { value: "20" } });

    expect(screen.getByText("Topic 20")).toBeInTheDocument();
  });
});
