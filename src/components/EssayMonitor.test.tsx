/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EssayMonitor } from "./EssayMonitor";
import type { EssayMonitorSettings } from "../types";

describe("EssayMonitor", () => {
  afterEach(() => {
    cleanup();
  });

  it("permite abrir modal de nova redacao e salvar", () => {
    const settings: EssayMonitorSettings = {
      essays: [],
      timerDurationMinutes: 90,
    };
    const onUpdateSettings = vi.fn();

    render(<EssayMonitor settings={settings} onUpdateSettings={onUpdateSettings} />);

    fireEvent.click(screen.getByRole("button", { name: /nova/i }));

    const themeInput = screen.getAllByRole("textbox")[0];
    fireEvent.change(themeInput, { target: { value: "Tema de teste" } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/i }));

    expect(onUpdateSettings).toHaveBeenCalledTimes(1);
    const next = onUpdateSettings.mock.calls[0][0] as EssayMonitorSettings;
    expect(next.essays).toHaveLength(1);
    expect(next.essays[0].theme).toBe("Tema de teste");
    expect(next.essays[0].totalScore).toBe(0);
  });
});
