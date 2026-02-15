/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudyTimer } from "./StudyTimer";
import type { Subject } from "../../types";

const subjects: Subject[] = [
  {
    id: "math",
    name: "Matematica",
    emoji: "📐",
    color: "#1565c0",
    colorLight: "#e3f2fd",
    description: "",
    topicGroups: [],
    blocks: [],
  },
];

describe("StudyTimer", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("nao arredonda para 1 minuto quando parar antes de 60 segundos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-11T18:00:00.000Z"));
    const onSessionEnd = vi.fn();

    render(<StudyTimer subjects={subjects} onSessionEnd={onSessionEnd} />);

    fireEvent.click(screen.getByRole("button", { name: "Iniciar" }));
    vi.advanceTimersByTime(1500);
    fireEvent.click(screen.getByRole("button", { name: "Parar" }));

    expect(onSessionEnd).toHaveBeenCalledTimes(1);
    expect(onSessionEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMinutes: 0,
      }),
    );
  });
});
