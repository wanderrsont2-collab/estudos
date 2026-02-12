import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ScheduleCellData, Subject, WeeklySchedule } from '../types';
import { generateId } from '../store';

interface ScheduleWidgetProps {
  subjects: Subject[];
  schedule: WeeklySchedule;
  onUpdateSchedule: (schedule: WeeklySchedule) => void;
}

interface VisibleColumn {
  label: string;
  index: number;
}

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function normalizeDayLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function normalizeScheduleColumns(schedule: WeeklySchedule): WeeklySchedule | null {
  const normalizedColumns = schedule.columns.map(column => normalizeDayLabel(column));

  const hasExactColumns =
    schedule.columns.length === WEEKDAYS.length &&
    WEEKDAYS.every((day, index) => normalizedColumns[index] === normalizeDayLabel(day));

  const hasValidRows = schedule.rows.every(row => row.cells.length === WEEKDAYS.length);

  if (hasExactColumns && hasValidRows) return null;

  const normalizedRows = schedule.rows.map(row => {
    const nextCells = WEEKDAYS.map(day => {
      const oldIndex = schedule.columns.findIndex(column => normalizeDayLabel(column) === normalizeDayLabel(day));
      if (oldIndex >= 0 && oldIndex < row.cells.length) {
        const existingCell = row.cells[oldIndex] ?? { text: '' };
        return {
          text: existingCell.text || '',
          subjectId: existingCell.subjectId || undefined,
        };
      }
      return { text: '' };
    });

    return {
      ...row,
      cells: nextCells,
    };
  });

  return {
    columns: [...WEEKDAYS],
    rows: normalizedRows,
  };
}

export function ScheduleWidget({ subjects, schedule, onUpdateSchedule }: ScheduleWidgetProps) {
  const [isAddingTime, setIsAddingTime] = useState(false);
  const [newTime, setNewTime] = useState('');

  const subjectById = useMemo(
    () => new Map(subjects.map(subject => [subject.id, subject])),
    [subjects],
  );

  useEffect(() => {
    const normalized = normalizeScheduleColumns(schedule);
    if (normalized) onUpdateSchedule(normalized);
  }, [schedule, onUpdateSchedule]);

  const visibleColumns = useMemo<VisibleColumn[]>(() => {
    return WEEKDAYS
      .map(label => {
        const foundIndex = schedule.columns.findIndex(column => normalizeDayLabel(column) === normalizeDayLabel(label));
        if (foundIndex < 0) return null;
        return { label, index: foundIndex };
      })
      .filter((column): column is VisibleColumn => column !== null);
  }, [schedule.columns]);

  function getCell(rowId: string, colIndex: number): ScheduleCellData {
    const row = schedule.rows.find(item => item.id === rowId);
    if (!row) return { text: '' };
    return row.cells[colIndex] ?? { text: '' };
  }

  function updateCellSubject(rowId: string, colIndex: number, subjectId: string) {
    const nextRows = schedule.rows.map(row => {
      if (row.id !== rowId) return row;
      const nextCells = [...row.cells];
      nextCells[colIndex] = {
        text: '',
        subjectId: subjectId || undefined,
      };
      return { ...row, cells: nextCells };
    });

    onUpdateSchedule({
      ...schedule,
      rows: nextRows,
    });
  }

  function addTimeRow() {
    if (!newTime) return;
    const nextRows = [
      ...schedule.rows,
      {
        id: 'sched_' + generateId(),
        timeLabel: newTime,
        cells: Array.from({ length: schedule.columns.length }, (): ScheduleCellData => ({ text: '' })),
      },
    ].sort((a, b) => a.timeLabel.localeCompare(b.timeLabel, 'pt-BR'));

    onUpdateSchedule({
      ...schedule,
      rows: nextRows,
    });
    setNewTime('');
    setIsAddingTime(false);
  }

  function deleteRow(rowId: string) {
    if (schedule.rows.length <= 1) return;
    onUpdateSchedule({
      ...schedule,
      rows: schedule.rows.filter(row => row.id !== rowId),
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm md:text-base font-semibold text-slate-800 dark:text-slate-100">Cronograma semanal (segunda a domingo)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Selecione a disciplina em cada célula usando a mesma lista da barra lateral.</p>
        </div>
        <button
          onClick={() => setIsAddingTime(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <Plus size={14} /> Novo horário
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="text-left text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 rounded-tl-lg border border-slate-200 dark:border-slate-700 w-[150px]">
                Horários
              </th>
              {visibleColumns.map((column, idx) => (
                <th
                  key={`schedule-col-${column.label}-${idx}`}
                  className={`text-center text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-2 py-2 border-t border-b border-slate-200 dark:border-slate-700 ${
                    idx === visibleColumns.length - 1 ? 'border-r rounded-tr-lg' : 'border-r'
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedule.rows.map(row => (
              <tr key={row.id} className="group">
                <td className="px-3 py-2 border-b border-l border-r border-slate-200 dark:border-slate-700 align-top">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-700 dark:text-slate-200 font-medium whitespace-nowrap">
                      {row.timeLabel || '--:--'}
                    </span>
                    <button
                      onClick={() => deleteRow(row.id)}
                      disabled={schedule.rows.length <= 1}
                      className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Remover horário"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
                {visibleColumns.map(column => {
                  const cell = getCell(row.id, column.index);
                  const subject = cell.subjectId ? subjectById.get(cell.subjectId) : undefined;
                  return (
                    <td
                      key={`${row.id}-${column.index}`}
                      className="p-1.5 border-b border-r border-slate-200 dark:border-slate-700 align-top"
                      style={subject?.colorLight ? { backgroundColor: subject.colorLight } : undefined}
                    >
                      <select
                        value={cell.subjectId || ''}
                        onChange={event => updateCellSubject(row.id, column.index, event.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      >
                        <option value="">Sem disciplina</option>
                        {subjects.map(subjectOption => (
                          <option key={`schedule-select-${row.id}-${column.index}-${subjectOption.id}`} value={subjectOption.id}>
                            {subjectOption.emoji} {subjectOption.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAddingTime && (
        <div className="fixed inset-0 z-[80] bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-4">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Novo horário</h3>
            <input
              type="time"
              value={newTime}
              onChange={event => setNewTime(event.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-sm text-slate-700 dark:text-slate-100"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsAddingTime(false)}
                className="px-3 py-2 rounded-lg text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={addTimeRow}
                className="px-3 py-2 rounded-lg text-sm bg-cyan-600 text-white hover:bg-cyan-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
