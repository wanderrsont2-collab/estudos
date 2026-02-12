/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewSystem } from "./ReviewSystem";
import type { FSRSConfig } from "../fsrs";
import type { ReviewEntry, Subject } from "../types";

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

function makeReviewEntry(): ReviewEntry {
  return {
    id: "rev_1",
    reviewNumber: 1,
    date: "2026-02-10",
    rating: 3,
    ratingLabel: "Bom",
    difficultyBefore: 4,
    difficultyAfter: 3.5,
    stabilityBefore: 2,
    stabilityAfter: 3,
    intervalDays: 3,
    retrievability: 0.8,
    performanceScore: null,
    questionsTotal: 0,
    questionsCorrect: 0,
  };
}

function makeSubjectsWithActiveTopicGroup(): Subject[] {
  return [
    {
      id: "subj_active",
      name: "Historia",
      emoji: "📚",
      color: "#5d4037",
      colorLight: "#efebe9",
      topicGroups: [
        {
          id: "g_active",
          name: "Brasil Colonial",
          topics: [
            {
              id: "topic_active",
              name: "Economia açucareira",
              studied: true,
              questionsTotal: 0,
              questionsCorrect: 0,
              questionLogs: [],
              notes: "",
              tags: [],
              dateStudied: null,
              priority: null,
              deadline: null,
              fsrsDifficulty: 3,
              fsrsStability: 4,
              fsrsLastReview: "2026-02-09",
              fsrsNextReview: null,
              reviewHistory: [makeReviewEntry()],
            },
          ],
        },
      ],
    },
  ];
}

describe("ReviewSystem visible count", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.localStorage.clear();
  });

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

  it("aplica busca por nome do grupo em assuntos com revisao ativa", () => {
    const fsrsConfig: FSRSConfig = {
      version: "fsrs5",
      requestedRetention: 0.9,
      customWeights: null,
    };

    render(
      <ReviewSystem
        subjects={makeSubjectsWithActiveTopicGroup()}
        fsrsConfig={fsrsConfig}
        onUpdateFsrsConfig={vi.fn()}
        onUpdateSubject={vi.fn()}
        onNavigateToSubject={vi.fn()}
      />,
    );

    expect(screen.getByText("Economia açucareira")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText("Buscar por assunto, nota ou tag...");
    fireEvent.change(searchInput, { target: { value: "colonial" } });

    expect(screen.getByText("Economia açucareira")).toBeInTheDocument();
  });
});
