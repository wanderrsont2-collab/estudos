import { CheckCircle2, Flame } from 'lucide-react';
import type { StudyGoals, StudySession, Subject } from '../../types';
import type { ActivityDay, ConsistencyPanelMode, HeatmapDay, WeekComparisonData } from './types';
import { RadialPanel } from './RadialPanel';
import { HeatmapPanel } from './HeatmapPanel';
import { EvolutionPanel } from './EvolutionPanel';
import { WeekComparisonCard } from './WeekComparisonCard';
import { StudyTimer } from './StudyTimer';

interface ConsistencySectionProps {
  mode: ConsistencyPanelMode;
  onModeChange: (mode: ConsistencyPanelMode) => void;
  weeklyQuestionsMade: number;
  todayStudyMinutes: number;
  todayQuestionsMade: number;
  goals: StudyGoals;
  onDailyTargetChange: (value: number) => void;
  onWeeklyReviewTargetChange: (value: number) => void;
  onWeeklyEssayTargetChange: (value: number) => void;
  heatmapDays: HeatmapDay[];
  streakCurrent: number;
  streakLongest: number;
  streakActiveDays: number;
  evolutionTrend: number;
  last14Total: number;
  last14Correct: number;
  evolutionDays: ActivityDay[];
  evolutionMax: number;
  weekComparison: WeekComparisonData;
  accuracyDeltaPp: number;
  subjects: Subject[];
  onSessionEnd: (session: Omit<StudySession, 'id'>) => void;
  weeklyStudyMinutes: number;
  weeklyReviews: number;
  weeklyEssays: number;
}

export function ConsistencySection({
  mode,
  onModeChange,
  weeklyQuestionsMade,
  todayStudyMinutes,
  todayQuestionsMade,
  goals,
  onDailyTargetChange,
  onWeeklyReviewTargetChange,
  onWeeklyEssayTargetChange,
  heatmapDays,
  streakCurrent,
  streakLongest,
  streakActiveDays,
  evolutionTrend,
  last14Total,
  last14Correct,
  evolutionDays,
  evolutionMax,
  weekComparison,
  accuracyDeltaPp,
  subjects,
  onSessionEnd,
  weeklyStudyMinutes,
  weeklyReviews,
  weeklyEssays,
}: ConsistencySectionProps) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-sm p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-100 inline-flex items-center gap-2">
            <Flame size={16} /> Metas e consistencia
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Escolha como visualizar meta diaria, consistencia e evolucao 14d.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {([ { id: 'radial', label: 'Radial' }, { id: 'heatmap', label: 'Heatmap' }, { id: 'both', label: 'Ambos' }, { id: 'evolution', label: 'Dashboard 14d' } ] as Array<{ id: ConsistencyPanelMode; label: string }>).map(option => (
            <button key={`consistency-mode-${option.id}`} onClick={() => onModeChange(option.id)} className={`px-2.5 py-1.5 rounded-lg border transition-colors ${mode === option.id ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>{option.label}</button>
          ))}
        </div>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400">
        Questoes na ultima semana: <strong>{weeklyQuestionsMade}</strong> | Tempo hoje: <strong>{todayStudyMinutes} min</strong>
      </div>

      {(mode === 'radial' || mode === 'both') ? (
        <RadialPanel
          todayQuestionsMade={todayQuestionsMade}
          dailyQuestionsTarget={goals.dailyQuestionsTarget}
          onDailyTargetChange={onDailyTargetChange}
        />
      ) : null}

      {(mode === 'heatmap' || mode === 'both') ? (
        <HeatmapPanel
          heatmapDays={heatmapDays}
          streakCurrent={streakCurrent}
          streakLongest={streakLongest}
        />
      ) : null}

      {mode === 'evolution' ? (
        <EvolutionPanel
          evolutionTrend={evolutionTrend}
          last14Total={last14Total}
          last14Correct={last14Correct}
          todayQuestionsMade={todayQuestionsMade}
          evolutionDays={evolutionDays}
          evolutionMax={evolutionMax}
        />
      ) : null}

      <WeekComparisonCard weekComparison={weekComparison} accuracyDeltaPp={accuracyDeltaPp} />

      <StudyTimer subjects={subjects} onSessionEnd={onSessionEnd} />

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 px-2.5 py-2 text-xs text-cyan-700 dark:text-cyan-200">Tempo hoje: <strong>{todayStudyMinutes}</strong> min</div>
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-2.5 py-2 text-xs text-blue-700 dark:text-blue-200">Tempo semana: <strong>{weeklyStudyMinutes}</strong> min</div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-slate-600 dark:text-slate-300">Meta semanal revisoes</span>
            <span className="text-slate-500">{weeklyReviews}/{goals.weeklyReviewTarget}</span>
          </div>
          <label className="sr-only" htmlFor="goal-weekly-reviews">Meta semanal de revisoes</label>
          <input
            id="goal-weekly-reviews"
            aria-label="Meta semanal de revisoes"
            type="number"
            min={1}
            max={100}
            value={goals.weeklyReviewTarget}
            onChange={event => onWeeklyReviewTargetChange(Number(event.target.value))}
            className="mt-2 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs"
          />
          <div role="progressbar" aria-valuenow={weeklyReviews} aria-valuemin={0} aria-valuemax={goals.weeklyReviewTarget} className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-2 rounded-full bg-violet-500 transition-all duration-500" style={{ width: `${Math.min(100, (weeklyReviews / Math.max(1, goals.weeklyReviewTarget)) * 100)}%` }} />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-slate-600 dark:text-slate-300">Meta semanal redacoes</span>
            <span className="text-slate-500">{weeklyEssays}/{goals.weeklyEssayTarget}</span>
          </div>
          <label className="sr-only" htmlFor="goal-weekly-essays">Meta semanal de redacoes</label>
          <input
            id="goal-weekly-essays"
            aria-label="Meta semanal de redacoes"
            type="number"
            min={1}
            max={14}
            value={goals.weeklyEssayTarget}
            onChange={event => onWeeklyEssayTargetChange(Number(event.target.value))}
            className="mt-2 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs"
          />
          <div role="progressbar" aria-valuenow={weeklyEssays} aria-valuemin={0} aria-valuemax={goals.weeklyEssayTarget} className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-2 rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, (weeklyEssays / Math.max(1, goals.weeklyEssayTarget)) * 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-200 inline-flex items-center gap-2">
        <CheckCircle2 size={14} /> Dias ativos no historico: {streakActiveDays}
      </div>
    </div>
  );
}
