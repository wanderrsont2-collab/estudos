import { CalendarClock, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ScheduleCellData, Subject, WeeklySchedule } from '../types';
import { generateId } from '../store';

interface ScheduleWidgetProps {
  subjects: Subject[];
  schedule: WeeklySchedule;
  onUpdateSchedule: (schedule: WeeklySchedule) => void;
}

const CANONICAL_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
type CanonicalWeekday = (typeof CANONICAL_WEEKDAYS)[number];

const DAY_ALIASES: Record<string, CanonicalWeekday> = {
  monday: 'Monday',
  segunda: 'Monday',
  tuesday: 'Tuesday',
  terca: 'Tuesday',
  wednesday: 'Wednesday',
  quarta: 'Wednesday',
  thursday: 'Thursday',
  quinta: 'Thursday',
  friday: 'Friday',
  sexta: 'Friday',
  saturday: 'Saturday',
  sabado: 'Saturday',
  sunday: 'Sunday',
  domingo: 'Sunday',
};

const DAY_LABELS: Record<CanonicalWeekday, { short: string; full: string }> = {
  Monday: { short: 'seg', full: 'Segunda' },
  Tuesday: { short: 'ter', full: 'Terca' },
  Wednesday: { short: 'qua', full: 'Quarta' },
  Thursday: { short: 'qui', full: 'Quinta' },
  Friday: { short: 'sex', full: 'Sexta' },
  Saturday: { short: 'sab', full: 'Sabado' },
  Sunday: { short: 'dom', full: 'Domingo' },
};

interface DayColumn {
  index: number;
  key: string;
  canonical: CanonicalWeekday;
  shortLabel: string;
  fullLabel: string;
  isToday: boolean;
}

interface DaySlot {
  rowId: string;
  rowLabel: string;
  subjectId?: string;
  note: string;
  startTime: string;
  endTime: string;
}

function normalizeDayLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function toCanonicalDayLabel(value: string): CanonicalWeekday | null {
  return DAY_ALIASES[normalizeDayLabel(value)] ?? null;
}

function getTodayCanonical(): CanonicalWeekday {
  const dayIndex = new Date().getDay();
  return CANONICAL_WEEKDAYS[dayIndex === 0 ? 6 : dayIndex - 1];
}

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatMinutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseTimeRange(label: string): { start: string; end: string } | null {
  const match = /(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/.exec(label);
  if (!match) return null;
  return { start: match[1], end: match[2] };
}

function normalizeTimeRange(startTime: string, endTime: string): { start: string; end: string } {
  const fallbackStart = '08:00';
  const fallbackEnd = '09:00';

  let start = parseTimeToMinutes(startTime);
  let end = parseTimeToMinutes(endTime);

  if (start === null) start = parseTimeToMinutes(fallbackStart) as number;
  if (end === null) end = parseTimeToMinutes(fallbackEnd) as number;

  if (end <= start) {
    end = Math.min(23 * 60 + 59, start + 60);
  }

  return {
    start: formatMinutesToTime(start),
    end: formatMinutesToTime(end),
  };
}

function buildTimeLabel(start: string, end: string): string {
  return `${start} - ${end}`;
}

function rowSortKey(timeLabel: string): number {
  const firstTime = /(\d{2}:\d{2})/.exec(timeLabel)?.[1];
  if (!firstTime) return Number.MAX_SAFE_INTEGER;
  return parseTimeToMinutes(firstTime) ?? Number.MAX_SAFE_INTEGER;
}

function hasCellContent(cell: ScheduleCellData | undefined): boolean {
  if (!cell) return false;
  if (cell.subjectId && cell.subjectId.trim().length > 0) return true;
  return (cell.text || '').trim().length > 0;
}

function createEmptyCell(): ScheduleCellData {
  return { text: '' };
}

export function ScheduleWidget({ subjects, schedule, onUpdateSchedule }: ScheduleWidgetProps) {
  const dayColumns = useMemo<DayColumn[]>(() => {
    const today = getTodayCanonical();
    return schedule.columns.map((column, index) => {
      const fallback = CANONICAL_WEEKDAYS[index % CANONICAL_WEEKDAYS.length];
      const canonical = toCanonicalDayLabel(column) ?? fallback;
      return {
        index,
        key: `${canonical}-${index}`,
        canonical,
        shortLabel: DAY_LABELS[canonical].short,
        fullLabel: DAY_LABELS[canonical].full,
        isToday: canonical === today,
      };
    });
  }, [schedule.columns]);

  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const todayIndex = dayColumns.findIndex(day => day.isToday);
    return todayIndex >= 0 ? todayIndex : 0;
  });

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editSubjectId, setEditSubjectId] = useState('');
  const [editStartTime, setEditStartTime] = useState('08:00');
  const [editEndTime, setEditEndTime] = useState('09:00');

  useEffect(() => {
    if (dayColumns.length === 0) {
      if (selectedDayIndex !== 0) setSelectedDayIndex(0);
      return;
    }

    setSelectedDayIndex(prev => {
      if (prev >= 0 && prev < dayColumns.length) return prev;
      const todayIndex = dayColumns.findIndex(day => day.isToday);
      return todayIndex >= 0 ? todayIndex : 0;
    });
  }, [dayColumns, selectedDayIndex]);

  useEffect(() => {
    if (!editingRowId) return;
    if (!schedule.rows.some(row => row.id === editingRowId)) {
      setEditingRowId(null);
    }
  }, [editingRowId, schedule.rows]);

  const selectedDay = dayColumns[selectedDayIndex] ?? null;

  const subjectById = useMemo(() => new Map(subjects.map(subject => [subject.id, subject])), [subjects]);

  const slots = useMemo<DaySlot[]>(() => {
    if (!selectedDay) return [];

    const nextSlots: DaySlot[] = [];
    for (const row of schedule.rows) {
      const cell = row.cells[selectedDay.index] ?? createEmptyCell();
      if (!hasCellContent(cell)) continue;

      const parsedTime = parseTimeRange(row.timeLabel);
      nextSlots.push({
        rowId: row.id,
        rowLabel: row.timeLabel,
        subjectId: cell.subjectId,
        note: cell.text || '',
        startTime: parsedTime?.start ?? '08:00',
        endTime: parsedTime?.end ?? '09:00',
      });
    }

    return nextSlots.sort((a, b) => rowSortKey(a.rowLabel) - rowSortKey(b.rowLabel));
  }, [schedule.rows, selectedDay]);

  function sortRows(rows: WeeklySchedule['rows']): WeeklySchedule['rows'] {
    return [...rows].sort((a, b) => {
      const diff = rowSortKey(a.timeLabel) - rowSortKey(b.timeLabel);
      if (diff !== 0) return diff;
      return a.timeLabel.localeCompare(b.timeLabel, 'pt-BR');
    });
  }

  function openEdit(slot: DaySlot) {
    setEditingRowId(slot.rowId);
    setEditSubjectId(slot.subjectId || (subjects[0]?.id || ''));
    setEditStartTime(slot.startTime);
    setEditEndTime(slot.endTime);
  }

  function saveEdit(rowId: string) {
    if (!selectedDay || subjects.length === 0) return;

    const normalizedSubjectId = editSubjectId.trim() || subjects[0].id;
    const normalizedTime = normalizeTimeRange(editStartTime, editEndTime);

    const nextRows = schedule.rows.map(row => {
      if (row.id !== rowId) return row;
      const nextCells = [...row.cells];
      nextCells[selectedDay.index] = {
        text: '',
        subjectId: normalizedSubjectId,
      };
      return {
        ...row,
        timeLabel: buildTimeLabel(normalizedTime.start, normalizedTime.end),
        cells: nextCells,
      };
    });

    onUpdateSchedule({
      ...schedule,
      rows: sortRows(nextRows),
    });

    setEditingRowId(null);
  }

  function addSlot() {
    if (!selectedDay || subjects.length === 0 || schedule.columns.length === 0) return;

    const cells = Array.from({ length: schedule.columns.length }, (): ScheduleCellData => ({ text: '' }));
    const defaultSubjectId = subjects[0].id;
    cells[selectedDay.index] = { text: '', subjectId: defaultSubjectId };

    const newRow = {
      id: 'sched_' + generateId(),
      timeLabel: buildTimeLabel('08:00', '09:00'),
      cells,
    };

    const nextRows = sortRows([...schedule.rows, newRow]);

    onUpdateSchedule({
      ...schedule,
      rows: nextRows,
    });

    setEditingRowId(newRow.id);
    setEditSubjectId(defaultSubjectId);
    setEditStartTime('08:00');
    setEditEndTime('09:00');
  }

  function removeSlot(rowId: string) {
    if (!selectedDay) return;

    const rowToUpdate = schedule.rows.find(row => row.id === rowId);
    if (!rowToUpdate) return;

    const hasContentInOtherDays = rowToUpdate.cells.some((cell, index) => index !== selectedDay.index && hasCellContent(cell));

    if (hasContentInOtherDays) {
      const nextRows = schedule.rows.map(row => {
        if (row.id !== rowId) return row;
        const nextCells = [...row.cells];
        nextCells[selectedDay.index] = createEmptyCell();
        return { ...row, cells: nextCells };
      });

      onUpdateSchedule({
        ...schedule,
        rows: nextRows,
      });
      if (editingRowId === rowId) setEditingRowId(null);
      return;
    }

    onUpdateSchedule({
      ...schedule,
      rows: schedule.rows.filter(row => row.id !== rowId),
    });

    if (editingRowId === rowId) setEditingRowId(null);
  }

  return (
    <div className="animate-fade-in rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarClock size={18} className="text-cyan-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Cronograma</h3>
          </div>
          <button
            onClick={addSlot}
            disabled={!selectedDay || subjects.length === 0}
            className="text-[11px] font-semibold text-cyan-600 hover:text-cyan-700 inline-flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} /> Adicionar
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-4">
          {dayColumns.map((day, index) => (
            <button
              key={day.key}
              onClick={() => setSelectedDayIndex(index)}
              className={`py-2 rounded-lg text-[11px] font-bold uppercase transition-all ${
                selectedDayIndex === index
                  ? 'bg-gradient-to-b from-cyan-500 to-cyan-600 text-white shadow-md shadow-cyan-500/20'
                  : day.isToday
                    ? 'bg-cyan-50 dark:bg-cyan-950/20 text-cyan-600 dark:text-cyan-400 border border-cyan-200/50 dark:border-cyan-800/30'
                    : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {day.shortLabel}
            </button>
          ))}
        </div>

        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-3">
          {selectedDay?.fullLabel ?? 'Dia'}
        </p>

        {subjects.length === 0 ? (
          <div className="text-center py-6 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-400">Cadastre disciplinas para montar o cronograma.</p>
          </div>
        ) : slots.length === 0 ? (
          <div className="text-center py-6 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
            <CalendarClock size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-xs text-slate-400">Nenhum bloco agendado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {slots.map(slot => {
              const subject = slot.subjectId ? subjectById.get(slot.subjectId) : undefined;
              const isEditing = editingRowId === slot.rowId;

              return (
                <div
                  key={slot.rowId}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-800/30 group hover:border-slate-200 dark:hover:border-slate-700 transition-all"
                >
                  <div className="w-1 h-10 rounded-full" style={{ backgroundColor: subject?.color || '#94a3b8' }} />

                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_88px_88px] gap-2">
                        <select
                          value={editSubjectId}
                          onChange={event => setEditSubjectId(event.target.value)}
                          className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200"
                        >
                          {subjects.map(item => (
                            <option key={`edit-slot-subject-${slot.rowId}-${item.id}`} value={item.id}>
                              {item.emoji} {item.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="time"
                          value={editStartTime}
                          onChange={event => setEditStartTime(event.target.value)}
                          className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200"
                        />
                        <input
                          type="time"
                          value={editEndTime}
                          onChange={event => setEditEndTime(event.target.value)}
                          className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200"
                        />
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                          {subject ? `${subject.emoji} ${subject.name}` : (slot.note || 'Bloco manual')}
                        </p>
                        <p className="text-[11px] text-slate-400">{slot.rowLabel}</p>
                      </>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => saveEdit(slot.rowId)}
                        className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-slate-400 hover:text-emerald-500"
                        title="Salvar"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingRowId(null)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-500"
                        title="Cancelar"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(slot)}
                        className="p-1.5 rounded-lg hover:bg-cyan-50 dark:hover:bg-cyan-950/20 text-slate-400 hover:text-cyan-500"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => removeSlot(slot.rowId)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-500"
                        title="Remover bloco"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
