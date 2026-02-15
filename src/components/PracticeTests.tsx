
import { useMemo, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import type {
  PracticeQuestionMark,
  PracticeQuestionStatus,
  PracticeTestEntry,
  PracticeTestsSettings,
} from '../types';
import { generateId } from '../store';
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Plus,
  Target,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';

interface PracticeTestsProps {
  settings: PracticeTestsSettings;
  onUpdateSettings: (settings: PracticeTestsSettings) => void;
}

type WindowFilter = '7d' | '30d' | '90d' | 'all';

const FILTER_OPTIONS: Array<{ id: WindowFilter; label: string }> = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'all', label: 'Tudo' },
];

function formatPercent(v: number) {
  return `${Math.round(v * 100)}%`;
}

function toDateOnlyString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateLabel(isoDate: string) {
  const parsed = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function getAccuracy(test: PracticeTestEntry): number {
  return test.totalQuestions > 0 ? test.correctAnswers / test.totalQuestions : 0;
}

function getThresholdDate(filter: WindowFilter, todayIso: string): string | null {
  if (filter === 'all') return null;
  const days = filter === '7d' ? 7 : filter === '30d' ? 30 : 90;
  const base = new Date(todayIso + 'T00:00:00');
  base.setDate(base.getDate() - (days - 1));
  return toDateOnlyString(base);
}

function buildLinePath(values: number[]): string {
  if (values.length === 0) return '';
  if (values.length === 1) return `M 0 ${28 - values[0] * 24}`;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 28 - (value * 24);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function updateQuestionMark(
  marks: PracticeQuestionMark[],
  questionNumber: number,
  nextStatus: PracticeQuestionStatus,
): PracticeQuestionMark[] {
  const map = new Map<number, PracticeQuestionStatus>(marks.map(mark => [mark.questionNumber, mark.status]));
  const current = map.get(questionNumber);
  if (current === nextStatus) map.delete(questionNumber);
  else map.set(questionNumber, nextStatus);

  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([qNumber, status]) => ({ questionNumber: qNumber, status }));
}

function withUpdatedTest(
  tests: PracticeTestEntry[],
  testId: string,
  updater: (test: PracticeTestEntry) => PracticeTestEntry,
): PracticeTestEntry[] {
  return tests.map(test => (test.id === testId ? updater(test) : test));
}

function SummaryCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
      <p className="text-[11px] text-gray-500 dark:text-slate-400">{title}</p>
      <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{value}</p>
      <p className="text-[11px] text-gray-500 dark:text-slate-400">{subtitle}</p>
    </div>
  );
}

export function PracticeTests({ settings, onUpdateSettings }: PracticeTestsProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [filterWindow, setFilterWindow] = useState<WindowFilter>('30d');
  const [collapsedQuestionGrids, setCollapsedQuestionGrids] = useState<Record<string, boolean>>({});
  const [draftDate, setDraftDate] = useState<string>(() => toDateOnlyString(new Date()));
  const [draftTotalQuestions, setDraftTotalQuestions] = useState<string>('');
  const [draftCorrectAnswers, setDraftCorrectAnswers] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  const sortedTests = useMemo(() => (
    [...settings.tests].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    })
  ), [settings.tests]);

  const todayIso = useMemo(() => toDateOnlyString(new Date()), []);

  const filteredTests = useMemo(() => {
    const threshold = getThresholdDate(filterWindow, todayIso);
    if (!threshold) return sortedTests;
    return sortedTests.filter(test => test.date >= threshold);
  }, [filterWindow, sortedTests, todayIso]);

  const selectedTest = useMemo(
    () => filteredTests.find(test => test.id === selectedTestId) ?? null,
    [filteredTests, selectedTestId],
  );

  const filteredAsc = useMemo(() => [...filteredTests].reverse(), [filteredTests]);

  const summary = useMemo(() => {
    const testsCount = filteredTests.length;
    const totalQuestions = filteredTests.reduce((sum, test) => sum + test.totalQuestions, 0);
    const correctAnswers = filteredTests.reduce((sum, test) => sum + test.correctAnswers, 0);
    const accuracy = totalQuestions > 0 ? correctAnswers / totalQuestions : 0;

    let best: PracticeTestEntry | null = null;
    for (const test of filteredTests) {
      if (!best) {
        best = test;
        continue;
      }
      const accCurrent = getAccuracy(test);
      const accBest = getAccuracy(best);
      if (accCurrent > accBest || (accCurrent === accBest && test.correctAnswers > best.correctAnswers)) {
        best = test;
      }
    }

    const latest = filteredTests[0] ?? null;

    return {
      testsCount,
      totalQuestions,
      correctAnswers,
      accuracy,
      best,
      latest,
      bestId: best?.id ?? null,
    };
  }, [filteredTests]);

  const linePath = useMemo(() => buildLinePath(filteredAsc.map(getAccuracy)), [filteredAsc]);

  function resetCreateForm() {
    setDraftDate(toDateOnlyString(new Date()));
    setDraftTotalQuestions('');
    setDraftCorrectAnswers('');
    setFormError(null);
  }

  function openCreateModal() {
    resetCreateForm();
    setIsCreateOpen(true);
  }

  function closeCreateModal() {
    setIsCreateOpen(false);
    setFormError(null);
  }

  function createPracticeTest() {
    const totalQuestions = Number.parseInt(draftTotalQuestions, 10);
    const correctAnswers = Number.parseInt(draftCorrectAnswers, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(draftDate)) {
      setFormError('Informe uma data valida.');
      return;
    }

    if (!Number.isFinite(totalQuestions) || totalQuestions < 1 || totalQuestions > 500) {
      setFormError('Total de questoes deve estar entre 1 e 500.');
      return;
    }

    if (!Number.isFinite(correctAnswers) || correctAnswers < 0 || correctAnswers > totalQuestions) {
      setFormError('Acertos deve ficar entre 0 e o total de questoes.');
      return;
    }

    const nowIso = new Date().toISOString();
    const nextTest: PracticeTestEntry = {
      id: `practice_${generateId()}`,
      date: draftDate,
      totalQuestions,
      correctAnswers,
      questionMarks: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    onUpdateSettings({ tests: [nextTest, ...settings.tests] });
    closeCreateModal();
  }

  function removePracticeTest(testId: string) {
    onUpdateSettings({ tests: settings.tests.filter(test => test.id !== testId) });
    setSelectedTestId(prev => (prev === testId ? null : prev));
  }

  function markQuestion(testId: string, questionNumber: number, status: PracticeQuestionStatus) {
    onUpdateSettings({
      tests: withUpdatedTest(settings.tests, testId, (test) => ({
        ...test,
        questionMarks: updateQuestionMark(test.questionMarks, questionNumber, status),
        updatedAt: new Date().toISOString(),
      })),
    });
  }

  function handleQuestionLeftClick(event: ReactMouseEvent<HTMLButtonElement>, testId: string, questionNumber: number) {
    event.preventDefault();
    markQuestion(testId, questionNumber, 'wrong');
  }

  function handleQuestionRightClick(event: ReactMouseEvent<HTMLButtonElement>, testId: string, questionNumber: number) {
    event.preventDefault();
    markQuestion(testId, questionNumber, 'mastered');
  }

  function toggleQuestionGrid(testId: string) {
    setCollapsedQuestionGrids(prev => ({
      ...prev,
      [testId]: !prev[testId],
    }));
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, testId: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setSelectedTestId(testId);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-white to-emerald-50/40 dark:from-slate-900 dark:to-slate-900 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Simulados</h1>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Grade em cartoes. Clique em um simulado para abrir os detalhes completos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1">
              {FILTER_OPTIONS.map(option => (
                <button
                  key={option.id}
                  onClick={() => setFilterWindow(option.id)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                    filterWindow === option.id
                      ? 'bg-emerald-600 text-white'
                      : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Plus size={14} /> Adicionar simulado
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard title="Tentativas" value={String(summary.testsCount)} subtitle={filterWindow === 'all' ? 'Historico completo' : `Janela ${filterWindow}`} />
        <SummaryCard title="Taxa media" value={formatPercent(summary.accuracy)} subtitle={`${summary.correctAnswers}/${summary.totalQuestions} acertos`} />
        <SummaryCard title="Melhor resultado" value={summary.best ? formatPercent(getAccuracy(summary.best)) : '--'} subtitle={summary.best ? formatDateLabel(summary.best.date) : 'Sem simulados'} />
        <SummaryCard title="Ultimo simulado" value={summary.latest ? formatPercent(getAccuracy(summary.latest)) : '--'} subtitle={summary.latest ? formatDateLabel(summary.latest.date) : 'Sem simulados'} />
      </div>

      <section className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-100 inline-flex items-center gap-2">
            <BarChart3 size={16} /> Evolucao de acerto
          </h2>
          <span className="text-[11px] text-gray-500 dark:text-slate-400">{filteredAsc.length} ponto(s)</span>
        </div>

        {filteredAsc.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-slate-400">Adicione simulados para visualizar o grafico.</p>
        ) : (
          <>
            <svg viewBox="0 0 100 30" className="w-full h-40">
              <line x1="0" y1="28" x2="100" y2="28" className="stroke-slate-300 dark:stroke-slate-700" strokeWidth="0.6" />
              <line x1="0" y1="16" x2="100" y2="16" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="0.5" strokeDasharray="1.4 1.4" />
              <line x1="0" y1="4" x2="100" y2="4" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="0.5" strokeDasharray="1.4 1.4" />
              {linePath ? (
                <path d={linePath} fill="none" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              ) : null}
            </svg>

            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-slate-400">
              <span>{formatDateLabel(filteredAsc[0].date)}</span>
              <span>{formatDateLabel(filteredAsc[filteredAsc.length - 1].date)}</span>
            </div>
          </>
        )}
      </section>

      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs text-gray-600 dark:text-slate-300 inline-flex items-center gap-2">
        <Target size={14} className="text-emerald-500" />
        Clique esquerdo: vermelho (erro/dificuldade) | Clique direito: verde (dominada).
      </div>

      {filteredTests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">Nenhum simulado na janela selecionada.</p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
          >
            <Plus size={14} /> Criar primeiro simulado
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTests.map(test => {
            const accuracy = getAccuracy(test);
            const wrongByScore = Math.max(0, test.totalQuestions - test.correctAnswers);
            const wrongMarked = test.questionMarks.filter(mark => mark.status === 'wrong').length;
            const masteredMarked = test.questionMarks.filter(mark => mark.status === 'mastered').length;

            return (
              <article
                key={test.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedTestId(test.id)}
                onKeyDown={event => handleCardKeyDown(event, test.id)}
                className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm hover:shadow-md hover:border-emerald-300/70 dark:hover:border-emerald-700 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateLabel(test.date)}</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{formatPercent(accuracy)}</p>
                  </div>
                  <button
                    onClick={event => {
                      event.stopPropagation();
                      removePracticeTest(test.id);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Remover simulado"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {summary.bestId === test.id ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 text-amber-700 bg-amber-100 dark:text-amber-200 dark:bg-amber-900/30">
                      <Trophy size={11} /> Melhor
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${Math.max(2, Math.min(100, accuracy * 100))}%` }} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                    <p className="text-slate-500 dark:text-slate-400">Acertos</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{test.correctAnswers}/{test.totalQuestions}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                    <p className="text-slate-500 dark:text-slate-400">Erros</p>
                    <p className="font-semibold text-red-600 dark:text-red-300">{wrongByScore}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                    <p className="text-slate-500 dark:text-slate-400">Revisar</p>
                    <p className="font-semibold text-red-600 dark:text-red-300">{wrongMarked}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                    <p className="text-slate-500 dark:text-slate-400">Dominadas</p>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-300">{masteredMarked}</p>
                  </div>
                </div>

                <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">Clique para abrir detalhes</p>
              </article>
            );
          })}
        </div>
      )}

      {selectedTest ? (() => {
        const questionStatusMap = new Map<number, PracticeQuestionStatus>(
          selectedTest.questionMarks.map(mark => [mark.questionNumber, mark.status]),
        );
        const wrongNumbers = selectedTest.questionMarks
          .filter(mark => mark.status === 'wrong')
          .map(mark => mark.questionNumber);
        const masteredNumbers = selectedTest.questionMarks
          .filter(mark => mark.status === 'mastered')
          .map(mark => mark.questionNumber);
        const wrongByScore = Math.max(0, selectedTest.totalQuestions - selectedTest.correctAnswers);
        const accuracy = getAccuracy(selectedTest);
        const isQuestionGridCollapsed = !!collapsedQuestionGrids[selectedTest.id];

        return (
          <div className="fixed inset-0 z-[89] bg-black/45 flex items-center justify-center p-4" onClick={() => setSelectedTestId(null)}>
            <div className="w-full max-w-5xl max-h-[90vh] rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-2xl overflow-hidden" onClick={event => event.stopPropagation()}>
              <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex flex-wrap items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
                  {formatDateLabel(selectedTest.date)}
                </span>
                <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                  {selectedTest.correctAnswers}/{selectedTest.totalQuestions} acertos ({formatPercent(accuracy)})
                </span>

                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => toggleQuestionGrid(selectedTest.id)}
                    className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                    title={isQuestionGridCollapsed ? 'Mostrar grade de questoes' : 'Minimizar grade de questoes'}
                  >
                    {isQuestionGridCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    {isQuestionGridCollapsed ? 'Mostrar grade' : 'Minimizar grade'}
                  </button>

                  <button
                    onClick={() => removePracticeTest(selectedTest.id)}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Remover simulado"
                  >
                    <Trash2 size={12} /> Remover
                  </button>

                  <button
                    onClick={() => setSelectedTestId(null)}
                    className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Fechar"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-64px)]">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                    <p className="text-slate-500 dark:text-slate-400">Acertos</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{selectedTest.correctAnswers}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                    <p className="text-slate-500 dark:text-slate-400">Erros</p>
                    <p className="font-semibold text-red-600 dark:text-red-300">{wrongByScore}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                    <p className="text-slate-500 dark:text-slate-400">Para revisar</p>
                    <p className="font-semibold text-red-600 dark:text-red-300">{wrongNumbers.length}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                    <p className="text-slate-500 dark:text-slate-400">Dominadas</p>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-300">{masteredNumbers.length}</p>
                  </div>
                </div>

                <div className="text-xs text-gray-600 dark:text-slate-300 space-y-1">
                  <p>
                    <strong>Revisar:</strong>{' '}
                    {wrongNumbers.length > 0 ? wrongNumbers.join(', ') : 'nenhuma marcada'}
                  </p>
                  <p>
                    <strong>Dominadas:</strong>{' '}
                    {masteredNumbers.length > 0 ? masteredNumbers.join(', ') : 'nenhuma marcada'}
                  </p>
                </div>

                {isQuestionGridCollapsed ? (
                  <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                    Grade de questoes minimizada.
                  </div>
                ) : (
                  <div className="grid gap-1 [grid-template-columns:repeat(auto-fill,minmax(2.1rem,1fr))]">
                    {Array.from({ length: selectedTest.totalQuestions }, (_, idx) => {
                      const questionNumber = idx + 1;
                      const status = questionStatusMap.get(questionNumber);
                      const styleClass =
                        status === 'wrong'
                          ? 'bg-red-100 border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300'
                          : status === 'mastered'
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300'
                            : 'bg-white border-gray-300 text-gray-600 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-300';

                      return (
                        <button
                          key={`q_${selectedTest.id}_${questionNumber}`}
                          onClick={event => handleQuestionLeftClick(event, selectedTest.id, questionNumber)}
                          onContextMenu={event => handleQuestionRightClick(event, selectedTest.id, questionNumber)}
                          className={`h-8 rounded-md border text-[11px] font-medium transition-colors hover:opacity-90 ${styleClass}`}
                          title={`Questao ${questionNumber} | esquerdo: revisar | direito: dominada`}
                        >
                          {questionNumber}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })() : null}

      {isCreateOpen ? (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-gray-200 dark:border-slate-700">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Novo simulado</h3>
              <button
                onClick={closeCreateModal}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Data</label>
                <input
                  type="date"
                  value={draftDate}
                  onChange={event => setDraftDate(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Total de questoes</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={draftTotalQuestions}
                    onChange={event => setDraftTotalQuestions(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    placeholder="Ex: 180"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Acertos</label>
                  <input
                    type="number"
                    min={0}
                    value={draftCorrectAnswers}
                    onChange={event => setDraftCorrectAnswers(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    placeholder="Ex: 126"
                  />
                </div>
              </div>

              {formError ? (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </p>
              ) : null}

              <div className="rounded-lg bg-gray-50 dark:bg-slate-800/50 px-3 py-2 text-xs text-gray-600 dark:text-slate-300 inline-flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500" />
                Ao salvar, a grade numerada sera criada automaticamente.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={closeCreateModal}
                  className="px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={createPracticeTest}
                  className="px-3 py-2 rounded-lg text-sm text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  Criar simulado
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
