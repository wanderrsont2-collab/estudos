import { Flame, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { StudyGoals } from '../../types';
import type { ActivityDay, ConsistencyPanelMode, HeatmapDay } from './types';

interface ConsistencySectionProps {
  mode: ConsistencyPanelMode;
  onModeChange: (mode: ConsistencyPanelMode) => void;
  weeklyQuestionsMade: number;
  todayStudyMinutes: number;
  todayQuestionsMade: number;
  goals: StudyGoals;
  onDailyTargetChange: (value: number) => void;
  heatmapDays: HeatmapDay[];
  streakCurrent: number;
  streakLongest: number;
  evolutionTrend: number;
  last14Total: number;
  last14Correct: number;
  evolutionDays: ActivityDay[];
  evolutionMax: number;
}

const levelColors = [
  'bg-slate-100 dark:bg-slate-800',
  'bg-cyan-200 dark:bg-cyan-900',
  'bg-cyan-400 dark:bg-cyan-700',
  'bg-cyan-500 dark:bg-cyan-500',
  'bg-cyan-600 dark:bg-cyan-400',
] as const;

function getHeatmapLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count >= 30) return 4;
  if (count >= 20) return 3;
  if (count >= 10) return 2;
  if (count > 0) return 1;
  return 0;
}

function formatDayLabel(isoDate: string): string {
  const parsed = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(parsed.getTime())) return '--';
  return `${parsed.getDate()}/${parsed.getMonth() + 1}`;
}

function clampGoal(value: number): number {
  return Math.max(1, Math.min(200, Math.round(value)));
}

function toLinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

export function ConsistencySection({
  mode,
  onModeChange,
  weeklyQuestionsMade,
  todayStudyMinutes,
  todayQuestionsMade,
  goals,
  onDailyTargetChange,
  heatmapDays,
  streakCurrent,
  streakLongest,
  evolutionTrend,
  last14Total,
  last14Correct,
  evolutionDays,
  evolutionMax,
}: ConsistencySectionProps) {
  const panelMode = mode === 'line' ? 'line' : mode === 'evolution' ? 'evolution' : 'heatmap';
  const TrendIcon = evolutionTrend > 0 ? TrendingUp : evolutionTrend < 0 ? TrendingDown : Minus;
  const trendColor = evolutionTrend > 0 ? 'text-emerald-500' : evolutionTrend < 0 ? 'text-red-500' : 'text-slate-400';
  const dailyTarget = Math.max(1, goals.dailyQuestionsTarget);
  const lineChartPoints = evolutionDays.map((day, index) => {
    const step = evolutionDays.length > 1 ? 100 / (evolutionDays.length - 1) : 0;
    const x = index * step;
    const questionY = 34 - ((Math.max(0, day.questionsMade) / Math.max(1, evolutionMax)) * 28);
    const accuracyRatio = day.questionsMade > 0 ? day.questionsCorrect / day.questionsMade : 0;
    const accuracyY = 34 - (Math.max(0, Math.min(1, accuracyRatio)) * 28);
    return { x, questionY, accuracyY, day };
  });
  const questionsLinePath = toLinePath(lineChartPoints.map(point => ({ x: point.x, y: point.questionY })));
  const accuracyLinePath = toLinePath(lineChartPoints.map(point => ({ x: point.x, y: point.accuracyY })));
  const latestPoint = lineChartPoints[lineChartPoints.length - 1];
  const averageQuestions = evolutionDays.length > 0
    ? Math.round(evolutionDays.reduce((sum, day) => sum + day.questionsMade, 0) / evolutionDays.length)
    : 0;
  const overallAccuracy = last14Total > 0 ? Math.round((last14Correct / last14Total) * 100) : 0;

  return (
    <div className="animate-fade-in rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-orange-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Consistencia</h3>
          </div>
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => onModeChange('heatmap')}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                panelMode === 'heatmap'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                  : 'text-slate-500'
              }`}
            >
              Mapa
            </button>
            <button
              onClick={() => onModeChange('evolution')}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                panelMode === 'evolution'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                  : 'text-slate-500'
              }`}
            >
              Evolucao
            </button>
            <button
              onClick={() => onModeChange('line')}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                panelMode === 'line'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                  : 'text-slate-500'
              }`}
            >
              Linha
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200/50 dark:border-orange-800/30 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider font-bold text-orange-600/70 dark:text-orange-400/70">Streak</p>
            <p className="text-xl font-black text-orange-600 dark:text-orange-400">{streakCurrent}d</p>
            <p className="text-[10px] text-orange-500/60">Max: {streakLongest}d</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 border border-cyan-200/50 dark:border-cyan-800/30 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider font-bold text-cyan-600/70 dark:text-cyan-400/70">14 dias</p>
            <p className="text-xl font-black text-cyan-600 dark:text-cyan-400">{last14Total}</p>
            <p className="text-[10px] text-cyan-500/60">{last14Correct} corretas</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/30 dark:to-slate-800/50 border border-slate-200/50 dark:border-slate-700/30 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500/70">Tendencia</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon size={18} className={trendColor} />
              <span className={`text-lg font-black ${trendColor}`}>{Math.abs(Math.round(evolutionTrend * 100))}%</span>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Hoje: <span className="font-semibold">{todayQuestionsMade}/{dailyTarget}</span> questoes | Semana: <span className="font-semibold">{weeklyQuestionsMade}</span> | Tempo hoje: <span className="font-semibold">{todayStudyMinutes} min</span>
            </p>
            <div className="inline-flex items-center gap-1">
              <button
                onClick={() => onDailyTargetChange(clampGoal(dailyTarget - 1))}
                className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Diminuir meta diaria"
              >
                -
              </button>
              <span className="min-w-[56px] text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
                Meta {dailyTarget}
              </span>
              <button
                onClick={() => onDailyTargetChange(clampGoal(dailyTarget + 1))}
                className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Aumentar meta diaria"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {panelMode === 'heatmap' ? (
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-3">Ultimos dias</p>
            <div className="flex flex-wrap gap-[3px]">
              {heatmapDays.map((day, i) => {
                const level = getHeatmapLevel(day.count);
                return (
                  <div
                    key={day.date}
                    className={`w-3 h-3 rounded-[3px] ${levelColors[level]} transition-all duration-300 hover:scale-150 hover:ring-2 hover:ring-cyan-400/50`}
                    title={`${day.date}: ${day.count} questoes`}
                    style={{ animationDelay: `${i * 5}ms` }}
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 mt-3 justify-end">
              <span className="text-[10px] text-slate-400">Menos</span>
              {levelColors.map(color => (
                <div key={color} className={`w-3 h-3 rounded-[3px] ${color}`} />
              ))}
              <span className="text-[10px] text-slate-400">Mais</span>
            </div>
          </div>
        ) : panelMode === 'evolution' ? (
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-3">Ultimos 14 dias</p>
            <div className="flex items-end gap-1.5 h-28">
              {evolutionDays.map(day => {
                const questions = day.questionsMade;
                const correct = day.questionsCorrect;
                const height = evolutionMax > 0 ? (questions / evolutionMax) * 100 : 0;
                const correctRatio = questions > 0 ? correct / questions : 0;
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full relative flex-1 flex items-end">
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-cyan-500 to-cyan-400 dark:from-cyan-600 dark:to-cyan-400 transition-all duration-500 hover:from-cyan-400 hover:to-cyan-300 relative group"
                        style={{ height: `${Math.max(2, height)}%` }}
                      >
                        {correctRatio > 0 && (
                          <div
                            className="absolute bottom-0 left-0 right-0 rounded-t-md bg-emerald-400/40"
                            style={{ height: `${correctRatio * 100}%` }}
                          />
                        )}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {questions}q
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] text-slate-400 font-medium">{formatDayLabel(day.date)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-3">Evolucao em linha (14 dias)</p>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/30 p-3">
              <svg viewBox="0 0 100 40" className="w-full h-40 overflow-visible">
                <line x1="0" y1="34" x2="100" y2="34" className="stroke-slate-300 dark:stroke-slate-700" strokeWidth="0.5" />
                <line x1="0" y1="20" x2="100" y2="20" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="0.5" strokeDasharray="1.5 1.5" />
                <line x1="0" y1="6" x2="100" y2="6" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="0.5" strokeDasharray="1.5 1.5" />

                {questionsLinePath && (
                  <path
                    d={questionsLinePath}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {accuracyLinePath && (
                  <path
                    d={accuracyLinePath}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="2.2 1.8"
                  />
                )}

                {latestPoint && (
                  <>
                    <circle cx={latestPoint.x} cy={latestPoint.questionY} r="1.4" fill="#06b6d4" />
                    <circle cx={latestPoint.x} cy={latestPoint.accuracyY} r="1.2" fill="#10b981" />
                  </>
                )}
              </svg>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyan-500" />
                  Questoes/dia
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Acuracia
                </span>
                <span>Media diaria: <strong>{averageQuestions}</strong></span>
                <span>Acuracia 14d: <strong>{overallAccuracy}%</strong></span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
