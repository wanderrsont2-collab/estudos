import { lazy, Suspense, useState, useCallback, useEffect, useMemo, useRef, type ChangeEvent, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { loadData, saveData, getSubjectStats, getAllTopics, getDeadlineInfo, getReviewsDue, generateId, normalizeStudyData } from './store';
import { StudyData, Subject, WeeklySchedule, EssayMonitorSettings, PracticeTestsSettings, StudyGoals } from './types';
import { type FSRSConfig, normalizeFSRSConfig } from './fsrs';
import { BookOpen, LayoutDashboard, Brain, Moon, Plus, Pencil, Search, Sun, Trash2, Undo2, X, FileText, Download, Upload, Layers, ClipboardList } from 'lucide-react';

type View = 'overview' | 'subject' | 'reviews' | 'essays' | 'blocks' | 'practiceTests';

const SUBJECT_COLOR_PALETTE = [
  '#1565c0', '#2e7d32', '#e65100', '#6a1b9a',
  '#5d4037', '#00695c', '#00838f', '#c62828',
  '#283593', '#37474f',
] as const;

const SUBJECT_EMOJI_PALETTE = [
  '\u{1F4DA}', '\u{1F4D8}', '\u{1F9EA}', '\u{1F9EC}',
  '\u{1F30D}', '\u{1F4D0}', '\u{1F4DC}', '\u{1F4CC}',
] as const;

const BACKUPS_STORAGE_KEY = 'enem2025_backups_v1';
const BACKUP_SCHEMA_VERSION = 'study-data-v1';
const BACKUP_FILE_KIND = 'enem2025-backup';
const BACKUP_FILE_VERSION = 2;
const MAX_BACKUPS = 20;
const SAVE_DEBOUNCE_MS = 450;
const SEARCH_DEBOUNCE_MS = 140;

const Overview = lazy(() =>
  import('./components/Overview').then(module => ({ default: module.Overview })),
);
const SubjectDetail = lazy(() =>
  import('./components/SubjectDetail').then(module => ({ default: module.SubjectDetail })),
);
const ReviewSystem = lazy(() =>
  import('./components/ReviewSystem').then(module => ({ default: module.ReviewSystem })),
);
const EssayMonitor = lazy(() =>
  import('./components/EssayMonitor').then(module => ({ default: module.EssayMonitor })),
);
const BlockManager = lazy(() =>
  import('./components/BlockManager').then(module => ({ default: module.BlockManager })),
);
const PracticeTests = lazy(() =>
  import('./components/PracticeTests').then(module => ({ default: module.PracticeTests })),
);

interface BackupEntry {
  id: string;
  createdAt: string;
  reason: 'auto' | 'manual';
  schemaVersion: string;
  data: StudyData;
}

interface UndoEntry {
  id: string;
  label: string;
  snapshot: StudyData;
  createdAt: string;
  createdAtMs: number;
  coalesceKey?: string;
}

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
}

interface RenameSubjectState {
  subjectId: string;
  value: string;
  error: string | null;
}

interface ToastItem {
  id: string;
  message: string;
  tone: 'success' | 'info' | 'error';
}

interface SearchResultItem {
  id: string;
  subjectId: string;
  title: string;
  subtitle: string;
  type: 'subject' | 'topic' | 'tag';
  topicId?: string;
  score: number;
}

interface BackupFilePayload {
  kind: typeof BACKUP_FILE_KIND;
  version: number;
  schemaVersion: string;
  exportedAt: string;
  currentData: StudyData;
  backups: BackupEntry[];
}

function toColorLight(hexColor: string): string {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
  if (!match) return '#f3f4f6';
  const [r, g, b] = [match[1], match[2], match[3]].map(v => parseInt(v, 16));
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function toDateOnlyLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ViewLoadingFallback() {
  return (
    <div className="m-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
      Carregando tela...
    </div>
  );
}

interface SubjectContextMenuState {
  subjectId: string;
  x: number;
  y: number;
}

function cloneStudyData(data: StudyData): StudyData {
  if (typeof structuredClone === 'function') {
    return structuredClone(data);
  }
  return JSON.parse(JSON.stringify(data)) as StudyData;
}

function loadBackups(): BackupEntry[] {
  try {
    const raw = window.localStorage.getItem(BACKUPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BackupEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(item => item && item.schemaVersion === BACKUP_SCHEMA_VERSION)
      .map(item => ({
        ...item,
        data: normalizeStudyData(item.data),
      }));
  } catch {
    return [];
  }
}

function triggerJsonDownload(filename: string, payload: unknown) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function containsAllTokens(text: string, tokens: string[]): boolean {
  return tokens.every(token => text.includes(token));
}

function scoreTextMatch(text: string, query: string): number {
  if (text === query) return 120;
  if (text.startsWith(query)) return 90;
  if (text.includes(query)) return 50;
  return 0;
}

export function App() {
  const [data, setData] = useState<StudyData>(() => loadData());
  const [view, setView] = useState<View>('overview');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = window.localStorage.getItem('enem_theme');
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [renameSubjectState, setRenameSubjectState] = useState<RenameSubjectState | null>(null);
  const [newSubjectError, setNewSubjectError] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupEntry[]>(() => loadBackups());
  const [selectedBackupId, setSelectedBackupId] = useState<string>('');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [debouncedGlobalSearchQuery, setDebouncedGlobalSearchQuery] = useState('');
  const [globalSearchType, setGlobalSearchType] = useState<'all' | 'subject' | 'topic' | 'tag'>('all');
  const [focusTopic, setFocusTopic] = useState<{ subjectId: string; topicId: string } | null>(null);

  const [subjectContextMenu, setSubjectContextMenu] = useState<SubjectContextMenuState | null>(null);
  const [isCreateSubjectOpen, setIsCreateSubjectOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectEmoji, setNewSubjectEmoji] = useState('\u{1F4DA}');
  const [newSubjectColor, setNewSubjectColor] = useState<string>('#1565c0');
  const lastBackupHashRef = useRef('');
  const globalSearchRef = useRef<HTMLInputElement | null>(null);
  const backupImportInputRef = useRef<HTMLInputElement | null>(null);

  function pushToast(message: string, tone: ToastItem['tone'] = 'info') {
    setToasts(prev => [
      ...prev,
      { id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, message, tone },
    ]);
  }

  function applyDataChange(
    label: string,
    updater: (prev: StudyData) => StudyData,
    options?: { coalesceKey?: string; coalesceWindowMs?: number },
  ) {
    setData(prev => {
      const next = updater(prev);
      if (next === prev) return prev;
      setUndoStack(stack => {
        const now = Date.now();
        const last = stack[stack.length - 1];
        const coalesceKey = options?.coalesceKey;
        const coalesceWindowMs = options?.coalesceWindowMs ?? 1200;
        const canCoalesce =
          !!coalesceKey &&
          !!last &&
          last.coalesceKey === coalesceKey &&
          now - last.createdAtMs <= coalesceWindowMs;

        if (canCoalesce) return stack;

        return [
          ...stack.slice(-29),
          {
            id: `undo_${now}_${Math.random().toString(36).slice(2, 8)}`,
            label,
            snapshot: cloneStudyData(prev),
            createdAt: new Date(now).toISOString(),
            createdAtMs: now,
            coalesceKey,
          },
        ];
      });
      return { ...next, lastUpdated: new Date().toISOString() };
    });
  }

  function persistBackups(next: BackupEntry[]) {
    setBackups(next);
    window.localStorage.setItem(BACKUPS_STORAGE_KEY, JSON.stringify(next));
  }

  function normalizeBackupEntry(raw: unknown, fallbackReason: BackupEntry['reason'] = 'manual'): BackupEntry | null {
    if (!raw || typeof raw !== 'object') return null;
    const candidate = raw as Partial<BackupEntry> & Record<string, unknown>;
    const normalizedData = normalizeStudyData(candidate.data);
    return {
      id: typeof candidate.id === 'string' && candidate.id.trim().length > 0
        ? candidate.id
        : `backup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: typeof candidate.createdAt === 'string' && candidate.createdAt
        ? candidate.createdAt
        : new Date().toISOString(),
      reason: candidate.reason === 'auto' ? 'auto' : fallbackReason,
      schemaVersion: typeof candidate.schemaVersion === 'string' && candidate.schemaVersion
        ? candidate.schemaVersion
        : BACKUP_SCHEMA_VERSION,
      data: normalizedData,
    };
  }

  function createBackup(reason: 'auto' | 'manual') {
    const snapshot = cloneStudyData(data);
    const hash = JSON.stringify(snapshot);
    if (reason === 'auto' && hash === lastBackupHashRef.current) return;

    const entry: BackupEntry = {
      id: `backup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      reason,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      data: snapshot,
    };

    const next = [entry, ...backups].slice(0, MAX_BACKUPS);
    persistBackups(next);
    lastBackupHashRef.current = hash;
    if (reason === 'manual') {
      pushToast('Backup manual criado com sucesso.', 'success');
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveData(data);
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [data]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedGlobalSearchQuery(globalSearchQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [globalSearchQuery]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = window.setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    window.localStorage.setItem('enem_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!subjectContextMenu) return;

    function closeMenu() {
      setSubjectContextMenu(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeMenu();
    }

    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [subjectContextMenu]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      createBackup('auto');
    }, 120000);
    return () => window.clearTimeout(timer);
  }, [data]); // backup automático apos 2 min sem novas mudancas

  useEffect(() => {
    if (selectedBackupId && !backups.some(item => item.id === selectedBackupId)) {
      setSelectedBackupId('');
    }
  }, [backups, selectedBackupId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        globalSearchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const updateSubject = useCallback(
    (updated: Subject) => {
      applyDataChange('Atualização de disciplina', prev => ({
        ...prev,
        subjects: prev.subjects.map(s => (s.id === updated.id ? updated : s)),
      }), {
        coalesceKey: `subject:${updated.id}`,
        coalesceWindowMs: 1200,
      });
    },
    []
  );

  const updateFsrsConfig = useCallback((nextConfig: FSRSConfig) => {
    applyDataChange('Configuração FSRS', prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        fsrs: normalizeFSRSConfig(nextConfig),
      },
    }));
  }, []);

  const updateSchedule = useCallback((nextSchedule: WeeklySchedule) => {
    applyDataChange('Atualização do cronograma', prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        schedule: nextSchedule,
      },
    }));
  }, []);

  const updateEssayMonitor = useCallback((nextEssayMonitor: EssayMonitorSettings) => {
    applyDataChange('Monitor de redações', prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        essayMonitor: nextEssayMonitor,
      },
    }));
  }, []);

  const updatePracticeTests = useCallback((nextPracticeTests: PracticeTestsSettings) => {
    applyDataChange('Simulados', prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        practiceTests: nextPracticeTests,
      },
    }));
  }, []);

  const updateGoals = useCallback((nextGoals: StudyGoals) => {
    applyDataChange('Atualização de metas', prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        goals: nextGoals,
      },
    }));
  }, []);

  const selectedSubject = data.subjects.find(s => s.id === selectedSubjectId) || null;
  const totalBlocksCount = useMemo(
    () => data.subjects.reduce((sum, subject) => sum + subject.blocks.length, 0),
    [data.subjects],
  );
  const totalPracticeTestsCount = useMemo(
    () => data.settings.practiceTests.tests.length,
    [data.settings.practiceTests.tests.length],
  );
  const globalTagSuggestions = useMemo(() => {
    const unique = new Set<string>();
    for (const subject of data.subjects) {
      for (const group of subject.topicGroups) {
        for (const topic of group.topics) {
          for (const tag of topic.tags ?? []) unique.add(tag);
        }
      }
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [data.subjects]);
  const reviewsDueCount = getReviewsDue(data.subjects).length;
  const contextMenuSubject = subjectContextMenu
    ? data.subjects.find(s => s.id === subjectContextMenu.subjectId) || null
    : null;
  const globalSearchResults = useMemo(() => {
    const rawQuery = debouncedGlobalSearchQuery.trim().toLocaleLowerCase('pt-BR');
    if (rawQuery.length < 2) return [] as SearchResultItem[];
    const tokens = rawQuery.split(/\s+/).filter(Boolean);
    const tagOnlyQuery = rawQuery.startsWith('#') ? rawQuery.slice(1).trim() : '';

    const results: SearchResultItem[] = [];
    for (const subject of data.subjects) {
      const subjectText = `${subject.name} ${subject.emoji}`.toLocaleLowerCase('pt-BR');
      if (globalSearchType !== 'topic' && globalSearchType !== 'tag' && containsAllTokens(subjectText, tokens)) {
        results.push({
          id: `subject-${subject.id}`,
          subjectId: subject.id,
          type: 'subject',
          title: `${subject.emoji} ${subject.name}`,
          subtitle: 'Disciplina',
          score: scoreTextMatch(subject.name.toLocaleLowerCase('pt-BR'), rawQuery),
        });
      }

      for (const group of subject.topicGroups) {
        for (const topic of group.topics) {
          const tags = topic.tags ?? [];
          const tagsText = tags.join(' ');
          const topicText = [
            subject.name,
            group.name,
            topic.name,
            topic.notes,
            tagsText,
            topic.priority ?? '',
            topic.deadline ?? '',
          ]
            .join(' ')
            .toLocaleLowerCase('pt-BR');

          const matchesTopicScope = globalSearchType === 'all' || globalSearchType === 'topic';
          if (matchesTopicScope && containsAllTokens(topicText, tokens)) {
            const isDue = topic.fsrsNextReview ? new Date(topic.fsrsNextReview + 'T00:00:00') <= new Date() : false;
            const metaBits = [
              `${subject.name} -> ${group.name}`,
              tags.length > 0 ? `#${tags.join(' #')}` : '',
              topic.priority ? `Prioridade: ${topic.priority}` : '',
              topic.deadline ? `Prazo: ${topic.deadline}` : '',
              isDue ? 'Revisão pendente' : '',
            ].filter(Boolean);

            results.push({
              id: `topic-${topic.id}`,
              subjectId: subject.id,
              topicId: topic.id,
              type: 'topic',
              title: `${subject.emoji} ${topic.name}`,
              subtitle: metaBits.join(' | '),
              score:
                scoreTextMatch(topic.name.toLocaleLowerCase('pt-BR'), rawQuery) +
                scoreTextMatch(group.name.toLocaleLowerCase('pt-BR'), rawQuery) +
                (tags.some(tag => tag.toLocaleLowerCase('pt-BR').includes(rawQuery)) ? 24 : 0),
            });
          }

          const matchesTagScope = globalSearchType === 'all' || globalSearchType === 'tag';
          if (matchesTagScope) {
            for (const tag of tags) {
              const normalizedTag = tag.toLocaleLowerCase('pt-BR');
              if (tagOnlyQuery && !normalizedTag.includes(tagOnlyQuery)) continue;
              if (!tagOnlyQuery && !containsAllTokens(normalizedTag, tokens)) continue;
              results.push({
                id: `tag-${topic.id}-${tag}`,
                subjectId: subject.id,
                topicId: topic.id,
                type: 'tag',
                title: `#${tag} - ${topic.name}`,
                subtitle: `${subject.name} -> ${group.name}`,
                score: 80 + scoreTextMatch(normalizedTag, tagOnlyQuery || rawQuery),
              });
            }
          }
        }
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 40);
  }, [data.subjects, debouncedGlobalSearchQuery, globalSearchType]);

  const sidebarSubjects = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return data.subjects.map(subject => {
      const stats = getSubjectStats(subject);
      const allTopics_ = getAllTopics(subject);
      const overdueCount = allTopics_.filter(t => {
        if (!t.deadline || t.studied) return false;
        const info = getDeadlineInfo(t.deadline);
        return info?.urgency === 'overdue';
      }).length;
      const highPrioCount = allTopics_.filter(t => !t.studied && t.priority === 'alta').length;
      const reviewsDue = allTopics_.filter(t => {
        if (!t.fsrsNextReview) return false;
        return new Date(t.fsrsNextReview + 'T00:00:00') <= today;
      }).length;
      return {
        subject,
        stats,
        overdueCount,
        highPrioCount,
        reviewsDue,
      };
    });
  }, [data.subjects]);

  function navigateToSubject(id: string, topicId?: string) {
    setSelectedSubjectId(id);
    setView('subject');
    setSidebarOpen(false);
    setSubjectContextMenu(null);
    setGlobalSearchQuery('');
    setDebouncedGlobalSearchQuery('');
    setFocusTopic(topicId ? { subjectId: id, topicId } : null);
  }

  function navigateToOverview() {
    setSelectedSubjectId(null);
    setView('overview');
    setSidebarOpen(false);
    setSubjectContextMenu(null);
    setFocusTopic(null);
  }

  function navigateToReviews() {
    setView('reviews');
    setSelectedSubjectId(null);
    setSidebarOpen(false);
    setSubjectContextMenu(null);
    setFocusTopic(null);
  }

  function navigateToEssays() {
    setView('essays');
    setSelectedSubjectId(null);
    setSidebarOpen(false);
    setSubjectContextMenu(null);
    setFocusTopic(null);
  }

  function navigateToBlocks() {
    setView('blocks');
    setSelectedSubjectId(null);
    setSidebarOpen(false);
    setSubjectContextMenu(null);
    setFocusTopic(null);
  }

  function navigateToPracticeTests() {
    setView('practiceTests');
    setSelectedSubjectId(null);
    setSidebarOpen(false);
    setSubjectContextMenu(null);
    setFocusTopic(null);
  }

  function toggleTheme() {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }

  function openCreateSubjectModal() {
    const randomColor = SUBJECT_COLOR_PALETTE[Math.floor(Math.random() * SUBJECT_COLOR_PALETTE.length)];
    const randomEmoji = SUBJECT_EMOJI_PALETTE[Math.floor(Math.random() * SUBJECT_EMOJI_PALETTE.length)];
    setNewSubjectName('');
    setNewSubjectEmoji(randomEmoji);
    setNewSubjectColor(randomColor);
    setNewSubjectError(null);
    setIsCreateSubjectOpen(true);
    setSubjectContextMenu(null);
  }

  function closeCreateSubjectModal() {
    setIsCreateSubjectOpen(false);
  }

  function handleCreateSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = newSubjectName.trim();
    if (!trimmedName) {
      setNewSubjectError('Informe um nome para a disciplina.');
      return;
    }
    setNewSubjectError(null);

    const finalColor = isValidHexColor(newSubjectColor) ? newSubjectColor : '#1565c0';
    const finalEmoji = newSubjectEmoji.trim() || '\u{1F4DA}';

    const newSubject: Subject = {
      id: `subject_${generateId()}`,
      name: trimmedName,
      emoji: finalEmoji,
      color: finalColor,
      colorLight: toColorLight(finalColor),
      description: '',
      topicGroups: [],
      blocks: [],
    };

    applyDataChange('Criação de disciplina', prev => ({
      ...prev,
      subjects: [...prev.subjects, newSubject],
    }));
    pushToast('Disciplina criada com sucesso.', 'success');

    setIsCreateSubjectOpen(false);
    navigateToSubject(newSubject.id);
  }

  function openSubjectContextMenu(event: ReactMouseEvent<HTMLButtonElement>, subjectId: string) {
    event.preventDefault();
    event.stopPropagation();
    setSubjectContextMenu({ subjectId, x: event.clientX, y: event.clientY });
  }

  function startRenameSubject(subjectId: string) {
    const subject = data.subjects.find(s => s.id === subjectId);
    if (!subject) return;
    setRenameSubjectState({
      subjectId,
      value: subject.name,
      error: null,
    });
    setSubjectContextMenu(null);
  }

  function saveRenameSubject() {
    if (!renameSubjectState) return;
    const trimmedName = renameSubjectState.value.trim();
    if (!trimmedName) {
      setRenameSubjectState(prev => (prev ? { ...prev, error: 'O nome da disciplina nao pode ficar vazio.' } : prev));
      return;
    }
    const subject = data.subjects.find(s => s.id === renameSubjectState.subjectId);
    if (!subject) return;
    updateSubject({ ...subject, name: trimmedName });
    setRenameSubjectState(null);
    pushToast('Disciplina renomeada com sucesso.', 'success');
  }

  function deleteSubject(subjectId: string) {
    const subject = data.subjects.find(s => s.id === subjectId);
    if (!subject) return;
    setConfirmDialog({
      title: 'Excluir disciplina',
      message: `Deseja realmente deletar a disciplina "${subject.name}"?`,
      confirmLabel: 'Excluir',
      tone: 'danger',
      onConfirm: () => {
        applyDataChange('Exclusão de disciplina', prev => ({
          ...prev,
          subjects: prev.subjects.filter(s => s.id !== subjectId),
        }));
        if (selectedSubjectId === subjectId) {
          setSelectedSubjectId(null);
          setView('overview');
        }
        pushToast(`Disciplina "${subject.name}" excluida.`, 'info');
      },
    });
    setSubjectContextMenu(null);
  }

  function undoLastChange() {
    setUndoStack(prev => {
      const last = prev[prev.length - 1];
      if (!last) return prev;
      setData(cloneStudyData(last.snapshot));
      pushToast(`Desfeito: ${last.label}`, 'info');
      return prev.slice(0, -1);
    });
  }

  function restoreBackup(backupId: string) {
    const backup = backups.find(item => item.id === backupId);
    if (!backup) return;
    setConfirmDialog({
      title: 'Restaurar backup',
      message: `Restaurar backup de ${new Date(backup.createdAt).toLocaleString('pt-BR')}?`,
      confirmLabel: 'Restaurar',
      onConfirm: () => {
        setUndoStack(prev => [
          ...prev.slice(-29),
          {
            id: `undo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            label: 'Restauracao de backup',
            snapshot: cloneStudyData(data),
            createdAt: new Date().toISOString(),
            createdAtMs: Date.now(),
          },
        ]);
        setData(cloneStudyData(backup.data));
        pushToast('Backup restaurado com sucesso.', 'success');
      },
    });
  }

  function exportBackupsToFile() {
    const payload: BackupFilePayload = {
      kind: BACKUP_FILE_KIND,
      version: BACKUP_FILE_VERSION,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      currentData: cloneStudyData(data),
      backups,
    };
    triggerJsonDownload(`enem2025-backup-v${BACKUP_FILE_VERSION}-${toDateOnlyLocal(new Date())}.json`, payload);
    pushToast('Backup exportado para arquivo.', 'success');
  }

  async function importBackupsFromFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      pushToast('Arquivo invalido. Use um JSON de backup exportado pelo app.', 'error');
      return;
    }

    let importedData: StudyData | null = null;
    let importedBackups: BackupEntry[] = [];

    if (parsed && typeof parsed === 'object' && (parsed as Record<string, unknown>).kind === BACKUP_FILE_KIND) {
      const payload = parsed as Partial<BackupFilePayload> & Record<string, unknown>;
      importedData = normalizeStudyData(payload.currentData);
      importedBackups = Array.isArray(payload.backups)
        ? payload.backups
            .map(item => normalizeBackupEntry(item, 'manual'))
            .filter((item): item is BackupEntry => item !== null)
            .slice(0, MAX_BACKUPS)
        : [];
    } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).subjects)) {
      importedData = normalizeStudyData(parsed);
      importedBackups = [
        {
          id: `backup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          createdAt: new Date().toISOString(),
          reason: 'manual',
          schemaVersion: BACKUP_SCHEMA_VERSION,
          data: importedData,
        },
      ];
    } else {
      pushToast('Formato nao reconhecido. Exporte um backup versionado para importar.', 'error');
      return;
    }

    setConfirmDialog({
      title: 'Importar backup',
      message: 'Deseja substituir os dados atuais pelos dados do arquivo importado?',
      confirmLabel: 'Importar',
      onConfirm: () => {
        if (!importedData) return;
        setUndoStack(prev => [
          ...prev.slice(-29),
          {
            id: `undo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            label: 'Importacao de backup',
            snapshot: cloneStudyData(data),
            createdAt: new Date().toISOString(),
            createdAtMs: Date.now(),
          },
        ]);
        setData(cloneStudyData(importedData));
        persistBackups(importedBackups.length > 0 ? importedBackups : backups);
        pushToast('Backup importado com sucesso.', 'success');
      },
    });
  }

  const contextMenuPosition = subjectContextMenu
    ? {
        left: Math.max(8, Math.min(subjectContextMenu.x, window.innerWidth - 176)),
        top: Math.max(8, Math.min(subjectContextMenu.y, window.innerHeight - 96)),
      }
    : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 font-['Inter',sans-serif] transition-colors">
      {/* Top Navigation */}
      <nav className="bg-[#1a237e] dark:bg-slate-900 text-white shadow-lg sticky top-0 z-50 border-b border-transparent dark:border-slate-700">
        <div className="w-full px-4 pt-3 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-lg font-bold flex items-center gap-2 truncate">
                {'\u{1F4CA}'} Cronograma ENEM 2025
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={undoLastChange}
                disabled={undoStack.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Desfazer ultima alteracao"
              >
                <Undo2 size={16} />
                <span className="hidden sm:inline">Desfazer</span>
              </button>
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-white/10 hover:bg-white/20 transition-colors"
                title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                <span className="hidden sm:inline">{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
              </button>
            </div>
          </div>

          <div className="mt-2 flex flex-col lg:flex-row lg:items-center gap-1.5">
            <div className="relative w-full lg:w-auto max-w-[340px] hidden md:block global-search-shell">
              <div className="flex items-center gap-2 rounded-lg bg-white/10 border border-white/20 px-2 py-1.5 backdrop-blur-sm">
                <Search size={14} className="text-white/80" />
                <input
                  ref={globalSearchRef}
                  value={globalSearchQuery}
                  onChange={event => setGlobalSearchQuery(event.target.value)}
                  placeholder="Buscar assuntos, tags e notas... (Ctrl+K)"
                  className="w-full lg:w-56 bg-transparent text-xs leading-5 text-white placeholder:text-white/70 outline-none"
                />
                <select
                  value={globalSearchType}
                  onChange={event => setGlobalSearchType(event.target.value as 'all' | 'subject' | 'topic' | 'tag')}
                  className="rounded-md border border-white/20 bg-white/10 px-1.5 py-1 text-[10px] text-white/90"
                >
                  <option value="all" className="text-slate-900">Tudo</option>
                  <option value="subject" className="text-slate-900">Disciplinas</option>
                  <option value="topic" className="text-slate-900">Assuntos</option>
                  <option value="tag" className="text-slate-900">Tags</option>
                </select>
              </div>
              {globalSearchResults.length > 0 && (
                <div className="absolute top-full mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur-md shadow-2xl max-h-72 overflow-y-auto">
                  {globalSearchResults.map(item => (
                    <button
                      key={item.id}
                      onClick={() => navigateToSubject(item.subjectId, item.topicId)}
                      className="w-full text-left px-3 py-2 hover:bg-white/10 transition-colors border-b border-white/5 last:border-b-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-white font-medium truncate">{item.title}</p>
                        <span className="text-[10px] uppercase tracking-wide rounded-full px-1.5 py-0.5 bg-white/10 text-white/70 shrink-0">
                          {item.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 truncate">{item.subtitle}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={navigateToOverview}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  view === 'overview' ? 'bg-white/25' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <LayoutDashboard size={15} /> Visao geral
              </button>
              <button
                onClick={navigateToReviews}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors relative ${
                  view === 'reviews' ? 'bg-purple-600 text-white' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <Brain size={15} /> Revisoes
                {reviewsDueCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {reviewsDueCount}
                  </span>
                )}
              </button>
              <button
                onClick={navigateToEssays}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  view === 'essays' ? 'bg-cyan-600 text-white' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <FileText size={15} /> Redacoes
              </button>
              <button
                onClick={navigateToBlocks}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  view === 'blocks' ? 'bg-indigo-600 text-white' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <Layers size={15} /> Blocos
              </button>
              <button
                onClick={navigateToPracticeTests}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  view === 'practiceTests' ? 'bg-emerald-600 text-white' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <ClipboardList size={15} /> Simulados
                {totalPracticeTestsCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                    {totalPracticeTestsCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex w-full">
        {/* Sidebar */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 shadow-lg lg:shadow-sm border-r border-gray-200 dark:border-slate-700 transform transition-transform duration-300 ease-in-out lg:transform-none ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          } pt-24 lg:pt-0 overflow-y-auto`}
        >
          <div className="p-4">
            {/* Review Button in Sidebar */}
            <button
              onClick={navigateToReviews}
              className={`w-full mb-4 px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all text-sm ${
                view === 'reviews'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              <Brain size={20} />
              <div className="flex-1 text-left">
                <p className="font-medium">Revisões FSRS</p>
                <p className={`text-xs ${view === 'reviews' ? 'text-purple-200' : 'text-purple-500'}`}>
                  {reviewsDueCount > 0 ? `${'\u{1F514}'} ${reviewsDueCount} pendente(s)` : `${'\u2705'} Em dia`}
                </p>
              </div>
              {reviewsDueCount > 0 && (
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  view === 'reviews' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'
                }`}>
                  {reviewsDueCount}
                </span>
              )}
            </button>

            <button
              onClick={navigateToEssays}
              className={`w-full mb-4 px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all text-sm ${
                view === 'essays'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
              }`}
            >
              <FileText size={20} />
              <div className="flex-1 text-left">
                <p className="font-medium">Monitor de Redações</p>
                <p className={`text-xs ${view === 'essays' ? 'text-cyan-100' : 'text-cyan-600'}`}>
                  {data.settings.essayMonitor.essays.length} registrada(s)
                </p>
              </div>
            </button>

            <button
              onClick={navigateToBlocks}
              className={`w-full mb-4 px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all text-sm ${
                view === 'blocks'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/40'
              }`}
            >
              <Layers size={20} />
              <div className="flex-1 text-left">
                <p className="font-medium">Blocos / Fases</p>
                <p className={`text-xs ${view === 'blocks' ? 'text-indigo-100' : 'text-indigo-500 dark:text-indigo-400'}`}>
                  {totalBlocksCount} bloco{totalBlocksCount !== 1 ? 's' : ''} criado{totalBlocksCount !== 1 ? 's' : ''}
                </p>
              </div>
            </button>

            <button
              onClick={navigateToPracticeTests}
              className={`w-full mb-4 px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all text-sm ${
                view === 'practiceTests'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/40'
              }`}
            >
              <ClipboardList size={20} />
              <div className="flex-1 text-left">
                <p className="font-medium">Simulados</p>
                <p className={`text-xs ${view === 'practiceTests' ? 'text-emerald-100' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {totalPracticeTestsCount} registrado{totalPracticeTestsCount !== 1 ? 's' : ''}
                </p>
              </div>
            </button>

            <div className="flex items-center justify-between mb-3 px-2">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Disciplinas
              </h2>
              <button
                onClick={openCreateSubjectModal}
                className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                title="Adicionar disciplina"
              >
                <Plus size={12} /> Nova
              </button>
            </div>

            <div className="space-y-1">
              {sidebarSubjects.map(({ subject, stats, overdueCount, highPrioCount, reviewsDue }) => {
                const isActive = view === 'subject' && selectedSubjectId === subject.id;

                return (
                  <button
                    key={subject.id}
                    onClick={() => navigateToSubject(subject.id)}
                    onContextMenu={(event) => openSubjectContextMenu(event, subject.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all text-sm group ${
                      isActive
                        ? 'shadow-md text-white'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                    style={isActive ? { backgroundColor: subject.color } : undefined}
                  >
                    <span className="text-lg">{subject.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className={`font-medium truncate text-sm ${isActive ? 'text-white' : ''}`}>
                          {subject.name}
                        </p>
                        {overdueCount > 0 && (
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-orange-300' : 'bg-red-500'}`} title={`${overdueCount} prazo(s) vencido(s)`} />
                        )}
                        {highPrioCount > 0 && !overdueCount && (
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-red-300' : 'bg-red-400'}`} title={`${highPrioCount} prioridade(s) alta(s)`} />
                        )}
                        {reviewsDue > 0 && (
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-purple-300' : 'bg-purple-500'}`} title={`${reviewsDue} revisão(oes)`} />
                        )}
                      </div>
                      <p className={`text-xs ${isActive ? 'text-white/70' : 'text-gray-400'}`}>
                        {stats.studied}/{stats.total} estudados | {subject.topicGroups.length} tópico{subject.topicGroups.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {stats.total > 0 && (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : subject.color + '15',
                          color: isActive ? 'white' : subject.color,
                        }}
                      >
                        {Math.round(stats.progresso * 100)}%
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tips in sidebar */}
          <div className="p-4 border-t border-gray-100 dark:border-slate-700">
            <div className="bg-purple-50 dark:bg-purple-900/25 rounded-xl p-3 text-xs text-purple-700 dark:text-purple-200">
              <p className="font-bold mb-1">{'\u{1F9E0}'} Dica FSRS</p>
              <p>Marque assuntos como estudados e inicie revisões para otimizar sua retenção de conteúdo!</p>
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Backups</p>
              <button
                onClick={() => createBackup('manual')}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Criar backup agora
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={exportBackupsToFile}
                  className="px-2.5 py-1.5 rounded-lg text-xs bg-sky-600 text-white hover:bg-sky-700 inline-flex items-center justify-center gap-1"
                >
                  <Download size={12} /> Exportar
                </button>
                <button
                  onClick={() => backupImportInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-700 text-white hover:bg-slate-800 inline-flex items-center justify-center gap-1"
                >
                  <Upload size={12} /> Importar
                </button>
                <input
                  ref={backupImportInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={importBackupsFromFile}
                />
              </div>
              <select
                value={selectedBackupId}
                onChange={event => setSelectedBackupId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs"
              >
                <option value="">Selecionar backup</option>
                {backups.map(item => (
                  <option key={item.id} value={item.id}>
                    {new Date(item.createdAt).toLocaleString('pt-BR')} ({item.reason})
                  </option>
                ))}
              </select>
              <button
                onClick={() => selectedBackupId && restoreBackup(selectedBackupId)}
                disabled={!selectedBackupId}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Restaurar backup
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className={`flex-1 min-w-0 ${view === 'subject' ? 'p-0' : 'p-3 md:p-4 lg:p-5'}`}>
          <Suspense fallback={<ViewLoadingFallback />}>
            {view === 'reviews' ? (
              <ReviewSystem
                subjects={data.subjects}
                fsrsConfig={data.settings.fsrs}
                onUpdateFsrsConfig={updateFsrsConfig}
                onUpdateSubject={updateSubject}
                onNavigateToSubject={navigateToSubject}
              />
            ) : view === 'essays' ? (
              <EssayMonitor
                settings={data.settings.essayMonitor}
                onUpdateSettings={updateEssayMonitor}
              />
            ) : view === 'blocks' ? (
              <BlockManager
                subjects={data.subjects}
                onUpdateSubject={updateSubject}
                onNavigateToSubject={navigateToSubject}
              />
            ) : view === 'practiceTests' ? (
              <PracticeTests
                settings={data.settings.practiceTests}
                onUpdateSettings={updatePracticeTests}
              />
            ) : view === 'subject' && selectedSubject ? (
              <SubjectDetail
                subject={selectedSubject}
                globalTagSuggestions={globalTagSuggestions}
                fsrsConfig={data.settings.fsrs}
                onBack={navigateToOverview}
                onUpdate={updateSubject}
                focusTopicId={focusTopic?.subjectId === selectedSubject.id ? focusTopic.topicId : null}
                onConsumeFocusTopic={() => setFocusTopic(null)}
              />
            ) : (
              <Overview
                subjects={data.subjects}
                schedule={data.settings.schedule}
                goals={data.settings.goals}
                essays={data.settings.essayMonitor.essays}
                onUpdateSchedule={updateSchedule}
                onUpdateGoals={updateGoals}
                onSelectSubject={navigateToSubject}
                onOpenReviews={navigateToReviews}
              />
            )}
          </Suspense>
        </main>
      </div>

      {/* Subject Context Menu */}
      {subjectContextMenu && contextMenuPosition && contextMenuSubject && (
        <div
          className="fixed z-[70] w-44 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1"
          style={{ left: contextMenuPosition.left, top: contextMenuPosition.top }}
          onClick={event => event.stopPropagation()}
        >
          <button
            onClick={() => {
              startRenameSubject(contextMenuSubject.id);
              setSubjectContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2"
          >
            <Pencil size={14} /> Renomear
          </button>
          <button
            onClick={() => {
              deleteSubject(contextMenuSubject.id);
              setSubjectContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <Trash2 size={14} /> Deletar
          </button>
        </div>
      )}

      {/* Create Subject Modal */}
      {isCreateSubjectOpen && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-gray-200 dark:border-slate-700">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Nova disciplina</h3>
              <button
                onClick={closeCreateSubjectModal}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSubject} className="p-4 space-y-3">
              {newSubjectError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {newSubjectError}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Nome</label>
                <input
                  value={newSubjectName}
                  onChange={(event) => {
                    setNewSubjectName(event.target.value);
                    if (newSubjectError) setNewSubjectError(null);
                  }}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Ex: Literatura"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Emoji</label>
                  <input
                    value={newSubjectEmoji}
                    onChange={(event) => setNewSubjectEmoji(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="\u{1F4DA}"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Cor</label>
                  <input
                    type="color"
                    value={newSubjectColor}
                    onChange={(event) => setNewSubjectColor(event.target.value)}
                    className="h-10 w-14 rounded-lg border border-gray-300 dark:border-slate-700 p-1 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCreateSubjectModal}
                  className="px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 inline-flex items-center gap-1"
                >
                  <Plus size={14} /> Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {renameSubjectState && (
        <div className="fixed inset-0 z-[82] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-gray-200 dark:border-slate-700">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Renomear disciplina</h3>
              <button
                onClick={() => setRenameSubjectState(null)}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <input
                value={renameSubjectState.value}
                onChange={event => setRenameSubjectState(prev => (prev ? { ...prev, value: event.target.value, error: null } : prev))}
                className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                autoFocus
              />
              {renameSubjectState.error && (
                <p className="text-xs text-red-600">{renameSubjectState.error}</p>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setRenameSubjectState(null)}
                  className="px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveRenameSubject}
                  className="px-3 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[83] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-gray-200 dark:border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">{confirmDialog.title}</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">{confirmDialog.message}</p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  action();
                }}
                className={`px-3 py-1.5 rounded-lg text-sm text-white ${
                  confirmDialog.tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmDialog.confirmLabel || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="fixed right-3 bottom-20 lg:bottom-4 z-[110] space-y-2 w-[360px] max-w-[calc(100vw-1.5rem)]">
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

      {/* Mobile Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 lg:hidden z-40 safe-area-pb">
        <div className="grid grid-cols-4">
          <button
            onClick={navigateToOverview}
            className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs ${
              view === 'overview' ? 'text-[#1a237e] font-bold' : 'text-gray-400'
            }`}
          >
            <LayoutDashboard size={20} />
            Visão Geral
          </button>
          <button
            onClick={navigateToReviews}
            className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs relative ${
              view === 'reviews' ? 'text-purple-700 font-bold' : 'text-gray-400'
            }`}
          >
            <Brain size={20} />
            Revisões
            {reviewsDueCount > 0 && (
              <span className="absolute top-1.5 right-1/4 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {reviewsDueCount}
              </span>
            )}
          </button>
          <button
            onClick={navigateToEssays}
            className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs ${
              view === 'essays' ? 'text-cyan-700 font-bold' : 'text-gray-400'
            }`}
          >
            <FileText size={20} />
            Redações
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs ${
              sidebarOpen ? 'text-[#1a237e] font-bold' : 'text-gray-400'
            }`}
          >
            <BookOpen size={20} />
            Disciplinas
          </button>
        </div>
      </div>
    </div>
  );
}







