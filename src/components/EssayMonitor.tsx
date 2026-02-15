import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import type { EssayEntry, EssayMonitorSettings } from '../types';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Lightbulb,
  Pause,
  Pencil,
  Play,
  Plus,
  Save,
  Sparkles,
  Target,
  Timer,
  TimerReset,
  Trash2,
  TrendingUp,
  Upload,
  X,
  Zap,
} from 'lucide-react';

/* ─── Types ─── */
type CKey = 'c1' | 'c2' | 'c3' | 'c4' | 'c5';
type EditorCmd = 'bold' | 'italic' | 'underline';

interface CDef { key: CKey; short: string; title: string; emoji: string; gradient: string }

const COMPS: CDef[] = [
  { key: 'c1', short: 'C1', title: 'Domínio da norma culta', emoji: '📝', gradient: 'from-violet-500 to-purple-600' },
  { key: 'c2', short: 'C2', title: 'Compreensão da proposta', emoji: '🎯', gradient: 'from-blue-500 to-cyan-500' },
  { key: 'c3', short: 'C3', title: 'Seleção de argumentos', emoji: '💡', gradient: 'from-emerald-500 to-teal-500' },
  { key: 'c4', short: 'C4', title: 'Mecanismos linguísticos', emoji: '🔗', gradient: 'from-amber-500 to-orange-500' },
  { key: 'c5', short: 'C5', title: 'Proposta de intervenção', emoji: '🤝', gradient: 'from-rose-500 to-pink-500' },
];

interface Draft {
  id: string | null;
  theme: string;
  date: string;
  c1: number; c2: number; c3: number; c4: number; c5: number;
  content: string;
}

const EMPTY: Draft = {
  id: null, theme: '', date: toDateOnlyLocal(new Date()),
  c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, content: '',
};

/* ─── Helpers ─── */
function toDateOnlyLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clamp(v: number) { return Number.isFinite(v) ? Math.max(0, Math.min(200, Math.round(v))) : 0; }
function draftTotal(d: Draft) { return clamp(d.c1) + clamp(d.c2) + clamp(d.c3) + clamp(d.c4) + clamp(d.c5); }
function mkId() { return 'e_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function tier(v: number, mx: number): 'good' | 'mid' | 'low' {
  const r = v / mx;
  return r >= 0.8 ? 'good' : r >= 0.6 ? 'mid' : 'low';
}

const TIER_HEX = { good: '#10b981', mid: '#f59e0b', low: '#ef4444' } as const;

function tierBadge(v: number, mx: number) {
  const t = tier(v, mx);
  return {
    good: 'text-emerald-700 bg-emerald-100/80',
    mid: 'text-amber-700 bg-amber-100/80',
    low: 'text-red-700 bg-red-100/80',
  }[t];
}

function fDate(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR'); }
function fTime(s: number) {
  const sec = Math.max(0, s);
  return `${String(Math.floor(sec / 3600)).padStart(2, '0')}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}
function plain(html: string) { return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(); }
function cleanHtml(html: string) {
  if (typeof document === 'undefined') return html;
  const el = document.createElement('div');
  el.innerHTML = html;
  el.querySelectorAll<HTMLElement>('*').forEach(n => { n.style.removeProperty('color'); n.style.removeProperty('background-color'); });
  el.querySelectorAll('font').forEach(f => { const s = document.createElement('span'); s.innerHTML = f.innerHTML; f.replaceWith(s); });
  return el.innerHTML;
}
function escCsv(v: string | number) { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; }
function parseCsv(line: string) {
  const cells: string[] = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === ',' && !q) { cells.push(cur); cur = ''; }
    else cur += ch;
  }
  cells.push(cur); return cells;
}
function normEntry(raw: Partial<EssayEntry>): EssayEntry {
  const c1 = clamp(Number(raw.c1 ?? 0)), c2 = clamp(Number(raw.c2 ?? 0)), c3 = clamp(Number(raw.c3 ?? 0)), c4 = clamp(Number(raw.c4 ?? 0)), c5 = clamp(Number(raw.c5 ?? 0));
  const now = new Date().toISOString();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.date ?? '')) ? String(raw.date) : now.slice(0, 10);
  return { id: raw.id || mkId(), theme: String(raw.theme || 'Sem tema').trim() || 'Sem tema', date, c1, c2, c3, c4, c5, totalScore: c1 + c2 + c3 + c4 + c5, content: String(raw.content || ''), createdAt: String(raw.createdAt || now), updatedAt: String(raw.updatedAt || now) };
}
function dl(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

/* ─── Chart Component ─── */
function EvolutionChart({ essays }: { essays: EssayEntry[] }) {
  if (!essays.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center mb-4">
          <BarChart3 size={28} className="text-violet-400" />
        </div>
        <p className="text-sm font-medium text-neutral-500 mb-1">Sem dados ainda</p>
        <p className="text-xs text-neutral-400">Cadastre redações para ver a evolução</p>
      </div>
    );
  }

  const w = 720, h = 220, pad = 40;
  const sorted = [...essays].sort((a, b) => a.date.localeCompare(b.date));
  const pts = sorted.map((e, i) => ({
    x: sorted.length === 1 ? w / 2 : pad + (i / (sorted.length - 1)) * (w - pad * 2),
    y: h - pad - (e.totalScore / 1000) * (h - pad * 2),
    d: e.date, s: e.totalScore,
  }));
  const line = pts.map(p => `${p.x},${p.y}`).join(' ');
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.15" />
          <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {[0, 200, 400, 600, 800, 1000].map(lv => {
        const y = h - pad - (lv / 1000) * (h - pad * 2);
        return (
          <g key={lv}>
            <line x1={pad} y1={y} x2={w - pad} y2={y} stroke="#e5e7eb" strokeWidth="0.8" strokeDasharray={lv === 0 || lv === 1000 ? undefined : '4 4'} />
            <text x={pad - 8} y={y + 3.5} textAnchor="end" fill="#9ca3af" fontSize="9" fontFamily="system-ui">{lv}</text>
          </g>
        );
      })}
      <polygon points={area} fill="url(#areaFill)" />
      <polyline fill="none" stroke="url(#chartGrad)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={line} />
      {pts.map((p, i) => (
        <g key={`${p.d}-${i}`}>
          <circle cx={p.x} cy={p.y} r="6" fill="url(#chartGrad)" opacity="0.15" />
          <circle cx={p.x} cy={p.y} r="4" fill="white" stroke="url(#chartGrad)" strokeWidth="2" />
          <title>{`${fDate(p.d)}: ${p.s} pts`}</title>
        </g>
      ))}
    </svg>
  );
}

/* ─── Stat Card ─── */
function StatCard({ icon, label, value, gradient, glow, delay }: {
  icon: ReactNode; label: string; value: string | number;
  gradient: string; glow: string; delay: string;
}) {
  return (
    <div className={`glass-card rounded-2xl p-5 ${glow} animate-float-in ${delay} relative overflow-hidden group`}>
      <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${gradient} opacity-[0.07] group-hover:opacity-[0.12] transition-opacity duration-500`} />
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} text-white mb-3 shadow-lg`}>
        {icon}
      </div>
      <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-extrabold text-neutral-800 mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

/* ─── Competency Ring ─── */
function CompRing({ comp, avg }: { comp: CDef; avg: number }) {
  const v = Math.round(avg);
  const pct = Math.min(100, (v / 200) * 100);
  const r = 32, circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2 group">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#f3f4f6" strokeWidth="5" />
          <circle cx="40" cy="40" r={r} fill="none"
            stroke={TIER_HEX[tier(v, 200)]}
            strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-neutral-700">{v}</span>
        </div>
      </div>
      <div className="text-center">
        <span className="text-xs font-bold text-neutral-600">{comp.short}</span>
        <p className="text-[10px] text-neutral-400 leading-tight mt-0.5 max-w-[80px]">{comp.title}</p>
      </div>
    </div>
  );
}

/* ─── Main ─── */
interface Props {
  settings: EssayMonitorSettings;
  onUpdateSettings: (s: EssayMonitorSettings) => void;
}

export function EssayMonitor({ settings, onUpdateSettings }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerOn, setTimerOn] = useState(false);
  const [timerDone, setTimerDone] = useState(false);
  const [timerText, setTimerText] = useState('');
  const [secLeft, setSecLeft] = useState(settings.timerDurationMinutes * 60);
  const [tab, setTab] = useState<'list' | 'chart'>('list');
  const impRef = useRef<HTMLInputElement | null>(null);
  const edRef = useRef<HTMLDivElement | null>(null);
  const edInit = useRef(false);

  const sorted = useMemo(() => [...settings.essays].sort((a, b) => b.date.localeCompare(a.date)), [settings.essays]);

  const stats = useMemo(() => {
    const n = settings.essays.length;
    const tots = settings.essays.map(e => e.totalScore);
    const avg = n ? tots.reduce((a, b) => a + b, 0) / n : 0;
    const mx = n ? Math.max(...tots) : 0;
    const mn = n ? Math.min(...tots) : 0;
    const cAvg = COMPS.map(c => ({ ...c, avg: n ? settings.essays.reduce((a, e) => a + e[c.key], 0) / n : 0 }));
    return { n, avg, mx, mn, cAvg };
  }, [settings.essays]);

  const tips = useMemo(() => {
    const m: { ok: boolean; text: string }[] = [];
    for (const c of stats.cAvg) {
      const r = Math.round(c.avg);
      if (r < 120 && stats.n > 0) m.push({ ok: false, text: `${c.short} com média ${r}/200 — foque nesta competência.` });
    }
    if (stats.mx >= 900) m.push({ ok: true, text: `Nota máxima de ${stats.mx}. Excelente!` });
    if (!m.length) m.push({ ok: true, text: stats.n === 0 ? 'Cadastre sua primeira redação.' : 'Desempenho estável. Continue praticando!' });
    return m.slice(0, 4);
  }, [stats]);

  const dt = draftTotal(draft);

  useEffect(() => { setSecLeft(settings.timerDurationMinutes * 60); }, [settings.timerDurationMinutes]);
  useEffect(() => {
    if (!timerOn) return;
    const id = setInterval(() => {
      setSecLeft(p => { if (p <= 1) { clearInterval(id); setTimerOn(false); setTimerDone(true); return 0; } return p - 1; });
    }, 1000);
    return () => clearInterval(id);
  }, [timerOn]);

  useEffect(() => {
    if (!formOpen) { edInit.current = false; return; }
    if (edInit.current || !edRef.current) return;
    edRef.current.innerHTML = draft.content || '';
    edInit.current = true;
  }, [formOpen, draft.id]);

  useEffect(() => {
    if (!formOpen && !timerOpen) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') formOpen ? closeForm() : closeTimer(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [formOpen, timerOpen]);

  useEffect(() => {
    if (!formOpen && !timerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [formOpen, timerOpen]);

  function openCreate(pre?: Partial<Draft>) {
    setDraft({ ...EMPTY, ...pre, id: null, date: pre?.date || toDateOnlyLocal(new Date()) });
    setFormOpen(true);
  }
  function openEdit(e: EssayEntry) {
    setDraft({ id: e.id, theme: e.theme, date: e.date, c1: e.c1, c2: e.c2, c3: e.c3, c4: e.c4, c5: e.c5, content: e.content });
    setFormOpen(true);
  }
  function closeForm() { setFormOpen(false); setDraft(EMPTY); }

  function save() {
    const theme = draft.theme.trim();
    if (!theme) { alert('Informe o tema.'); return; }
    const now = new Date().toISOString();
    const entry: EssayEntry = {
      id: draft.id || mkId(), theme,
      date: /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? draft.date : toDateOnlyLocal(new Date()),
      c1: clamp(draft.c1), c2: clamp(draft.c2), c3: clamp(draft.c3), c4: clamp(draft.c4), c5: clamp(draft.c5),
      totalScore: dt,
      content: cleanHtml(edRef.current?.innerHTML || draft.content),
      createdAt: draft.id ? (settings.essays.find(e => e.id === draft.id)?.createdAt || now) : now,
      updatedAt: now,
    };
    onUpdateSettings({ ...settings, essays: draft.id ? settings.essays.map(e => e.id === draft.id ? entry : e) : [entry, ...settings.essays] });
    closeForm();
  }

  function remove(id: string) {
    const f = settings.essays.find(e => e.id === id);
    if (!f || !confirm(`Excluir "${f.theme}"?`)) return;
    onUpdateSettings({ ...settings, essays: settings.essays.filter(e => e.id !== id) });
  }

  function exportJson() {
    dl(`redacoes-${toDateOnlyLocal(new Date())}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), essays: settings.essays }, null, 2), 'application/json;charset=utf-8');
  }
  function exportCsv() {
    const h = ['id', 'tema', 'data', 'nota_total', 'c1', 'c2', 'c3', 'c4', 'c5', 'conteudo'];
    const rows = settings.essays.map(e => [e.id, e.theme, e.date, e.totalScore, e.c1, e.c2, e.c3, e.c4, e.c5, plain(e.content)]);
    dl(`redacoes-${toDateOnlyLocal(new Date())}.csv`, [h, ...rows].map(r => r.map(c => escCsv(c)).join(',')).join('\n'), 'text/csv;charset=utf-8');
  }

  async function importFile(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]; ev.target.value = '';
    if (!file) return;
    const text = await file.text();
    const lower = file.name.toLowerCase();
    const imported: EssayEntry[] = [];
    try {
      if (lower.endsWith('.json')) {
        const p = JSON.parse(text) as { essays?: Partial<EssayEntry>[] } | Partial<EssayEntry>[];
        for (const i of (Array.isArray(p) ? p : p.essays || [])) imported.push(normEntry(i));
      } else if (lower.endsWith('.csv')) {
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) throw new Error('CSV vazio');
        const hd = parseCsv(lines[0]).map(x => x.toLowerCase());
        const idx = { id: hd.indexOf('id'), theme: hd.indexOf('tema'), date: hd.indexOf('data'), c1: hd.indexOf('c1'), c2: hd.indexOf('c2'), c3: hd.indexOf('c3'), c4: hd.indexOf('c4'), c5: hd.indexOf('c5'), content: hd.indexOf('conteudo') };
        for (let i = 1; i < lines.length; i++) {
          const c = parseCsv(lines[i]);
          imported.push(normEntry({ id: idx.id >= 0 ? c[idx.id] : undefined, theme: idx.theme >= 0 ? c[idx.theme] : 'Importada', date: idx.date >= 0 ? c[idx.date] : undefined, c1: idx.c1 >= 0 ? Number(c[idx.c1]) : 0, c2: idx.c2 >= 0 ? Number(c[idx.c2]) : 0, c3: idx.c3 >= 0 ? Number(c[idx.c3]) : 0, c4: idx.c4 >= 0 ? Number(c[idx.c4]) : 0, c5: idx.c5 >= 0 ? Number(c[idx.c5]) : 0, content: idx.content >= 0 ? c[idx.content] : '' }));
        }
      } else { alert('Use JSON ou CSV.'); return; }
    } catch (err) { alert(err instanceof Error ? err.message : 'Falha ao importar.'); return; }
    if (!imported.length) { alert('Nenhuma redação válida.'); return; }
    const ids = new Set(settings.essays.map(e => e.id));
    const norm = imported.map(e => { let id = e.id; while (ids.has(id)) id = mkId(); ids.add(id); return { ...e, id }; });
    onUpdateSettings({ ...settings, essays: [...norm, ...settings.essays] });
  }

  function openTimer() { setTimerText(''); setTimerDone(false); setTimerOn(false); setSecLeft(settings.timerDurationMinutes * 60); setTimerOpen(true); }
  function closeTimer() { setTimerOn(false); setTimerOpen(false); }
  function resetTimer() { setTimerOn(false); setTimerDone(false); setSecLeft(settings.timerDurationMinutes * 60); }
  function timerToDraft() { openCreate({ theme: 'Simulado ENEM', date: toDateOnlyLocal(new Date()), content: timerText }); closeTimer(); }

  const inputCls = 'w-full rounded-xl border border-neutral-200/80 bg-white/80 backdrop-blur px-3.5 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 transition-all duration-200';

  return (
    <div className="essay-monitor min-h-screen mesh-bg text-neutral-800 dark:text-slate-100">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-white/60 backdrop-blur-xl border-b border-white/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <BookOpen size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text leading-tight">Redações</h1>
              <p className="text-[10px] text-neutral-400 font-medium -mt-0.5">Monitor ENEM</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openTimer}
              className="h-9 px-3.5 rounded-xl text-xs font-medium text-neutral-600 hover:text-violet-700 bg-white/60 hover:bg-white border border-white/60 hover:border-violet-200 backdrop-blur transition-all duration-200 inline-flex items-center gap-1.5 shadow-sm">
              <Timer size={14} /> Timer
            </button>
            <button onClick={() => openCreate()}
              className="h-9 px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-violet-500/25 hover:-translate-y-[1px] transition-all duration-200 inline-flex items-center gap-1.5">
              <Plus size={14} /> Nova redação
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<FileText size={18} />} label="Redações" value={stats.n}
            gradient="from-violet-500 to-purple-600" glow="stat-glow-purple" delay="" />
          <StatCard icon={<TrendingUp size={18} />} label="Média" value={Math.round(stats.avg)}
            gradient="from-blue-500 to-cyan-500" glow="stat-glow-blue" delay="delay-1" />
          <StatCard icon={<Zap size={18} />} label="Maior nota" value={stats.mx}
            gradient="from-emerald-500 to-teal-500" glow="stat-glow-emerald" delay="delay-2" />
          <StatCard icon={<Target size={18} />} label="Menor nota" value={stats.mn}
            gradient="from-amber-500 to-orange-500" glow="stat-glow-amber" delay="delay-3" />
        </div>

        {/* ── Competencies (ring style) ── */}
        <div className="glass-card-strong rounded-3xl p-6 md:p-8 animate-float-in delay-2">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/20">
              <Sparkles size={15} className="text-white" />
            </div>
            <h2 className="text-sm font-bold text-neutral-700">Competências ENEM</h2>
          </div>
          <div className="flex flex-wrap justify-center gap-6 md:gap-10">
            {stats.cAvg.map(c => (
              <CompRing key={c.key} comp={c} avg={c.avg} />
            ))}
          </div>
        </div>

        {/* ── Two columns: Tips + Evolution ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-5">
          {/* Tips */}
          <div className="glass-card rounded-3xl p-6 animate-float-in delay-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20">
                <Lightbulb size={15} className="text-white" />
              </div>
              <h2 className="text-sm font-bold text-neutral-700">Sugestões</h2>
            </div>
            <div className="space-y-2.5">
              {tips.map((t, i) => (
                <div key={i}
                  className={`rounded-2xl px-4 py-3 text-xs flex items-start gap-2.5 ${t.ok
                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50/50 text-emerald-700 border border-emerald-100'
                    : 'bg-gradient-to-r from-amber-50 to-orange-50/50 text-amber-700 border border-amber-100'
                  }`}>
                  {t.ok
                    ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                    : <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />}
                  <span className="leading-relaxed">{t.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Evolution Chart */}
          <div className="glass-card rounded-3xl p-6 animate-float-in delay-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20">
                <TrendingUp size={15} className="text-white" />
              </div>
              <h2 className="text-sm font-bold text-neutral-700">Evolução</h2>
            </div>
            <EvolutionChart essays={settings.essays} />
          </div>
        </div>

        {/* ── Essays Section ── */}
        <div className="glass-card-strong rounded-3xl overflow-hidden animate-float-in delay-4">
          {/* Section Header */}
          <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100/60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                <FileText size={15} className="text-white" />
              </div>
              <h2 className="text-sm font-bold text-neutral-700">
                Redações <span className="text-neutral-400 font-normal ml-1">{stats.n}</span>
              </h2>
              {/* Tabs */}
              <div className="hidden sm:flex items-center bg-neutral-100/60 rounded-xl p-1">
                {(['list', 'chart'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all duration-200 ${tab === t ? 'bg-white text-neutral-800 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
                    {t === 'list' ? 'Lista' : 'Gráfico'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {[
                { label: 'JSON', icon: <Download size={11} />, fn: exportJson },
                { label: 'CSV', icon: <Download size={11} />, fn: exportCsv },
                { label: 'Importar', icon: <Upload size={11} />, fn: () => impRef.current?.click() },
              ].map(b => (
                <button key={b.label} onClick={b.fn}
                  className="h-7 px-2.5 rounded-lg text-[11px] text-neutral-500 hover:text-violet-600 bg-white/60 hover:bg-white border border-neutral-200/60 hover:border-violet-200 transition-all duration-200 inline-flex items-center gap-1">
                  {b.icon} {b.label}
                </button>
              ))}
              <input ref={impRef} type="file" accept=".json,.csv" className="hidden" onChange={importFile} />
            </div>
          </div>

          {/* Content */}
          {tab === 'chart' ? (
            <div className="p-6">
              <EvolutionChart essays={settings.essays} />
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center mx-auto mb-5">
                <FileText size={32} className="text-violet-400" />
              </div>
              <p className="text-base font-semibold text-neutral-600 mb-1">Nenhuma redação</p>
              <p className="text-sm text-neutral-400 mb-6">Comece a registrar suas redações agora</p>
              <button onClick={() => openCreate()}
                className="text-sm rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-2.5 hover:shadow-lg hover:shadow-violet-500/25 hover:-translate-y-[1px] transition-all duration-200 inline-flex items-center gap-2">
                <Plus size={16} /> Cadastrar
              </button>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-neutral-100/60">
                {sorted.map(e => (
                  <div key={e.id} className="px-5 py-4 hover:bg-white/40 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-800 truncate">{e.theme}</p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">{fDate(e.date)}</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-xl shrink-0 ${tierBadge(e.totalScore, 1000)}`}>
                        {e.totalScore}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      {COMPS.map(c => (
                        <div key={c.key} className="flex-1">
                          <p className="text-[9px] text-neutral-400 text-center mb-1">{c.short}</p>
                          <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, (e[c.key] / 200) * 100)}%`, backgroundColor: TIER_HEX[tier(e[c.key], 200)] }} />
                          </div>
                          <p className="text-[9px] text-neutral-500 text-center mt-0.5 font-medium">{e[c.key]}</p>
                        </div>
                      ))}
                    </div>
                    {e.content && <p className="text-[11px] text-neutral-400 line-clamp-1 mb-2">{plain(e.content)}</p>}
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(e)} className="p-2 rounded-xl text-neutral-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => remove(e.id)} className="p-2 rounded-xl text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-auto max-h-[500px] scrollbar-thin">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white/80 backdrop-blur z-10">
                    <tr className="text-neutral-400 uppercase tracking-wider text-[10px]">
                      <th className="text-left px-5 py-3.5 font-medium">Tema</th>
                      <th className="text-left px-4 py-3.5 font-medium">Data</th>
                      <th className="text-right px-4 py-3.5 font-medium">Total</th>
                      {COMPS.map(c => <th key={c.key} className="text-right px-3 py-3.5 font-medium" title={c.title}>{c.short}</th>)}
                      <th className="text-right px-5 py-3.5 font-medium w-24" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100/60">
                    {sorted.map(e => (
                      <tr key={e.id} className="hover:bg-violet-50/30 transition-colors duration-150 group">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-neutral-700 group-hover:text-violet-700 transition-colors">{e.theme}</p>
                          {e.content && <p className="text-[11px] text-neutral-400 truncate max-w-[280px] mt-0.5">{plain(e.content)}</p>}
                        </td>
                        <td className="px-4 py-3.5 text-neutral-400 whitespace-nowrap">{fDate(e.date)}</td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={`font-bold text-[11px] px-2.5 py-1 rounded-lg ${tierBadge(e.totalScore, 1000)}`}>{e.totalScore}</span>
                        </td>
                        {COMPS.map(c => (
                          <td key={c.key} className="px-3 py-3.5 text-right text-neutral-500 tabular-nums font-medium">{e[c.key]}</td>
                        ))}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg text-neutral-400 hover:text-violet-600 hover:bg-violet-100/60 transition-colors"><Pencil size={13} /></button>
                            <button onClick={() => remove(e.id)} className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-100/60 transition-colors"><Trash2 size={13} /></button>
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

        {/* Mobile chart */}
        <div className="sm:hidden glass-card rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <TrendingUp size={15} className="text-white" />
            </div>
            <h3 className="text-sm font-bold text-neutral-700">Evolução</h3>
          </div>
          <EvolutionChart essays={settings.essays} />
        </div>

        <div className="h-16 lg:h-4" />
      </main>

      {/* ═══════ Form Modal ═══════ */}
      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-violet-500/10 animate-slide-up border border-white/60">
            <div className="px-6 py-5 border-b border-neutral-100/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <Pencil size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium">{draft.id ? 'Editar' : 'Nova redação'}</p>
                  <h3 className="text-base font-bold text-neutral-800">{draft.id ? 'Atualizar registro' : 'Cadastrar redação'}</h3>
                </div>
              </div>
              <button onClick={closeForm} className="p-2.5 rounded-xl text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-all duration-200"><X size={18} /></button>
            </div>

            <div className="px-6 py-6 space-y-5">
              {/* Theme + Date */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Tema</label>
                  <input value={draft.theme} onChange={e => setDraft(p => ({ ...p, theme: e.target.value }))}
                    placeholder="Ex.: Desinformação no Brasil" className={`mt-1.5 ${inputCls}`} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Data</label>
                  <input type="date" value={draft.date} onChange={e => setDraft(p => ({ ...p, date: e.target.value }))}
                    className={`mt-1.5 ${inputCls}`} />
                </div>
              </div>

              {/* Scores */}
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Notas por competência (0–200)</label>
                <div className="grid grid-cols-5 gap-2 mt-2">
                  {COMPS.map(c => (
                    <div key={c.key} className="text-center">
                      <div className={`text-[10px] font-bold bg-gradient-to-r ${c.gradient} bg-clip-text text-transparent`}>{c.short}</div>
                      <input type="number" min={0} max={200} step={10}
                        value={draft[c.key]}
                        onFocus={e => e.currentTarget.select()}
                        onChange={e => setDraft(p => ({ ...p, [c.key]: clamp(Number(e.target.value)) }))}
                        className={`mt-1 ${inputCls} text-center !px-1`} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Texto / Observações</label>
                  <div className="flex items-center gap-1">
                    {(['bold', 'italic', 'underline'] as EditorCmd[]).map(cmd => (
                      <button key={cmd}
                        onClick={() => { try { document.execCommand(cmd, false); } catch { /* */ } }}
                        className={`w-7 h-7 rounded-lg text-xs border border-neutral-200/60 text-neutral-500 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 transition-all duration-200 flex items-center justify-center ${cmd === 'bold' ? 'font-bold' : cmd === 'italic' ? 'italic' : 'underline'}`}>
                        {cmd.charAt(0).toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div ref={edRef} contentEditable suppressContentEditableWarning
                  className="min-h-[120px] rounded-xl border border-neutral-200/80 bg-white/80 backdrop-blur px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 text-neutral-800 transition-all duration-200 [&_*]:!text-inherit" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-neutral-100/60 flex items-center justify-between">
              <p className="text-sm text-neutral-500">
                Total: <span className={`font-bold text-xs px-2.5 py-1 rounded-lg ${tierBadge(dt, 1000)}`}>{dt}/1000</span>
              </p>
              <div className="flex items-center gap-2">
                <button onClick={closeForm}
                  className="h-9 px-4 rounded-xl text-xs border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-all duration-200">Cancelar</button>
                <button onClick={save}
                  className="h-9 px-5 rounded-xl text-xs bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-200 inline-flex items-center gap-1.5 font-semibold">
                  <Save size={13} /> Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Timer Modal ═══════ */}
      {timerOpen && (
        <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-indigo-500/10 animate-slide-up border border-white/60">
            <div className="px-6 py-5 border-b border-neutral-100/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Clock size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium">Sessão guiada</p>
                  <h3 className="text-base font-bold text-neutral-800">Timer de Redação</h3>
                </div>
              </div>
              <button onClick={closeTimer} className="p-2.5 rounded-xl text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-all"><X size={18} /></button>
            </div>

            <div className="px-6 py-6 space-y-5">
              {/* Duration */}
              <div className="grid grid-cols-2 gap-2">
                {([60, 90] as const).map(opt => (
                  <button key={opt}
                    onClick={() => onUpdateSettings({ ...settings, timerDurationMinutes: opt })}
                    disabled={timerOn}
                    className={`h-11 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 ${settings.timerDurationMinutes === opt
                      ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/20'
                      : 'bg-neutral-100/60 text-neutral-600 hover:bg-neutral-100 border border-neutral-200/60'}`}>
                    {opt} min
                  </button>
                ))}
              </div>

              {/* Clock */}
              <div className="rounded-2xl bg-gradient-to-br from-neutral-50 to-neutral-100/50 border border-neutral-100 py-8 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-indigo-500/5" />
                <p className="text-[10px] text-neutral-400 uppercase tracking-widest mb-2 relative">Tempo restante</p>
                <p className="font-mono text-5xl font-extrabold text-neutral-900 tabular-nums relative tracking-tight">{fTime(secLeft)}</p>
                {timerDone && (
                  <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-medium relative">
                    <CheckCircle2 size={13} /> Finalizado
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => setTimerOn(p => !p)}
                  className={`h-11 px-7 rounded-xl text-sm font-semibold text-white transition-all duration-200 inline-flex items-center gap-2 ${timerOn
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-lg hover:shadow-amber-500/25'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:shadow-lg hover:shadow-emerald-500/25'}`}>
                  {timerOn ? <><Pause size={16} /> Pausar</> : <><Play size={16} /> Iniciar</>}
                </button>
                <button onClick={resetTimer}
                  className="h-11 px-5 rounded-xl text-sm border border-neutral-200/60 text-neutral-600 hover:bg-neutral-50 transition-all duration-200 inline-flex items-center gap-2">
                  <TimerReset size={16} /> Reset
                </button>
              </div>

              {/* Draft */}
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Rascunho rápido</label>
                <textarea value={timerText} onChange={e => setTimerText(e.target.value)}
                  placeholder="Escreva aqui..."
                  className={`mt-1.5 ${inputCls} min-h-[110px] resize-none`} />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-neutral-100/60 flex items-center justify-end gap-2">
              <button onClick={closeTimer}
                className="h-9 px-4 rounded-xl text-xs border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-all">Fechar</button>
              <button onClick={timerToDraft}
                className="h-9 px-4 rounded-xl text-xs bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-violet-500/25 transition-all font-semibold">Criar redação</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
