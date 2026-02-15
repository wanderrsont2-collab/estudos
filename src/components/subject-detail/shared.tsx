import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Clock, Flag } from 'lucide-react';
import type { Priority } from '../../types';
import { cn } from '../../utils/cn';
import { getDeadlineInfo, PRIORITY_CONFIG } from '../../store';

export const PRIORITY_OPTIONS: Priority[] = ['alta', 'media', 'baixa'];
export const COMMON_TAG_PRESETS = ['dificil', 'medio', 'facil'] as const;

export function getStartOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function isReviewDue(nextReview: string | null): boolean {
  if (!nextReview) return false;
  return new Date(nextReview + 'T00:00:00') <= getStartOfToday();
}

export function parseNonNegativeInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
}

export function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('button, input, select, textarea, a, [role="button"], [data-no-select-toggle="true"]'));
}

export function getRingColorStyle(color: string): CSSProperties {
  return { '--tw-ring-color': color } as CSSProperties;
}

export function formatPercent(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full rounded-full h-3 overflow-hidden bg-gray-200 dark:bg-slate-800">
      <div
        className="h-3 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${Math.min(value * 100, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

interface StudiedToggleButtonProps {
  studied: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function StudiedToggleButton({
  studied,
  onToggle,
  size = 'md',
  className,
}: StudiedToggleButtonProps) {
  const [showBurst, setShowBurst] = useState(false);
  const prevStudiedRef = useRef(studied);

  useEffect(() => {
    if (studied && !prevStudiedRef.current) {
      setShowBurst(true);
      const timer = window.setTimeout(() => setShowBurst(false), 420);
      prevStudiedRef.current = studied;
      return () => window.clearTimeout(timer);
    }
    prevStudiedRef.current = studied;
    return undefined;
  }, [studied]);

  const sizeClass = size === 'sm'
    ? 'h-5 w-5 rounded-md'
    : 'h-6 w-6 rounded-lg';
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <motion.button
      type="button"
      onClick={event => {
        event.stopPropagation();
        onToggle();
      }}
      whileHover={{ scale: studied ? 1.03 : 1.06 }}
      whileTap={{ scale: 0.92 }}
      className={cn(
        'relative flex shrink-0 items-center justify-center border-2 transition-all duration-200',
        sizeClass,
        studied
          ? 'border-emerald-500 bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-300/45 dark:shadow-emerald-900/45'
          : 'border-slate-300 text-slate-300 hover:border-emerald-300 dark:border-slate-600 dark:text-slate-600 dark:hover:border-emerald-700',
        className,
      )}
      title={studied ? 'Marcar como pendente' : 'Marcar como estudado'}
    >
      <AnimatePresence>
        {showBurst && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-emerald-400/70"
            initial={{ scale: 0.72, opacity: 0.7 }}
            animate={{ scale: 1.65, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.42, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence initial={false} mode="wait">
        {studied ? (
          <motion.span
            key="checked"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="inline-flex items-center justify-center"
          >
            <Check size={iconSize} />
          </motion.span>
        ) : (
          <motion.span
            key="unchecked"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className={cn(
              'rounded-full bg-current/70',
              size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2',
            )}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function PriorityBadge({
  priority,
  onClick,
  size = 'sm',
}: {
  priority: Priority | null;
  onClick?: () => void;
  size?: 'sm' | 'xs';
}) {
  if (!priority) {
    if (!onClick) return null;
    return (
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-gray-300 dark:border-slate-600 text-gray-400 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-500 hover:text-gray-500 dark:hover:text-slate-300 transition-colors ${size === 'xs' ? 'text-[10px]' : 'text-xs'}`}
        title="Definir prioridade"
      >
        <Flag size={size === 'xs' ? 10 : 12} />
        <span>Prioridade</span>
      </button>
    );
  }

  const config = PRIORITY_CONFIG[priority];
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bg} ${config.color} font-medium transition-all hover:opacity-80 ${size === 'xs' ? 'text-[10px]' : 'text-xs'}`}
      title="Alterar prioridade"
    >
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </button>
  );
}

export function DeadlineBadge({ deadline, size = 'sm' }: { deadline: string | null; size?: 'sm' | 'xs' }) {
  const info = getDeadlineInfo(deadline);
  if (!info) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${info.className} ${size === 'xs' ? 'text-[10px]' : 'text-xs'}`}>
      {info.urgency === 'overdue' ? <AlertTriangle size={size === 'xs' ? 10 : 12} /> : <Clock size={size === 'xs' ? 10 : 12} />}
      {info.text}
    </span>
  );
}
