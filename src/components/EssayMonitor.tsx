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
type EditorCommand = 'bold' | 'italic' | 'underline';

interface CompetencyDefinition {
  key: CompetencyKey;
  short: string;
  title: string;
}

const COMPETENCIES: CompetencyDefinition[] = [
  { key: 'c1', short: 'C1', title: 'Dom\u00ednio da norma culta da l\u00edngua portuguesa' },
  { key: 'c2', short: 'C2', title: 'Compreens\u00e3o da proposta e aplica\u00e7\u00e3o de conceitos interdisciplinares' },
  { key: 'c3', short: 'C3', title: 'Sele\u00e7\u00e3o, organiza\u00e7\u00e3o e interpreta\u00e7\u00e3o de informa\u00e7\u00f5es e argumentos' },
  { key: 'c4', short: 'C4', title: 'Conhecimento dos mecanismos lingu\u00edsticos para a argumenta\u00e7\u00e3o' },
  { key: 'c5', short: 'C5', title: 'Proposta de interven\u00e7\u00e3o respeitando os direitos humanos' },
];

interface EssayMonitorProps {
  settings: EssayMonitorSettings;
  onUpdateSettings: (next: EssayMonitorSettings) => void;
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

const INPUT_CLASSES =
  'mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 '
  + 'bg-white dark:bg-slate-950 px-3 py-2 text-sm '
  + 'text-slate-800 dark:text-slate-100 '
  + 'placeholder:text-slate-400 dark:placeholder:text-slate-500 '
  + 'focus:outline-none focus:ring-2 focus:ring-blue-400';

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(200, Math.round(value)));
}

function totalFromDraft(draft: EssayDraft): number {
  return clampScore(draft.c1) + clampScore(draft.c2) + clampScore(draft.c3) + clampScore(draft.c4) + clampScore(draft.c5);
}

function makeEssayId(): string {
  return 'essay_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function scoreColor(value: number, max: number): 'emerald' | 'amber' | 'red' {
  const ratio = value / max;
  if (ratio >= 0.8) return 'emerald';
  if (ratio >= 0.6) return 'amber';
  return 'red';
}

function scoreBadgeClasses(value: number, max: number): string {
  const c = scoreColor(value, max);
  const map = {
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-800',
    amber: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-900/30 dark:border-amber-800',
    red: 'text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-900/30 dark:border-red-800',
  };
  return map[c];
}

function scoreBarHex(value: number, max: number): string {
  const c = scoreColor(value, max);
  return { emerald: '#10b981', amber: '#f59e0b', red: '#ef4444' }[c];
}

function formatDatePt(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR');
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, seconds);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeEditorHtml(html: string): string {
  if (typeof document === 'undefined') return html;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  wrapper.querySelectorAll<HTMLElement>('*').forEach(node => {
    node.style.removeProperty('color');
    node.style.removeProperty('background-color');
  });

  wrapper.querySelectorAll('font').forEach(fontNode => {
    const span = document.createElement('span');
    span.innerHTML = fontNode.innerHTML;
    fontNode.replaceWith(span);
  });

  return wrapper.innerHTML;
}

function escapeCsvCell(value: string | number): string {
  const t = String(value ?? '');
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        q = !q;
      }
    } else if (ch === ',' && !q) {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function normalizeImportedEssay(raw: Partial<EssayEntry>): EssayEntry {
  const c1 = clampScore(Number(raw.c1 ?? 0));
  const c2 = clampScore(Number(raw.c2 ?? 0));
  const c3 = clampScore(Number(raw.c3 ?? 0));
  const c4 = clampScore(Number(raw.c4 ?? 0));
  const c5 = clampScore(Number(raw.c5 ?? 0));
  const now = new Date().toISOString();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.date ?? '')) ? String(raw.date) : now.slice(0, 10);
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
    createdAt: String(raw.createdAt || now),
    updatedAt: String(raw.updatedAt || now),
  };
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function execEditorCommand(command: EditorCommand): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
  try {
    return document.execCommand(command, false);
  } catch {
    return false;
  }
}

function EssayLineChart({ essays }: { essays: EssayEntry[] }) {
  if (essays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
        <BarChart3 size={32} className="mb-2 opacity-40" />
        <p className="text-xs">Cadastre redacoes para ver a evolucao aqui.</p>
      </div>
    );
  }

  const width = 720;
  const height = 200;
  const padding = 32;
  const ordered = [...essays].sort((a, b) => a.date.localeCompare(b.date));
  const points = ordered.map((essay, idx) => ({
    x: ordered.length === 1 ? width / 2 : padding + (idx / (ordered.length - 1)) * (width - padding * 2),
    y: height - padding - (essay.totalScore / 1000) * (height - padding * 2),
    date: essay.date,
    score: essay.totalScore,
  }));

  const line = points.map(p => `${p.x},${p.y}`).join(' ');
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 200, 400, 600, 800, 1000].map(level => {
        const y = height - padding - (level / 1000) * (height - padding * 2);
        return (
          <g key={level}>
            <line x1={padding} y1={y} x2={width - padding} y2={y} className="stroke-slate-200/70 dark:stroke-slate-700/50" strokeWidth="1" strokeDasharray={level === 0 || level === 1000 ? undefined : '4 4'} />
            <text x={padding - 4} y={y + 3} textAnchor="end" className="fill-slate-400 dark:fill-slate-500 text-[9px]">{level}</text>
          </g>
        );
      })}
      <polygon points={area} fill="url(#areaGrad)" />
      <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" points={line} />
      {points.map(p => (
        <g key={`${p.date}-${p.x}`}>
          <circle cx={p.x} cy={p.y} r="4" fill="#2563eb" stroke="white" strokeWidth="2" />
          <title>{`${formatDatePt(p.date)}: ${p.score}`}</title>
        </g>
      ))}
    </svg>
  );
}

function StatCard({ icon, label, value, accent }: { icon: ReactNode; label: string; value: string; accent?: 'blue' | 'emerald' | 'amber' | 'red' | 'slate' }) {
  const ring = {
    blue: 'border-blue-200 dark:border-blue-800',
    emerald: 'border-emerald-200 dark:border-emerald-800',
    amber: 'border-amber-200 dark:border-amber-800',
    red: 'border-red-200 dark:border-red-800',
    slate: 'border-slate-200 dark:border-slate-700',
  }[accent ?? 'slate'];

  const text = {
    blue: 'text-blue-700 dark:text-blue-300',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    amber: 'text-amber-700 dark:text-amber-300',
    red: 'text-red-700 dark:text-red-300',
    slate: 'text-slate-800 dark:text-slate-100',
  }[accent ?? 'slate'];

  return (
    <div className={`rounded-2xl bg-white dark:bg-slate-900 border ${ring} shadow-sm p-4`}>
      <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">{icon} {label}</p>
      <p className={`text-2xl font-extrabold mt-1 ${text}`}>{value}</p>
    </div>
  );
}

function EssayCard({ entry, onEdit, onRemove }: { entry: EssayEntry; onEdit: () => void; onRemove: () => void }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm text-slate-800 dark:text-slate-100 leading-snug">{entry.theme}</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{formatDatePt(entry.date)}</p>
        </div>
        <span className={`shrink-0 text-sm font-bold px-2.5 py-1 rounded-lg border ${scoreBadgeClasses(entry.totalScore, 1000)}`}>{entry.totalScore}</span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {COMPETENCIES.map(c => {
          const value = entry[c.key];
          return (
            <div key={c.key} className="text-center">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1">{c.short}</p>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / 200) * 100)}%`, backgroundColor: scoreBarHex(value, 200) }} />
              </div>
              <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300 mt-0.5">{value}</p>
            </div>
          );
        })}
      </div>
      {entry.content && <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-2">{stripHtml(entry.content)}</p>}
      <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
        <button onClick={onEdit} className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors" title="Editar"><Pencil size={14} /></button>
        <button onClick={onRemove} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" title="Excluir"><Trash2 size={14} /></button>
      </div>
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
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const editorInitialized = useRef(false);

  const essaysSorted = useMemo(() => [...settings.essays].sort((a, b) => b.date.localeCompare(a.date)), [settings.essays]);

  const stats = useMemo(() => {
    const count = settings.essays.length;
    const totals = settings.essays.map(e => e.totalScore);
    const average = count > 0 ? totals.reduce((s, v) => s + v, 0) / count : 0;
    const max = count > 0 ? Math.max(...totals) : 0;
    const min = count > 0 ? Math.min(...totals) : 0;
    const competencyAverages = COMPETENCIES.map(c => ({
      ...c,
      average: count > 0 ? settings.essays.reduce((acc, e) => acc + e[c.key], 0) / count : 0,
    }));
    return { count, average, max, min, competencyAverages };
  }, [settings.essays]);

  const suggestions = useMemo(() => {
    const msgs: { level: 'good' | 'warn'; text: string }[] = [];
    for (const c of stats.competencyAverages) {
      const rounded = Math.round(c.average);
      if (rounded < 120 && stats.count > 0) {
        msgs.push({ level: 'warn', text: `${c.short} com media baixa (${rounded}/200). Foque nela nas proximas redacoes.` });
      }
    }
    if (stats.max >= 900) msgs.push({ level: 'good', text: `Parabens! Nota maxima de ${stats.max} - continue assim!` });
    if (msgs.length === 0) {
      msgs.push({ level: 'good', text: stats.count === 0 ? 'Cadastre sua primeira redacao para gerar analises.' : 'Desempenho estavel. Continue praticando.' });
    }
    return msgs.slice(0, 5);
  }, [stats]);

  const draftTotal = totalFromDraft(draft);

  useEffect(() => {
    setSecondsLeft(settings.timerDurationMinutes * 60);
  }, [settings.timerDurationMinutes]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          window.clearInterval(id);
          setTimerRunning(false);
          setTimerFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    if (!isFormOpen) {
      editorInitialized.current = false;
      return;
    }
    if (editorInitialized.current || !editorRef.current) return;
    editorRef.current.innerHTML = draft.content || '';
    editorInitialized.current = true;
  }, [isFormOpen, draft.id]);

  useEffect(() => {
    if (!isFormOpen && !timerOpen) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (isFormOpen) closeForm();
      else if (timerOpen) closeTimer();
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFormOpen, timerOpen]);

  useEffect(() => {
    if (!isFormOpen && !timerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFormOpen, timerOpen]);

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
    setDraft(prev => ({ ...prev, [key]: clampScore(Number(value)) }));
  }

  function saveDraft() {
    const theme = draft.theme.trim();
    if (!theme) {
      window.alert('Informe o tema da redacao.');
      return;
    }

    const now = new Date().toISOString();
    const entry: EssayEntry = {
      id: draft.id || makeEssayId(),
      theme,
      date: /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? draft.date : now.slice(0, 10),
      c1: clampScore(draft.c1),
      c2: clampScore(draft.c2),
      c3: clampScore(draft.c3),
      c4: clampScore(draft.c4),
      c5: clampScore(draft.c5),
      totalScore: draftTotal,
      content: normalizeEditorHtml(editorRef.current?.innerHTML || draft.content),
      createdAt: draft.id ? (settings.essays.find(e => e.id === draft.id)?.createdAt || now) : now,
      updatedAt: now,
    };

    const essays = draft.id ? settings.essays.map(e => e.id === draft.id ? entry : e) : [entry, ...settings.essays];
    onUpdateSettings({ ...settings, essays });
    closeForm();
  }

  function removeEssay(id: string) {
    const found = settings.essays.find(e => e.id === id);
    if (!found || !window.confirm(`Excluir "${found.theme}"?`)) return;
    onUpdateSettings({ ...settings, essays: settings.essays.filter(e => e.id !== id) });
  }

  function exportJson() {
    downloadFile(
      `redacoes-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ exportedAt: new Date().toISOString(), essays: settings.essays }, null, 2),
      'application/json;charset=utf-8',
    );
  }

  function exportCsv() {
    const header = ['id', 'tema', 'data', 'nota_total', 'c1', 'c2', 'c3', 'c4', 'c5', 'conteudo'];
    const rows = settings.essays.map(e => [e.id, e.theme, e.date, e.totalScore, e.c1, e.c2, e.c3, e.c4, e.c5, stripHtml(e.content)]);
    const csv = [header, ...rows].map(r => r.map(c => escapeCsvCell(c)).join(',')).join('\n');
    downloadFile(`redacoes-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
  }

  async function importFromFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const text = await file.text();
    const lower = file.name.toLowerCase();
    const imported: EssayEntry[] = [];

    try {
      if (lower.endsWith('.json')) {
        const payload = JSON.parse(text) as { essays?: Partial<EssayEntry>[] } | Partial<EssayEntry>[];
        const rawItems = Array.isArray(payload) ? payload : payload.essays || [];
        for (const item of rawItems) imported.push(normalizeImportedEssay(item));
      } else if (lower.endsWith('.csv')) {
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        if (lines.length < 2) throw new Error('CSV vazio');

        const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
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
        window.alert('Use JSON ou CSV.');
        return;
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Falha ao importar.');
      return;
    }

    if (imported.length === 0) {
      window.alert('Nenhuma redacao valida encontrada.');
      return;
    }

    const usedIds = new Set(settings.essays.map(e => e.id));
    const normalized = imported.map(e => {
      let id = e.id;
      while (usedIds.has(id)) id = makeEssayId();
      usedIds.add(id);
      return { ...e, id };
    });

    onUpdateSettings({ ...settings, essays: [...normalized, ...settings.essays] });
  }

  function toggleCommand(cmd: EditorCommand) {
    execEditorCommand(cmd);
    setDraft(prev => ({ ...prev, content: normalizeEditorHtml(editorRef.current?.innerHTML || prev.content) }));
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

  const avgAccent = stats.count === 0 ? 'slate' as const : scoreColor(stats.average, 1000);
  const maxAccent = stats.count === 0 ? 'slate' as const : scoreColor(stats.max, 1000);

  return (
    <div className="space-y-5 pb-20 lg:pb-6 text-slate-800 dark:text-slate-100">
      <header className="rounded-2xl overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-700 text-white shadow-xl">
        <div className="px-5 md:px-6 py-4 md:py-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold leading-tight inline-flex items-center gap-2">
              <FileText size={22} /> Monitor de Redacoes
            </h1>
            <p className="text-xs text-white/70 mt-0.5">Notas &middot; Compet&ecirc;ncias &middot; Evolu&ccedil;&atilde;o &middot; Simulados</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openTimer} className="rounded-lg bg-white/15 hover:bg-white/25 transition-colors px-3 py-2 text-xs font-medium inline-flex items-center gap-1.5">
              <Clock3 size={14} /> Timer
            </button>
            <button onClick={() => openCreateForm()} className="rounded-lg bg-white text-indigo-700 hover:bg-indigo-50 transition-colors px-3 py-2 text-xs font-semibold inline-flex items-center gap-1.5">
              <Plus size={14} /> Nova
            </button>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<FileText size={15} />} label="Redacoes" value={String(stats.count)} accent="blue" />
        <StatCard icon={<TrendingUp size={15} />} label="Nota media" value={String(Math.round(stats.average))} accent={avgAccent} />
        <StatCard icon={<Trophy size={15} />} label="Maior nota" value={String(stats.max)} accent={maxAccent} />
        <StatCard icon={<Target size={15} />} label="Menor nota" value={String(stats.min)} accent={stats.count === 0 ? 'slate' : scoreColor(stats.min, 1000)} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-100 mb-4 inline-flex items-center gap-2"><BarChart3 size={16} /> Competencias ENEM</h2>
          <div className="space-y-3">
            {stats.competencyAverages.map(c => {
              const avg = Math.round(c.average);
              return (
                <div key={c.key} title={c.title}>
                  <div className="flex items-center gap-3 text-xs mb-1.5">
                    <span className="w-7 font-bold text-slate-600 dark:text-slate-300">{c.short}</span>
                    <div className="flex-1 h-5 rounded-md bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-md transition-all duration-500" style={{ width: `${Math.min(100, (avg / 200) * 100)}%`, backgroundColor: scoreBarHex(avg, 200) }} />
                    </div>
                    <span className={`w-14 text-right font-semibold px-1.5 py-0.5 rounded border text-[11px] ${scoreBadgeClasses(avg, 200)}`}>{avg}/200</span>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 pl-10 leading-tight">{c.title}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-100 mb-3 inline-flex items-center gap-2"><Target size={16} /> Sugestoes</h2>
          <div className="space-y-2">
            {suggestions.map((msg, i) => (
              <div key={`sug-${i}`} className={`rounded-lg border px-3 py-2.5 text-xs flex items-start gap-2 ${msg.level === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200' : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-200'}`}>
                {msg.level === 'warn' ? <AlertTriangle size={14} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={14} className="mt-0.5 shrink-0" />}
                <span>{msg.text}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100 inline-flex items-center gap-2"><FileText size={16} /> Redacoes ({stats.count})</h3>
              <div className="flex flex-wrap items-center gap-1.5">
                <button onClick={exportJson} className="text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1"><Download size={12} /> JSON</button>
                <button onClick={exportCsv} className="text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1"><Download size={12} /> CSV</button>
                <button onClick={() => importInputRef.current?.click()} className="text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1"><Upload size={12} /> Importar</button>
                <button onClick={() => openCreateForm()} className="text-[11px] rounded-lg bg-blue-600 text-white px-2.5 py-1.5 hover:bg-blue-700 transition-colors inline-flex items-center gap-1"><Plus size={12} /> Nova</button>
                <input ref={importInputRef} type="file" accept=".json,.csv" className="hidden" onChange={importFromFile} />
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 overflow-hidden">
              {essaysSorted.length === 0 ? (
                <div className="p-8 text-center">
                  <FileText size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Nenhuma redacao cadastrada</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Cadastre sua primeira redacao para acompanhar notas e evolucao.</p>
                  <button onClick={() => openCreateForm()} className="text-xs rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5"><Plus size={14} /> Cadastrar redacao</button>
                </div>
              ) : (
                <>
                  <div className="md:hidden p-3 space-y-3 max-h-[500px] overflow-y-auto">
                    {essaysSorted.map(entry => (
                      <EssayCard key={entry.id} entry={entry} onEdit={() => openEditForm(entry)} onRemove={() => removeEssay(entry.id)} />
                    ))}
                  </div>

                  <div className="hidden md:block overflow-auto max-h-[460px]">
                    <table className="w-full border-collapse text-xs">
                      <thead className="sticky top-0 bg-slate-100 dark:bg-slate-950/80 z-10">
                        <tr>
                          <th className="text-left px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 font-semibold">Tema</th>
                          <th className="text-left px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 font-semibold">Data</th>
                          <th className="text-right px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 font-semibold">Total</th>
                          {COMPETENCIES.map(c => (
                            <th key={c.key} className="text-right px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 font-semibold" title={c.title}>{c.short}</th>
                          ))}
                          <th className="text-right px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 font-semibold w-20">Acoes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {essaysSorted.map(entry => (
                          <tr key={entry.id} className="hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                              <p className="font-medium text-slate-700 dark:text-slate-100">{entry.theme}</p>
                              {entry.content && <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[280px]">{stripHtml(entry.content)}</p>}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDatePt(entry.date)}</td>
                            <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 text-right"><span className={`font-bold px-1.5 py-0.5 rounded border text-[11px] ${scoreBadgeClasses(entry.totalScore, 1000)}`}>{entry.totalScore}</span></td>
                            {COMPETENCIES.map(c => (
                              <td key={c.key} className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 text-right text-slate-600 dark:text-slate-300">{entry[c.key]}</td>
                            ))}
                            <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => openEditForm(entry)} className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors" title="Editar"><Pencil size={14} /></button>
                                <button onClick={() => removeEssay(entry.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" title="Excluir"><Trash2 size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100 mb-3 inline-flex items-center gap-2"><TrendingUp size={16} /> Evolucao das notas (0-1000)</h3>
        <EssayLineChart essays={settings.essays} />
      </section>

      {isFormOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-[2px] p-4 md:p-6 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center">
            <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">{draft.id ? 'Editar' : 'Nova redacao'}</p>
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{draft.id ? 'Atualizar registro' : 'Cadastrar redacao'}</h3>
                </div>
                <button onClick={closeForm} className="p-2 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Fechar"><X size={16} /></button>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-3">
                  <label className="text-xs text-slate-600 dark:text-slate-300">Tema
                    <input value={draft.theme} onChange={e => setDraft(prev => ({ ...prev, theme: e.target.value }))} placeholder="Ex.: Caminhos para combater a desinformacao no Brasil" className={INPUT_CLASSES} />
                  </label>
                  <label className="text-xs text-slate-600 dark:text-slate-300">Data
                    <input type="date" value={draft.date} onChange={e => setDraft(prev => ({ ...prev, date: e.target.value }))} className={INPUT_CLASSES} />
                  </label>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Notas por competencia (0-200)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {COMPETENCIES.map(c => (
                      <label key={`draft-${c.key}`} className="text-xs text-slate-600 dark:text-slate-300">
                        <span className="font-semibold">{c.short}</span>
                        <input type="number" min={0} max={200} step={10} value={draft[c.key]} onChange={e => updateDraftScore(c.key, e.target.value)} className={`${INPUT_CLASSES} text-center`} />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Texto / observacoes</p>
                    <div className="flex items-center gap-1">
                      {(['bold', 'italic', 'underline'] as EditorCommand[]).map(cmd => (
                        <button key={cmd} onClick={() => toggleCommand(cmd)} className={`px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${cmd === 'italic' ? 'italic' : cmd === 'underline' ? 'underline' : 'font-bold'}`} title={cmd.charAt(0).toUpperCase() + cmd.slice(1)}>{cmd.charAt(0).toUpperCase()}</button>
                      ))}
                    </div>
                  </div>
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={event => setDraft(prev => ({ ...prev, content: normalizeEditorHtml(event.currentTarget.innerHTML) }))}
                    className="min-h-[120px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 text-slate-800 dark:text-slate-100 caret-blue-500 selection:bg-indigo-500 selection:text-white [&_*]:!text-slate-800 dark:[&_*]:!text-slate-100"
                  />
                </div>
              </div>

              <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <p className="text-sm">Total: <strong className={`${scoreBadgeClasses(draftTotal, 1000)} px-2 py-0.5 rounded border text-xs`}>{draftTotal}/1000</strong></p>
                <div className="flex items-center gap-2">
                  <button onClick={closeForm} className="px-3 py-2 rounded-lg text-xs border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
                  <button onClick={saveDraft} className="px-3 py-2 rounded-lg text-xs bg-blue-600 text-white hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5"><Save size={13} /> Salvar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {timerOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-900/55 p-4 md:p-6 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">Sessao guiada</p>
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Timer de Redacao</h3>
                </div>
                <button onClick={closeTimer} className="p-2 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Fechar"><X size={16} /></button>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {([60, 90] as const).map(opt => (
                    <button key={opt} onClick={() => onUpdateSettings({ ...settings, timerDurationMinutes: opt })} disabled={timerRunning} className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${settings.timerDurationMinutes === opt ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200' : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      {opt} min
                    </button>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 p-5 text-center">
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wide">Tempo restante</p>
                  <p className="font-mono text-5xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">{formatDuration(secondsLeft)}</p>
                  {timerFinished && <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-300 font-medium">Tempo finalizado</p>}
                </div>

                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => setTimerRunning(p => !p)} className={`px-5 py-2.5 rounded-lg text-sm text-white font-medium inline-flex items-center gap-2 transition-colors ${timerRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                    {timerRunning ? <Pause size={15} /> : <Play size={15} />}
                    {timerRunning ? 'Pausar' : 'Iniciar'}
                  </button>
                  <button onClick={resetTimer} className="px-4 py-2.5 rounded-lg text-sm border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2 transition-colors"><TimerReset size={15} /> Reset</button>
                </div>

                <label className="text-xs text-slate-600 dark:text-slate-300 block">Rascunho rapido
                  <textarea value={timerText} onChange={e => setTimerText(e.target.value)} placeholder="Escreva aqui enquanto o timer roda..." className={`${INPUT_CLASSES} min-h-[130px]`} />
                </label>
              </div>

              <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
                <button onClick={closeTimer} className="px-3 py-2 rounded-lg text-xs border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Fechar</button>
                <button onClick={createDraftFromTimer} className="px-3 py-2 rounded-lg text-xs bg-blue-600 text-white hover:bg-blue-700 transition-colors">Criar redacao com rascunho</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
