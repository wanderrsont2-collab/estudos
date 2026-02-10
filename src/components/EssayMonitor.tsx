import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import type { EssayEntry, EssayMonitorSettings } from '../types';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Pause,
  Pencil,
  Play,
  Plus,
  Save,
  Target,
  TimerReset,
  Trash2,
  Trophy,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';

type CompetencyKey = 'c1' | 'c2' | 'c3' | 'c4' | 'c5';

interface CompetencyDefinition {
  key: CompetencyKey;
  short: string;
  title: string;
}

const COMPETENCIES: CompetencyDefinition[] = [
  {
    key: 'c1',
    short: 'Competencia 1',
    title: 'Dominio da norma culta da lingua portuguesa',
  },
  {
    key: 'c2',
    short: 'Competencia 2',
    title: 'Compreensao da proposta de redacao e aplicacao de conceitos de varias areas do conhecimento',
  },
  {
    key: 'c3',
    short: 'Competencia 3',
    title: 'Selecao, relacao, organizacao e interpretacao de informacoes, fatos, opinioes e argumentos',
  },
  {
    key: 'c4',
    short: 'Competencia 4',
    title: 'Demonstracao de conhecimento da lingua necessaria para construcao da argumentacao',
  },
  {
    key: 'c5',
    short: 'Competencia 5',
    title: 'Elaboracao de proposta de intervencao para o problema abordado, respeitando os direitos humanos',
  },
];

interface EssayMonitorProps {
  settings: EssayMonitorSettings;
  onUpdateSettings: (next: EssayMonitorSettings) => void;
}

interface FeedbackToast {
  id: string;
  message: string;
  tone: 'success' | 'error' | 'info';
}

interface EssayDraft {
  id: string | null;
  theme: string;
  date: string;
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
  content: string;
}

const DEFAULT_DRAFT: EssayDraft = {
  id: null,
  theme: '',
  date: new Date().toISOString().slice(0, 10),
  c1: 0,
  c2: 0,
  c3: 0,
  c4: 0,
  c5: 0,
  content: '',
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(200, Math.round(value)));
}

function totalFromDraft(draft: EssayDraft): number {
  return clampScore(draft.c1) + clampScore(draft.c2) + clampScore(draft.c3) + clampScore(draft.c4) + clampScore(draft.c5);
}

function makeEssayId() {
  return 'essay_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function scoreColorClasses(value: number): string {
  if (value >= 160) return 'text-emerald-700 bg-emerald-100 border-emerald-200';
  if (value >= 120) return 'text-amber-700 bg-amber-100 border-amber-200';
  return 'text-red-700 bg-red-100 border-red-200';
}

function scoreBarColor(value: number): string {
  if (value >= 160) return '#10b981';
  if (value >= 120) return '#f59e0b';
  return '#ef4444';
}

function formatDatePt(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR');
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hh = Math.floor(safe / 3600);
  const mm = Math.floor((safe % 3600) / 60);
  const ss = safe % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeCsvCell(value: string | number): string {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function normalizeImportedEssay(raw: Partial<EssayEntry>): EssayEntry {
  const c1 = clampScore(Number(raw.c1 ?? 0));
  const c2 = clampScore(Number(raw.c2 ?? 0));
  const c3 = clampScore(Number(raw.c3 ?? 0));
  const c4 = clampScore(Number(raw.c4 ?? 0));
  const c5 = clampScore(Number(raw.c5 ?? 0));
  const nowIso = new Date().toISOString();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.date ?? ''))
    ? String(raw.date)
    : nowIso.slice(0, 10);
  return {
    id: raw.id || makeEssayId(),
    theme: String(raw.theme || 'Redacao sem tema').trim() || 'Redacao sem tema',
    date,
    c1,
    c2,
    c3,
    c4,
    c5,
    totalScore: c1 + c2 + c3 + c4 + c5,
    content: String(raw.content || ''),
    createdAt: String(raw.createdAt || nowIso),
    updatedAt: String(raw.updatedAt || nowIso),
  };
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function EssayLineChart({ essays }: { essays: EssayEntry[] }) {
  if (essays.length === 0) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">Sem dados ainda para o grafico de evolucao.</p>;
  }

  const width = 720;
  const height = 220;
  const padding = 28;
  const ordered = [...essays].sort((a, b) => (a.date > b.date ? 1 : -1));

  const points = ordered.map((essay, idx) => {
    const x = ordered.length === 1
      ? width / 2
      : padding + (idx / (ordered.length - 1)) * (width - padding * 2);
    const y = height - padding - (essay.totalScore / 1000) * (height - padding * 2);
    return { x, y, label: essay.date, score: essay.totalScore };
  });

  const polyline = points.map(point => `${point.x},${point.y}`).join(' ');

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto rounded-xl bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-700">
        {[0, 200, 400, 600, 800, 1000].map(level => {
          const y = height - padding - (level / 1000) * (height - padding * 2);
          return (
            <g key={level}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1" />
              <text x={4} y={y + 4} className="fill-slate-400 dark:fill-slate-500 text-[10px]">{level}</text>
            </g>
          );
        })}
        <polyline fill="none" stroke="#2563eb" strokeWidth="3" points={polyline} />
        {points.map(point => (
          <g key={`${point.label}-${point.x}`}>
            <circle cx={point.x} cy={point.y} r="4" fill="#1d4ed8" />
            <title>{`${formatDatePt(point.label)}: ${point.score}`}</title>
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        {ordered.map(essay => (
          <span key={essay.id} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
            {formatDatePt(essay.date)}: {essay.totalScore}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm p-4">
      <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
        {icon} {label}
      </p>
      <p className="text-2xl font-extrabold mt-1 text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

export function EssayMonitor({ settings, onUpdateSettings }: EssayMonitorProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [draft, setDraft] = useState<EssayDraft>(DEFAULT_DRAFT);
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerFinished, setTimerFinished] = useState(false);
  const [timerText, setTimerText] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(settings.timerDurationMinutes * 60);
  const [toasts, setToasts] = useState<FeedbackToast[]>([]);
  const [pendingDeleteEssayId, setPendingDeleteEssayId] = useState<string | null>(null);
  const [listPageSize, setListPageSize] = useState<10 | 20 | 30>(() => {
    const stored = Number(window.localStorage.getItem('essay_list_page_size'));
    if (stored === 20 || stored === 30) return stored;
    return 10;
  });
  const [listPage, setListPage] = useState(1);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const essaysSorted = useMemo(
    () => [...settings.essays].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [settings.essays],
  );

  const stats = useMemo(() => {
    const count = settings.essays.length;
    const totals = settings.essays.map(entry => entry.totalScore);
    const average = count > 0 ? totals.reduce((sum, value) => sum + value, 0) / count : 0;
    const max = count > 0 ? Math.max(...totals) : 0;
    const min = count > 0 ? Math.min(...totals) : 0;
    const competencyAverages = COMPETENCIES.map(competency => {
      const sum = settings.essays.reduce((acc, essay) => acc + essay[competency.key], 0);
      return {
        ...competency,
        average: count > 0 ? sum / count : 0,
      };
    });

    return { count, average, max, min, competencyAverages };
  }, [settings.essays]);

  const suggestions = useMemo(() => {
    const messages: { level: 'good' | 'warn'; text: string }[] = [];
    for (const competency of stats.competencyAverages) {
      const rounded = Math.round(competency.average);
      if (rounded < 120 && stats.count > 0) {
        messages.push({
          level: 'warn',
          text: `Sua media na ${competency.short} esta baixa (${rounded}). Foque nela nas proximas redacoes.`,
        });
      }
    }
    if (stats.max >= 900) {
      messages.push({
        level: 'good',
        text: `Parabens! Sua nota maxima foi ${stats.max} - continue assim!`,
      });
    }
    if (messages.length === 0) {
      messages.push({
        level: 'good',
        text: stats.count === 0
          ? 'Comece cadastrando sua primeira redacao para gerar analises automaticas.'
          : 'Seu desempenho esta estavel. Continue praticando com foco nas competencias de menor media.',
      });
    }
    return messages.slice(0, 5);
  }, [stats.competencyAverages, stats.count, stats.max]);

  const draftTotal = totalFromDraft(draft);
  const totalPages = Math.max(1, Math.ceil(essaysSorted.length / listPageSize));
  const paginatedEssays = essaysSorted.slice((listPage - 1) * listPageSize, listPage * listPageSize);

  useEffect(() => {
    setSecondsLeft(settings.timerDurationMinutes * 60);
  }, [settings.timerDurationMinutes]);

  useEffect(() => {
    window.localStorage.setItem('essay_list_page_size', String(listPageSize));
    setListPage(1);
  }, [listPageSize]);

  useEffect(() => {
    setListPage(prev => Math.min(prev, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = window.setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  useEffect(() => {
    if (!timerRunning) return;
    const timer = window.setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setTimerRunning(false);
          setTimerFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);

  useEffect(() => {
    if (!isFormOpen || !editorRef.current) return;
    editorRef.current.innerHTML = draft.content || '';
  }, [isFormOpen, draft.content]);

  function pushToast(message: string, tone: FeedbackToast['tone'] = 'info') {
    setToasts(prev => [
      ...prev,
      { id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, message, tone },
    ]);
  }

  function updateDuration(next: 60 | 90) {
    onUpdateSettings({
      ...settings,
      timerDurationMinutes: next,
    });
  }

  function openCreateForm(prefill?: Partial<EssayDraft>) {
    setDraft({
      ...DEFAULT_DRAFT,
      ...prefill,
      id: null,
      date: prefill?.date || new Date().toISOString().slice(0, 10),
    });
    setIsFormOpen(true);
  }

  function openEditForm(entry: EssayEntry) {
    setDraft({
      id: entry.id,
      theme: entry.theme,
      date: entry.date,
      c1: entry.c1,
      c2: entry.c2,
      c3: entry.c3,
      c4: entry.c4,
      c5: entry.c5,
      content: entry.content,
    });
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setDraft(DEFAULT_DRAFT);
  }

  function updateDraftScore(key: CompetencyKey, value: string) {
    const parsed = Number(value);
    setDraft(prev => ({
      ...prev,
      [key]: clampScore(parsed),
    }));
  }

  function saveDraft() {
    const theme = draft.theme.trim();
    if (!theme) {
      pushToast('Informe o tema da redacao.', 'error');
      return;
    }

    const nowIso = new Date().toISOString();
    const nextEssay: EssayEntry = {
      id: draft.id || makeEssayId(),
      theme,
      date: /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? draft.date : nowIso.slice(0, 10),
      c1: clampScore(draft.c1),
      c2: clampScore(draft.c2),
      c3: clampScore(draft.c3),
      c4: clampScore(draft.c4),
      c5: clampScore(draft.c5),
      totalScore: draftTotal,
      content: draft.content,
      createdAt: draft.id
        ? (settings.essays.find(entry => entry.id === draft.id)?.createdAt || nowIso)
        : nowIso,
      updatedAt: nowIso,
    };

    const essays = draft.id
      ? settings.essays.map(entry => (entry.id === draft.id ? nextEssay : entry))
      : [nextEssay, ...settings.essays];

    onUpdateSettings({
      ...settings,
      essays,
    });

    pushToast(draft.id ? 'Redacao atualizada com sucesso.' : 'Redacao criada com sucesso.', 'success');
    closeForm();
  }

  function removeEssay(entryId: string) {
    const found = settings.essays.find(entry => entry.id === entryId);
    if (!found) return;
    onUpdateSettings({
      ...settings,
      essays: settings.essays.filter(entry => entry.id !== entryId),
    });
    setPendingDeleteEssayId(null);
    pushToast(`Redacao "${found.theme}" excluida.`, 'info');
  }

  function exportJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      essays: settings.essays,
    };
    downloadFile(
      `monitor-redacoes-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8',
    );
  }

  function exportCsv() {
    const header = ['id', 'tema', 'data', 'nota_total', 'c1', 'c2', 'c3', 'c4', 'c5', 'conteudo'];
    const rows = settings.essays.map(entry => [
      entry.id,
      entry.theme,
      entry.date,
      entry.totalScore,
      entry.c1,
      entry.c2,
      entry.c3,
      entry.c4,
      entry.c5,
      stripHtml(entry.content),
    ]);

    const csv = [header, ...rows]
      .map(row => row.map(cell => escapeCsvCell(cell)).join(','))
      .join('\n');

    downloadFile(
      `monitor-redacoes-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      'text/csv;charset=utf-8',
    );
  }

  async function importFromFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    const lowerName = file.name.toLowerCase();
    const imported: EssayEntry[] = [];

    try {
      if (lowerName.endsWith('.json')) {
        const payload = JSON.parse(text) as { essays?: Partial<EssayEntry>[] } | Partial<EssayEntry>[];
        const essaysRaw = Array.isArray(payload) ? payload : payload.essays || [];
        for (const item of essaysRaw) {
          imported.push(normalizeImportedEssay(item));
        }
      } else if (lowerName.endsWith('.csv')) {
        const lines = text
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean);
        if (lines.length < 2) throw new Error('CSV vazio');
        const headers = parseCsvLine(lines[0]).map(head => head.toLowerCase());
        const idx = {
          id: headers.indexOf('id'),
          theme: headers.indexOf('tema'),
          date: headers.indexOf('data'),
          c1: headers.indexOf('c1'),
          c2: headers.indexOf('c2'),
          c3: headers.indexOf('c3'),
          c4: headers.indexOf('c4'),
          c5: headers.indexOf('c5'),
          content: headers.indexOf('conteudo'),
        };
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i]);
          imported.push(normalizeImportedEssay({
            id: idx.id >= 0 ? cols[idx.id] : undefined,
            theme: idx.theme >= 0 ? cols[idx.theme] : 'Redacao importada',
            date: idx.date >= 0 ? cols[idx.date] : undefined,
            c1: idx.c1 >= 0 ? Number(cols[idx.c1]) : 0,
            c2: idx.c2 >= 0 ? Number(cols[idx.c2]) : 0,
            c3: idx.c3 >= 0 ? Number(cols[idx.c3]) : 0,
            c4: idx.c4 >= 0 ? Number(cols[idx.c4]) : 0,
            c5: idx.c5 >= 0 ? Number(cols[idx.c5]) : 0,
            content: idx.content >= 0 ? cols[idx.content] : '',
          }));
        }
      } else {
        pushToast('Formato nao suportado. Use JSON ou CSV.', 'error');
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao importar arquivo.';
      pushToast(message, 'error');
      return;
    }

    if (imported.length === 0) {
      pushToast('Nenhuma redacao valida encontrada no arquivo.', 'error');
      return;
    }

    const usedIds = new Set(settings.essays.map(entry => entry.id));
    const normalized = imported.map(entry => {
      let nextId = entry.id;
      while (usedIds.has(nextId)) {
        nextId = makeEssayId();
      }
      usedIds.add(nextId);
      return { ...entry, id: nextId };
    });

    onUpdateSettings({
      ...settings,
      essays: [...normalized, ...settings.essays],
    });
    pushToast(`${normalized.length} redacao(oes) importada(s) com sucesso.`, 'success');
  }

  function toggleCommand(command: 'bold' | 'italic' | 'underline') {
    document.execCommand(command);
    setDraft(prev => ({ ...prev, content: editorRef.current?.innerHTML || prev.content }));
  }

  function openTimer() {
    setTimerText('');
    setTimerFinished(false);
    setTimerRunning(false);
    setSecondsLeft(settings.timerDurationMinutes * 60);
    setTimerOpen(true);
  }

  function closeTimer() {
    setTimerRunning(false);
    setTimerOpen(false);
  }

  function resetTimer() {
    setTimerRunning(false);
    setTimerFinished(false);
    setSecondsLeft(settings.timerDurationMinutes * 60);
  }

  function createDraftFromTimer() {
    openCreateForm({
      theme: 'Simulado ENEM - Redacao',
      date: new Date().toISOString().slice(0, 10),
      content: timerText,
    });
    closeTimer();
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-6 text-slate-800 dark:text-slate-100">
      <section className="rounded-3xl overflow-hidden bg-gradient-to-r from-sky-700 via-indigo-700 to-blue-700 text-white shadow-xl">
        <div className="px-5 md:px-7 py-6 md:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-sky-100/90 mb-2">ENEM Writing Suite</p>
              <h1 className="text-2xl md:text-3xl font-extrabold leading-tight">Monitor de Redacoes</h1>
              <p className="text-sm text-slate-100/90 mt-1">
                Gerencie notas, evolucao por competencia e simulacoes com timer em um painel unico.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={openTimer}
                className="rounded-xl bg-white/15 hover:bg-white/25 transition-colors px-4 py-2 text-sm font-medium inline-flex items-center gap-2"
              >
                <Clock3 size={16} /> Iniciar Redacao com Timer
              </button>
              <button
                onClick={() => openCreateForm()}
                className="rounded-xl bg-white text-blue-700 hover:bg-sky-50 transition-colors px-4 py-2 text-sm font-semibold inline-flex items-center gap-2"
              >
                <Plus size={16} /> Nova Redacao
              </button>
            </div>
          </div>
        </div>
      </section>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<FileText size={17} />} label="Total de redacoes" value={String(stats.count)} />
        <StatCard icon={<TrendingUp size={17} />} label="Nota media" value={String(Math.round(stats.average))} />
        <StatCard icon={<Trophy size={17} />} label="Maior nota" value={String(stats.max)} />
        <StatCard icon={<Target size={17} />} label="Menor nota" value={String(stats.min)} />
      </section>
      <section className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-5 xl:items-start">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm p-4 self-start">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-100 mb-3 inline-flex items-center gap-2">
            <BarChart3 size={16} /> Competencias ENEM (medias)
          </h2>
          <div className="space-y-3">
            {stats.competencyAverages.map(competency => {
              const avg = Math.round(competency.average);
              return (
                <div key={competency.key} title={competency.title}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <p className="font-medium text-slate-600 dark:text-slate-300">{competency.short}</p>
                    <span className={`px-2 py-0.5 rounded-full border ${scoreColorClasses(avg)}`}>
                      {avg}/200
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (avg / 200) * 100)}%`, backgroundColor: scoreBarColor(avg) }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{competency.title}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-5 self-start">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-100 mb-3 inline-flex items-center gap-2">
              <Target size={16} /> Sugestoes Automaticas
            </h2>
            <div className="space-y-2">
              {suggestions.map((message, idx) => (
                <div
                  key={`${message.level}-${idx}`}
                  className={`rounded-xl border px-3 py-2 text-xs flex items-start gap-2 ${
                    message.level === 'warn'
                      ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-200'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-200'
                  }`}
                >
                  {message.level === 'warn' ? <AlertTriangle size={14} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={14} className="mt-0.5 shrink-0" />}
                  <span>{message.text}</span>
                </div>
              ))}
            </div>
          </div>

          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-100 inline-flex items-center gap-2">
                <FileText size={16} /> Lista de Redacoes
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                  Mostrar
                  <select
                    value={listPageSize}
                    onChange={event => setListPage((event.target.value === '20' ? 20 : event.target.value === '30' ? 30 : 10))}
                    className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={30}>30</option>
                  </select>
                </label>
                <button
                  onClick={exportJson}
                  className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1"
                >
                  <Download size={13} /> Exportar JSON
                </button>
                <button
                  onClick={exportCsv}
                  className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1"
                >
                  <Download size={13} /> Exportar CSV
                </button>
                <button
                  onClick={() => importInputRef.current?.click()}
                  className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1"
                >
                  <Upload size={13} /> Importar
                </button>
                <button
                  onClick={() => openCreateForm()}
                  className="text-xs rounded-lg bg-blue-600 text-white px-2.5 py-1.5 hover:bg-blue-700 transition-colors inline-flex items-center gap-1"
                >
                  <Plus size={13} /> Nova
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json,.csv"
                  className="hidden"
                  onChange={importFromFile}
                />
              </div>
            </div>

            {essaysSorted.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Nenhuma redacao cadastrada ainda.
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto max-h-[420px]">
                <table className="min-w-[1120px] w-full border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950 z-10">
                    <tr>
                      <th className="text-left px-3 py-2 border-b border-slate-200 dark:border-slate-700 min-w-[320px]">Tema</th>
                      <th className="text-left px-3 py-2 border-b border-slate-200 dark:border-slate-700">Data</th>
                      <th className="text-right px-3 py-2 border-b border-slate-200 dark:border-slate-700">Nota Total</th>
                      <th className="text-right px-3 py-2 border-b border-slate-200 dark:border-slate-700">C1</th>
                      <th className="text-right px-3 py-2 border-b border-slate-200 dark:border-slate-700">C2</th>
                      <th className="text-right px-3 py-2 border-b border-slate-200 dark:border-slate-700">C3</th>
                      <th className="text-right px-3 py-2 border-b border-slate-200 dark:border-slate-700">C4</th>
                      <th className="text-right px-3 py-2 border-b border-slate-200 dark:border-slate-700">C5</th>
                      <th className="text-right px-3 py-2 border-b border-slate-200 dark:border-slate-700">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEssays.map(entry => (
                      <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap">
                          <div>
                            <p className="font-medium text-slate-700 dark:text-slate-100">{entry.theme}</p>
                            {entry.content && (
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{stripHtml(entry.content)}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatDatePt(entry.date)}</td>
                        <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 text-right font-semibold text-blue-700 dark:text-blue-300">{entry.totalScore}</td>
                        <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 text-right">{entry.c1}</td>
                        <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 text-right">{entry.c2}</td>
                        <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 text-right">{entry.c3}</td>
                        <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 text-right">{entry.c4}</td>
                        <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 text-right">{entry.c5}</td>
                        <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditForm(entry)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                              title="Editar"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setPendingDeleteEssayId(entry.id)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {essaysSorted.length > 0 && (
              <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  Pagina {listPage} de {totalPages} ({essaysSorted.length} redacao(oes))
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setListPage(prev => Math.max(1, prev - 1))}
                    disabled={listPage <= 1}
                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setListPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={listPage >= totalPages}
                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40"
                  >
                    Proxima
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100 mb-3">Evolucao das notas totais (0-1000)</h3>
          <EssayLineChart essays={settings.essays} />
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100 mb-3">Comparativo das competencias</h3>
          <div className="space-y-2.5">
            {stats.competencyAverages.map(competency => {
              const avg = Math.round(competency.average);
              return (
                <div key={`bar-${competency.key}`} className="grid grid-cols-[90px_1fr_56px] items-center gap-2">
                  <span className="text-xs text-slate-600 dark:text-slate-300">{competency.short}</span>
                  <div className="h-6 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-6 rounded-lg transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (avg / 200) * 100)}%`,
                        backgroundColor: scoreBarColor(avg),
                      }}
                    />
                  </div>
                  <span className="text-xs text-right font-medium text-slate-600 dark:text-slate-300">{avg}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {pendingDeleteEssayId && (
        <div className="fixed inset-0 z-[88] bg-black/40 p-4 flex items-center justify-center">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-4">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Confirmar exclusao</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Deseja excluir esta redacao? Essa acao pode ser desfeita pelo botao global de Desfazer.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setPendingDeleteEssayId(null)}
                className="px-3 py-1.5 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => removeEssay(pendingDeleteEssayId)}
                className="px-3 py-1.5 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="fixed right-3 bottom-20 lg:bottom-4 z-[100] space-y-2 w-[320px] max-w-[calc(100vw-1.5rem)]">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`rounded-xl border px-3 py-2 text-sm shadow-lg ${
                toast.tone === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-200'
                  : toast.tone === 'error'
                    ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200'
                    : 'bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-900/30 dark:border-sky-800 dark:text-sky-200'
              }`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-[90] bg-black/45 p-4 flex items-center justify-center" onClick={closeForm}>
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                {draft.id ? 'Editar redacao' : 'Nova redacao'}
              </h3>
              <button onClick={closeForm} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Tema da redacao</label>
                  <input
                    value={draft.theme}
                    onChange={event => setDraft(prev => ({ ...prev, theme: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Ex: Desafios da educacao digital no Brasil"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Data</label>
                  <input
                    type="date"
                    value={draft.date}
                    onChange={event => setDraft(prev => ({ ...prev, date: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {COMPETENCIES.map(competency => (
                  <div key={`input-${competency.key}`}>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1" title={competency.title}>
                      {competency.short}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={draft[competency.key]}
                      onChange={event => updateDraftScore(competency.key, event.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-800 px-4 py-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Nota total calculada automaticamente: <strong>{draftTotal}</strong> / 1000
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Texto da redacao (opcional)</label>
                <div className="rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden">
                  <div className="px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center gap-1.5">
                    <button type="button" onClick={() => toggleCommand('bold')} className="px-2 py-1 rounded text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">Negrito</button>
                    <button type="button" onClick={() => toggleCommand('italic')} className="px-2 py-1 rounded text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">Italico</button>
                    <button type="button" onClick={() => toggleCommand('underline')} className="px-2 py-1 rounded text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">Sublinhado</button>
                  </div>
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={() => setDraft(prev => ({ ...prev, content: editorRef.current?.innerHTML || '' }))}
                    className="min-h-[200px] p-3 text-sm outline-none bg-white dark:bg-slate-950"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
              <button
                onClick={closeForm}
                className="px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={saveDraft}
                className="px-3 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-1"
              >
                <Save size={14} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {timerOpen && (
        <div className="fixed inset-0 z-[95] bg-black/50 p-4 flex items-center justify-center" onClick={closeTimer}>
          <div
            className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">Simulacao de redacao com timer</h3>
              <button onClick={closeTimer} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tempo restante</p>
                  <p className={`text-3xl font-extrabold tracking-widest ${secondsLeft <= 300 ? 'text-red-600' : 'text-blue-700 dark:text-blue-300'}`}>
                    {formatDuration(secondsLeft)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={settings.timerDurationMinutes}
                    onChange={event => updateDuration(Number(event.target.value) === 60 ? 60 : 90)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-sm"
                  >
                    <option value={90}>90 minutos</option>
                    <option value={60}>60 minutos</option>
                  </select>
                  <button
                    onClick={() => setTimerRunning(prev => !prev)}
                    className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm inline-flex items-center gap-1"
                  >
                    {timerRunning ? <Pause size={14} /> : <Play size={14} />}
                    {timerRunning ? 'Pausar' : 'Iniciar'}
                  </button>
                  <button
                    onClick={resetTimer}
                    className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm inline-flex items-center gap-1"
                  >
                    <TimerReset size={14} /> Reiniciar
                  </button>
                </div>
              </div>

              {timerFinished && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/30 dark:border-emerald-800 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
                  Tempo encerrado! Revise o texto e salve como nova redacao.
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Editor da simulacao</label>
                <textarea
                  value={timerText}
                  onChange={event => setTimerText(event.target.value)}
                  rows={10}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Escreva ou cole sua redacao aqui durante a simulacao..."
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
              <button
                onClick={closeTimer}
                className="px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Fechar
              </button>
              <button
                onClick={createDraftFromTimer}
                className="px-3 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-1"
              >
                <Save size={14} /> Salvar como redacao
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
