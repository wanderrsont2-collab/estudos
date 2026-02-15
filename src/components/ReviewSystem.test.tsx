/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewSystem } from "./ReviewSystem";
import type { FSRSConfig } from "../fsrs";
import type { Subject } from "../types";

const fsrsConfig: FSRSConfig = {
  version: "fsrs5",
  requestedRetention: 0.9,
  customWeights: null,
  againMinIntervalDays: 0,
  maxIntervalDays: 36500,
};

function dateOffset(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function makeSubjects(): Subject[] {
  return [
    {
      id: "subj_1",
      name: "Matemática",
      emoji: "📐",
      color: "#4f46e5",
      colorLight: "#eef2ff",
      description: "",
      topicGroups: [
        {
          id: "group_1",
          name: "Álgebra",
          topics: [
            {
              id: "topic_due",
              name: "Função afim",
              studied: true,
              questionsTotal: 20,
              questionsCorrect: 15,
              questionLogs: [],
              notes: "",
              tags: ["funcoes"],
              dateStudied: dateOffset(-10),
              priority: "alta",
              deadline: null,
              fsrsDifficulty: 4,
              fsrsStability: 6,
              fsrsLastReview: dateOffset(-6),
              fsrsNextReview: dateOffset(-1),
              reviewHistory: [],
            },
            {
              id: "topic_upcoming",
              name: "Progressão aritmética",
              studied: true,
              questionsTotal: 10,
              questionsCorrect: 8,
              questionLogs: [],
              notes: "",
              tags: [],
              dateStudied: dateOffset(-7),
              priority: "media",
              deadline: null,
              fsrsDifficulty: 3.5,
              fsrsStability: 5,
              fsrsLastReview: dateOffset(-2),
              fsrsNextReview: dateOffset(2),
              reviewHistory: [],
            },
          ],
        },
      ],
      blocks: [],
    },
  ];
}

describe("ReviewSystem", () => {
  afterEach(() => {
    cleanup();
  });

  it("renderiza seções principais com dados reais", () => {
    render(
      <ReviewSystem
        subjects={makeSubjects()}
        fsrsConfig={fsrsConfig}
        onUpdateFsrsConfig={vi.fn()}
        onUpdateSubject={vi.fn()}
        onNavigateToSubject={vi.fn()}
      />,
    );

    expect(screen.getByText("Sistema de Revisões")).toBeInTheDocument();
    expect(screen.getByText("Revisões Pendentes")).toBeInTheDocument();
    expect(screen.getByText("Próximas Revisões")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revisar" })).toBeInTheDocument();
  });

  it("aplica avaliação e chama onUpdateSubject", async () => {
    const onUpdateSubject = vi.fn();

    render(
      <ReviewSystem
        subjects={makeSubjects()}
        fsrsConfig={fsrsConfig}
        onUpdateFsrsConfig={vi.fn()}
        onUpdateSubject={onUpdateSubject}
        onNavigateToSubject={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Revisar" }));
    expect(screen.getByText("Como foi a revisão?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Bom/i }));

    await waitFor(() => {
      expect(onUpdateSubject).toHaveBeenCalledTimes(1);
    });

    const updatedSubject = onUpdateSubject.mock.calls[0][0] as Subject;
    const updatedTopic = updatedSubject.topicGroups[0].topics.find((topic) => topic.id === "topic_due");

    expect(updatedTopic).toBeDefined();
    expect(updatedTopic?.reviewHistory.length).toBe(1);
    expect(updatedTopic?.fsrsLastReview).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(updatedTopic?.fsrsNextReview).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.queryByText("Como foi a revisão?")).not.toBeInTheDocument();
  });

  it("permite alterar versão e retenção do FSRS", () => {
    const onUpdateFsrsConfig = vi.fn();

    render(
      <ReviewSystem
        subjects={makeSubjects()}
        fsrsConfig={fsrsConfig}
        onUpdateFsrsConfig={onUpdateFsrsConfig}
        onUpdateSubject={vi.fn()}
        onNavigateToSubject={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    fireEvent.click(screen.getByRole("button", { name: "FSRS-6" }));

    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "95" } });

    const calls = onUpdateFsrsConfig.mock.calls.map((call) => call[0] as FSRSConfig);
    expect(calls.some((config) => config.version === "fsrs6")).toBe(true);
    expect(calls.some((config) => Math.abs(config.requestedRetention - 0.95) < 0.0001)).toBe(true);
  });
});
