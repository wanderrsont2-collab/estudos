import { useMemo, useState } from 'react';
import { Plus, Trash2, Clock3, X, Check } from 'lucide-react';
import type { ScheduleCellData, Subject, WeeklySchedule } from '../types';
import { generateId } from '../store';

interface ScheduleWidgetProps {
  subjects: Subject[];
  schedule: WeeklySchedule;
  onUpdateSchedule: (schedule: WeeklySchedule) => void;
}

interface EditingCellRef {
  rowId: string;
  colIndex: number;
}

export function ScheduleWidget({ subjects, schedule, onUpdateSchedule }: ScheduleWidgetProps) {
  const [editingCell, setEditingCell] = useState<EditingCellRef | null>(null);
  const [editForm, setEditForm] = useState<{ text: string; subjectId: string }>({ text: '', subjectId: '' });
  const [isAddingTime, setIsAddingTime] = useState(false);
  const [newTime, setNewTime] = useState('');

  const subjectById = useMemo(
    () => new Map(subjects.map(subject => [subject.id, subject])),
    [subjects],
  );

  function getCellBg(cell: ScheduleCellData) {
    if (!cell.subjectId) return '#f8fafc';
    const subject = subjectById.get(cell.subjectId);
    if (!subject) return '#f8fafc';
    return subject.colorLight || '#f1f5f9';
  }

  function getCellTextClass(cell: ScheduleCellData) {
    if (!cell.subjectId) return 'text-slate-500 dark:text-slate-400';
    const subject = subjectById.get(cell.subjectId);
    if (!subject) return 'text-slate-500 dark:text-slate-400';
    return 'font-medium';
  }

  function getCellTextColor(cell: ScheduleCellData) {
    if (!cell.subjectId) return undefined;
    return subjectById.get(cell.subjectId)?.color;
  }

  function handleCellClick(rowId: string, colIndex: number, cell: ScheduleCellData) {
    setEditingCell({ rowId, colIndex });
    setEditForm({
      text: cell.text,
      subjectId: cell.subjectId || '',
    });
  }

  function closeEditModal() {
    setEditingCell(null);
  }

  function saveCell() {
    if (!editingCell) return;
    const nextRows = schedule.rows.map(row => {
      if (row.id !== editingCell.rowId) return row;
      const nextCells = [...row.cells];
      nextCells[editingCell.colIndex] = {
        text: editForm.text,
        subjectId: editForm.subjectId || undefined,
      };
      return { ...row, cells: nextCells };
    });

    onUpdateSchedule({
      ...schedule,
      rows: nextRows,
    });
    closeEditModal();
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
          <h2 className="text-sm md:text-base font-semibold text-slate-800 dark:text-slate-100">Cronograma semanal</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Clique na célula para editar matéria e conteúdo.</p>
        </div>
        <button
          onClick={() => setIsAddingTime(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <Plus size={14} /> Novo horário
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[820px] w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="text-left text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 rounded-tl-lg border border-slate-200 dark:border-slate-700 w-[130px]">
                Horário
              </th>
              {schedule.columns.map((column, idx) => (
                <th
                  key={`schedule-col-${column}-${idx}`}
                  className={`text-center text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-2 py-2 border-t border-b border-slate-200 dark:border-slate-700 ${
                    idx === schedule.columns.length - 1 ? 'border-r rounded-tr-lg' : 'border-r'
                  }`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedule.rows.map(row => (
              <tr key={row.id} className="group">
                <td className="px-3 py-2 border-b border-l border-r border-slate-200 dark:border-slate-700 align-top">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 font-medium">
                      <Clock3 size={13} className="text-slate-400" />
                      {row.timeLabel}
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
                {row.cells.map((cell, colIndex) => (
                  <td
                    key={`${row.id}-${colIndex}`}
                    className="p-1.5 border-b border-r border-slate-200 dark:border-slate-700 align-top"
                  >
                    <button
                      onClick={() => handleCellClick(row.id, colIndex, cell)}
                      className={`w-full h-14 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-600 transition-colors px-2 text-xs text-center leading-tight ${getCellTextClass(cell)}`}
                      style={{ backgroundColor: getCellBg(cell), color: getCellTextColor(cell) }}
                    >
                      {cell.text.trim() || <Plus size={12} className="mx-auto opacity-35" />}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingCell && (
        <div className="fixed inset-0 z-[80] bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Editar célula</h3>
              <button
                onClick={closeEditModal}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Matéria</label>
                <select
                  value={editForm.subjectId}
                  onChange={event => setEditForm(prev => ({ ...prev, subjectId: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  <option value="">Sem matéria</option>
                  {subjects.map(subject => (
                    <option key={`schedule-subject-option-${subject.id}`} value={subject.id}>
                      {subject.emoji} {subject.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Conteúdo</label>
                <input
                  value={editForm.text}
                  onChange={event => setEditForm(prev => ({ ...prev, text: event.target.value }))}
                  placeholder="Ex: Revisão FSRS"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-sm text-slate-700 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  autoFocus
                />
              </div>

              <div className="pt-1 flex items-center justify-end gap-2">
                <button
                  onClick={closeEditModal}
                  className="px-3 py-2 rounded-lg text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveCell}
                  className="px-3 py-2 rounded-lg text-sm bg-cyan-600 text-white hover:bg-cyan-700 inline-flex items-center gap-1.5"
                >
                  <Check size={14} /> Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

