interface CircularProgressProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

function CircularProgress({ value, max, size = 120, strokeWidth = 10, color = 'text-cyan-500' }: CircularProgressProps) {
  const safeMax = Math.max(1, max);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.min(value / safeMax, 1);
  const dashoffset = circumference - progress * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-slate-100 dark:text-slate-800" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} strokeDashoffset={dashoffset} strokeLinecap="round" className={`transition-all duration-1000 ease-out ${color}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-700 dark:text-white">{value}</span>
        <span className="text-[10px] text-slate-400 uppercase tracking-wide">de {safeMax}</span>
      </div>
    </div>
  );
}

interface RadialPanelProps {
  todayQuestionsMade: number;
  dailyQuestionsTarget: number;
  onDailyTargetChange: (value: number) => void;
}

export function RadialPanel({ todayQuestionsMade, dailyQuestionsTarget, onDailyTargetChange }: RadialPanelProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between gap-4">
      <div className="space-y-1">
        <p className="font-medium text-slate-600 dark:text-slate-300 text-sm">Meta diaria</p>
        <p className="text-xs text-slate-500 max-w-[170px]">Mantenha o ritmo para bater a meta de hoje.</p>
        <label className="sr-only" htmlFor="goal-daily">Meta diaria de questoes</label>
        <input
          id="goal-daily"
          aria-label="Meta diaria de questoes"
          type="number"
          min={1}
          max={200}
          value={dailyQuestionsTarget}
          onChange={event => onDailyTargetChange(Number(event.target.value))}
          className="mt-2 w-20 bg-transparent border-b border-slate-300 dark:border-slate-600 text-xs focus:outline-none text-center"
        />
        <p className="text-[11px] text-slate-400">{todayQuestionsMade}/{dailyQuestionsTarget}</p>
      </div>
      <CircularProgress value={todayQuestionsMade} max={dailyQuestionsTarget} size={100} color="text-cyan-500 dark:text-cyan-400" />
    </div>
  );
}
