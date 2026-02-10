import { Subject, WeeklySchedule } from '../types';
import {
  getOverallStats,
  getSubjectStats,
  getUpcomingDeadlines,
  getPriorityStats,
  getDeadlineInfo,
  getAllTopics,
  getReviewsDue,
} from '../store';
import { getReviewStatus } from '../fsrs';
import {
  ArrowRight,
  AlertTriangle,
  Brain,
  Calendar,
  Clock3,
  Plus,
  Trash2,
  LayoutGrid,
  Target,
  TrendingUp,
} from 'lucide-react';

interface OverviewProps {
  subjects: Subject[];
  schedule: WeeklySchedule;
  onUpdateSchedule: (schedule: WeeklySchedule) => void;
  onSelectSubject: (id: string) => void;
  onOpenReviews: () => void;
}

const BASE_WEEK_COLUMNS = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado', 'Domingo'];

function formatPercent(v: number) {
  return `${Math.round(v * 100)}%`;
}

function scheduleRowId() {
  return 'sched_row_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function toIsoDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCalendarDayLabel(isoDate: string) {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

export function Overview({
  subjects,
  schedule,
  onUpdateSchedule,
  onSelectSubject,
  onOpenReviews,
}: OverviewProps) {
  const overall = getOverallStats(subjects);
  const deadlines = getUpcomingDeadlines(subjects);
  const priorityStats = getPriorityStats(subjects);
  const reviewsDue = getReviewsDue(subjects);

  const activeReviewTopics = subjects.reduce(
    (sum, subject) => sum + getAllTopics(subject).filter(topic => topic.reviewHistory.length > 0).length,
    0,
  );

  const totalReviews = subjects.reduce(
    (sum, subject) => sum + getAllTopics(subject).reduce((topicSum, topic) => topicSum + topic.reviewHistory.length, 0),
    0,
  );

  const overdueDeadlines = deadlines.filter(item => getDeadlineInfo(item.topic.deadline)?.urgency === 'overdue');
  const upcomingDeadlines = deadlines
    .filter(item => {
      const info = getDeadlineInfo(item.topic.deadline);
      return info && info.urgency !== 'overdue';
    })
    .slice(0, 8);

  const sortedSubjects = [...subjects]
    .map(subject => ({
      subject,
      stats: getSubjectStats(subject),
    }))
    .sort((a, b) => b.stats.progresso - a.stats.progresso);

  const scheduleSlotsTotal = schedule.rows.length * schedule.columns.length;
  const scheduleSlotsFilled = schedule.rows.reduce(
    (sum, row) => sum + row.cells.filter(cell => cell.trim().length > 0).length,
    0,
  );
  const scheduleItemsPlanned = schedule.rows.reduce(
    (sum, row) => sum + row.cells.reduce((cellSum, cell) => {
      const parts = cell
        .split(/\n|,/)
        .map(part => part.trim())
        .filter(Boolean);
      return cellSum + parts.length;
    }, 0),
    0,
  );
  const scheduleOccupancy = scheduleSlotsTotal > 0 ? scheduleSlotsFilled / scheduleSlotsTotal : 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reviewCalendarMap = new Map<string, {
    subjectId: string;
    subjectEmoji: string;
    subjectColor: string;
    topicId: string;
    groupName: string;
    topicName: string;
  }[]>();

  for (const subject of subjects) {
    for (const group of subject.topicGroups) {
      for (const topic of group.topics) {
        if (!topic.fsrsNextReview) continue;
        const reviewDate = new Date(topic.fsrsNextReview + 'T00:00:00');
        if (reviewDate < today) continue;

        const key = topic.fsrsNextReview;
        if (!reviewCalendarMap.has(key)) {
          reviewCalendarMap.set(key, []);
        }
        reviewCalendarMap.get(key)!.push({
          subjectId: subject.id,
          subjectEmoji: subject.emoji,
          subjectColor: subject.color,
          topicId: topic.id,
          groupName: group.name,
          topicName: topic.name,
        });
      }
    }
  }

  const reviewCalendarDays = Array.from({ length: 7 }, (_, offset) => {
    const dayDate = new Date(today);
    dayDate.setDate(today.getDate() + offset);
    const isoDate = toIsoDateLocal(dayDate);
    const items = (reviewCalendarMap.get(isoDate) ?? []).sort((a, b) => a.topicName.localeCompare(b.topicName));

    return {
      isoDate,
      label: formatCalendarDayLabel(isoDate),
      isToday: offset === 0,
      items,
    };
  });

  const reviewsInNext7Days = reviewCalendarDays.reduce((sum, day) => sum + day.items.length, 0);

  function updateScheduleColumns(nextColumns: string[]) {
    const sanitizedColumns = nextColumns.map(col => col.replace(/\s+/g, ' ').trimStart());
    const nextRows = schedule.rows.map(row => {
      const nextCells = Array.from({ length: sanitizedColumns.length }, (_, colIdx) => row.cells[colIdx] ?? '');
      return { ...row, cells: nextCells };
    });

    onUpdateSchedule({
      columns: sanitizedColumns,
      rows: nextRows,
    });
  }

  function updateColumnName(colIdx: number, value: string) {
    const nextColumns = [...schedule.columns];
    nextColumns[colIdx] = value;
    updateScheduleColumns(nextColumns);
  }

  function addColumn() {
    const nextColumns = [...schedule.columns, `Coluna ${schedule.columns.length + 1}`];
    updateScheduleColumns(nextColumns);
  }

  function removeColumn(colIdx: number) {
    if (colIdx < BASE_WEEK_COLUMNS.length) return;
    const nextColumns = schedule.columns.filter((_, idx) => idx !== colIdx);
    updateScheduleColumns(nextColumns);
  }

  function addRow() {
    const newRow = {
      id: scheduleRowId(),
      timeLabel: 'Novo horario',
      cells: Array.from({ length: schedule.columns.length }, () => ''),
    };

    onUpdateSchedule({
      ...schedule,
      rows: [...schedule.rows, newRow],
    });
  }

  function removeRow(rowId: string) {
    if (schedule.rows.length <= 1) return;
    onUpdateSchedule({
      ...schedule,
      rows: schedule.rows.filter(row => row.id !== rowId),
    });
  }

  function updateRowTime(rowId: string, value: string) {
    onUpdateSchedule({
      ...schedule,
      rows: schedule.rows.map(row => (row.id === rowId ? { ...row, timeLabel: value } : row)),
    });
  }

  function updateCell(rowId: string, colIdx: number, value: string) {
    onUpdateSchedule({
      ...schedule,
      rows: schedule.rows.map(row => {
        if (row.id !== rowId) return row;
        const nextCells = [...row.cells];
        nextCells[colIdx] = value;
        return { ...row, cells: nextCells };
      }),
    });
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <section className="rounded-3xl overflow-hidden bg-gradient-to-r from-cyan-900 via-slate-900 to-blue-900 text-white shadow-xl">
        <div className="px-5 md:px-7 py-6 md:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80 mb-2">Painel Central</p>
              <h1 className="text-2xl md:text-3xl font-extrabold leading-tight">Visao Geral + Cronograma Semanal</h1>
              <p className="text-sm text-slate-200 mt-1">Resumo rapido das disciplinas e sua planilha de segunda a domingo no mesmo lugar.</p>
            </div>
            <button
              onClick={onOpenReviews}
              className="rounded-xl bg-white/15 hover:bg-white/25 transition-colors px-4 py-2 text-sm font-medium inline-flex items-center gap-2"
            >
              <Brain size={16} /> Revisoes pendentes
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-2xl bg-white/10 p-3 border border-white/15">
              <p className="text-[11px] uppercase tracking-wide text-cyan-200">Conteudos</p>
              <p className="text-2xl font-bold mt-1">{overall.studiedTopics}/{overall.totalTopics}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 border border-white/15">
              <p className="text-[11px] uppercase tracking-wide text-cyan-200">Progresso</p>
              <p className="text-2xl font-bold mt-1">{formatPercent(overall.progresso)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 border border-white/15">
              <p className="text-[11px] uppercase tracking-wide text-cyan-200">Rendimento</p>
              <p className="text-2xl font-bold mt-1">{formatPercent(overall.rendimento)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 border border-white/15">
              <p className="text-[11px] uppercase tracking-wide text-cyan-200">Pendencias FSRS</p>
              <p className="text-2xl font-bold mt-1">{overall.reviewsDue}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 border border-white/15">
              <p className="text-[11px] uppercase tracking-wide text-cyan-200">Questoes</p>
              <p className="text-2xl font-bold mt-1">{overall.questionsCorrect}/{overall.questionsTotal}</p>
            </div>
          </div>
        </div>
      </section>

      {(overdueDeadlines.length > 0 || reviewsDue.length > 0) && (
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
              <AlertTriangle size={16} /> Prazos vencidos ({overdueDeadlines.length})
            </div>
            {overdueDeadlines.length === 0 ? (
              <p className="text-xs text-red-500 mt-2">Nenhum prazo vencido no momento.</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {overdueDeadlines.slice(0, 5).map(item => {
                  const subject = subjects.find(s => s.name === item.subjectName);
                  return (
                    <button
                      key={item.topic.id}
                      onClick={() => subject && onSelectSubject(subject.id)}
                      className="block w-full text-left text-xs text-red-700 bg-white/70 hover:bg-white px-2 py-1.5 rounded-lg transition-colors"
                    >
                      {item.subjectEmoji} {item.topic.name} ({item.groupName})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-indigo-700 font-semibold text-sm">
                <Brain size={16} /> Revisoes pendentes ({reviewsDue.length})
              </div>
              <button
                onClick={onOpenReviews}
                className="text-xs rounded-md bg-indigo-600 text-white px-2.5 py-1.5 hover:bg-indigo-700 transition-colors"
              >
                Abrir
              </button>
            </div>
            {reviewsDue.length === 0 ? (
              <p className="text-xs text-indigo-500 mt-2">Nenhuma revisao pendente.</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {reviewsDue.slice(0, 5).map(item => {
                  const status = getReviewStatus(item.topic.fsrsNextReview);
                  return (
                    <div key={item.topic.id} className="text-xs text-indigo-800 bg-white/70 px-2 py-1.5 rounded-lg flex items-center justify-between gap-2">
                      <span>{item.subjectEmoji} {item.topic.name}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${status.className}`}>{status.text}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.6fr] gap-5">
        <div className="space-y-5">
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 inline-flex items-center gap-2">
                <TrendingUp size={16} /> Desempenho por disciplina
              </h2>
              <span className="text-xs text-gray-400">{subjects.length} disciplinas</span>
            </div>
            <div className="divide-y divide-gray-100">
              {sortedSubjects.map(({ subject, stats }) => (
                <button
                  key={subject.id}
                  onClick={() => onSelectSubject(subject.id)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: subject.color }}>
                        {subject.emoji} {subject.name}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {stats.studied}/{stats.total} estudados - {stats.questionsCorrect}/{stats.questionsTotal} questoes
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-700">{formatPercent(stats.progresso)}</p>
                      <p className="text-[11px] text-gray-400">{formatPercent(stats.rendimento)} rend.</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.min(stats.progresso * 100, 100)}%`, backgroundColor: subject.color }} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-700 inline-flex items-center gap-2">
              <Target size={16} /> Prioridades e prazos
            </h2>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-red-50 border border-red-100 p-2.5">
                <p className="text-red-700 font-medium">Alta prioridade</p>
                <p className="text-xl font-bold text-red-700 mt-0.5">{priorityStats.alta}</p>
              </div>
              <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-2.5">
                <p className="text-yellow-700 font-medium">Media prioridade</p>
                <p className="text-xl font-bold text-yellow-700 mt-0.5">{priorityStats.media}</p>
              </div>
              <div className="rounded-lg bg-green-50 border border-green-100 p-2.5">
                <p className="text-green-700 font-medium">Baixa prioridade</p>
                <p className="text-xl font-bold text-green-700 mt-0.5">{priorityStats.baixa}</p>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-2.5">
                <p className="text-gray-600 font-medium">Sem prioridade</p>
                <p className="text-xl font-bold text-gray-700 mt-0.5">{priorityStats.sem}</p>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Proximos prazos</h3>
              {upcomingDeadlines.length === 0 ? (
                <p className="text-xs text-gray-400">Nenhum prazo definido.</p>
              ) : (
                <div className="space-y-1.5">
                  {upcomingDeadlines.map(item => {
                    const info = getDeadlineInfo(item.topic.deadline);
                    const subject = subjects.find(s => s.name === item.subjectName);
                    return (
                      <button
                        key={item.topic.id}
                        onClick={() => subject && onSelectSubject(subject.id)}
                        className="w-full text-left text-xs rounded-lg border border-gray-100 hover:border-gray-200 px-2.5 py-2 bg-gray-50 hover:bg-white transition-colors flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{item.subjectEmoji} {item.topic.name}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${info?.className || 'text-gray-500 bg-gray-100'}`}>
                          {info?.text || '-'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-cyan-900 to-blue-900 text-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold inline-flex items-center gap-2">
                  <LayoutGrid size={16} /> Cronograma semanal (planilha)
                </h2>
                <p className="text-xs text-slate-200 mt-1">Organize blocos de estudo, exercicios e revisoes por dia e horario.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={addRow}
                  className="text-xs rounded-lg bg-emerald-500 text-white px-3 py-1.5 hover:bg-emerald-400 transition-colors inline-flex items-center gap-1"
                >
                  <Plus size={13} /> Linha
                </button>
                <button
                  onClick={addColumn}
                  className="text-xs rounded-lg bg-white/15 text-white px-3 py-1.5 hover:bg-white/25 transition-colors inline-flex items-center gap-1"
                >
                  <Plus size={13} /> Coluna
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-visible bg-slate-50/70 dark:bg-slate-950">
            <table className="min-w-[940px] w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900">
                <tr>
                  <th className="border-b border-r border-slate-200 dark:border-slate-700 p-2.5 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 w-36 min-w-[140px]">
                    Horario
                  </th>
                  {schedule.columns.map((column, colIdx) => {
                    const removable = colIdx >= BASE_WEEK_COLUMNS.length;
                    return (
                      <th key={`col-${colIdx}`} className="border-b border-r border-slate-200 dark:border-slate-700 p-2.5 text-left align-top min-w-[150px]">
                        <div className="flex items-start gap-1">
                          <input
                            value={column}
                            onChange={event => updateColumnName(colIdx, event.target.value)}
                            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                          />
                          {removable && (
                            <button
                              onClick={() => removeColumn(colIdx)}
                              className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Remover coluna"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {schedule.rows.map((row, rowIdx) => (
                  <tr key={row.id} className="odd:bg-white even:bg-slate-50/50 dark:odd:bg-slate-900 dark:even:bg-slate-900/70">
                    <td className="border-b border-r border-slate-200 dark:border-slate-700 p-2.5 align-top bg-slate-50/90 dark:bg-slate-900 w-36 min-w-[140px]">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Bloco {rowIdx + 1}</label>
                          <input
                            value={row.timeLabel}
                            onChange={event => updateRowTime(row.id, event.target.value)}
                            className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                            placeholder="Ex: 14:00 - 15:30"
                          />
                        </div>
                        <button
                          onClick={() => removeRow(row.id)}
                          disabled={schedule.rows.length <= 1}
                          className="mt-5 p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Remover linha"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>

                    {schedule.columns.map((_, colIdx) => (
                      <td key={`${row.id}-${colIdx}`} className="border-b border-r border-slate-200 dark:border-slate-700 p-1.5 align-top">
                        <textarea
                          value={row.cells[colIdx] ?? ''}
                          onChange={event => updateCell(row.id, colIdx, event.target.value)}
                          rows={2}
                          className="w-full h-16 resize-none rounded-md border border-transparent bg-white dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                          placeholder="Tema, exercicio, revisao..."
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-4 bg-slate-50/80 dark:bg-slate-900 space-y-4">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
              <div className="rounded-xl bg-white dark:bg-slate-950 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Ocupacao</p>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-100 mt-0.5">{formatPercent(scheduleOccupancy)}</p>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-950 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Slots preenchidos</p>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-100 mt-0.5">{scheduleSlotsFilled}/{scheduleSlotsTotal}</p>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-950 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Itens planejados</p>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-100 mt-0.5">{scheduleItemsPlanned}</p>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-950 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Revisoes (7 dias)</p>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-100 mt-0.5">{reviewsInNext7Days}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-950 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100 inline-flex items-center gap-2">
                  <Calendar size={14} /> Calendario de proximas revisoes
                </h3>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-3">
                  <span className="inline-flex items-center gap-1"><Clock3 size={12} /> {schedule.rows.length} horarios</span>
                  <span className="inline-flex items-center gap-1"><Brain size={12} /> {activeReviewTopics} assuntos ativos</span>
                  <span className="inline-flex items-center gap-1"><ArrowRight size={12} /> {totalReviews} revisoes</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-2">
                {reviewCalendarDays.map(day => (
                  <div
                    key={day.isoDate}
                    className={`rounded-xl border px-3 py-2 ${
                      day.isToday
                        ? 'border-cyan-300 bg-cyan-50 dark:border-cyan-700 dark:bg-cyan-950/30'
                        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-100 uppercase">
                        {day.label}
                      </p>
                      <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                        {day.items.length}
                      </span>
                    </div>
                    {day.items.length === 0 ? (
                      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">Sem revisao</p>
                    ) : (
                      <div className="mt-2 space-y-1.5">
                        {day.items.slice(0, 3).map(item => (
                          <button
                            key={`${day.isoDate}-${item.topicId}`}
                            onClick={() => onSelectSubject(item.subjectId)}
                            className="w-full text-left rounded-lg bg-white dark:bg-slate-950 px-2 py-1.5 text-[11px] text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <span className="font-medium" style={{ color: item.subjectColor }}>
                              {item.subjectEmoji} {item.topicName}
                            </span>
                            <span className="block text-[10px] text-slate-400 dark:text-slate-500">{item.groupName}</span>
                          </button>
                        ))}
                        {day.items.length > 3 && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">+{day.items.length - 3} revisoes nesse dia</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
