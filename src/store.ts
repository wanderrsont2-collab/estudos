import {
  StudyData,
  Subject,
  Topic,
  TopicGroup,
  Priority,
  ReviewEntry,
  WeeklySchedule,
  ScheduleCellData,
  EssayEntry,
  EssayMonitorSettings,
  PracticeTestsSettings,
  PracticeTestEntry,
  PracticeQuestionMark,
  StudyGoals,
  QuestionLogEntry,
  StudyBlock,
  BlockPracticeTest,
  BlockCumulativeReview,
} from './types';
import { DEFAULT_FSRS_CONFIG, normalizeFSRSConfig } from './fsrs';

const STORAGE_KEY = 'enem2025_study_data';

function fixLegacyMojibake(value: string): string {
  const mojibakePattern = /[\u00C3\u00C2\u00E2\u00F0]/;
  const mojibakePatternGlobal = /[\u00C3\u00C2\u00E2\u00F0]/g;
  if (!mojibakePattern.test(value)) return value;
  try {
    const bytes = Uint8Array.from(value, ch => ch.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder('utf-8').decode(bytes);
    const before = (value.match(mojibakePatternGlobal) || []).length;
    const after = (decoded.match(mojibakePatternGlobal) || []).length;
    return after < before ? decoded : value;
  } catch {
    return value;
  }
}

function normalizeLoadedText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? fixLegacyMojibake(value) : fallback;
}

const defaultSubjects: Omit<Subject, 'topicGroups' | 'blocks'>[] = [
  { id: 'matematica', name: 'Matemática', emoji: '\u{1F4D0}', color: '#1565c0', colorLight: '#e3f2fd', description: '' },
  { id: 'biologia', name: 'Biologia', emoji: '\u{1F9EC}', color: '#2e7d32', colorLight: '#e8f5e9', description: '' },
  { id: 'fisica', name: 'Física', emoji: '\u26A1', color: '#e65100', colorLight: '#fff3e0', description: '' },
  { id: 'quimica', name: 'Química', emoji: '\u{1F9EA}', color: '#6a1b9a', colorLight: '#f3e5f5', description: '' },
  { id: 'historia', name: 'História', emoji: '\u{1F4DC}', color: '#5d4037', colorLight: '#efebe9', description: '' },
  { id: 'geografia', name: 'Geografia', emoji: '\u{1F30D}', color: '#00695c', colorLight: '#e0f2f1', description: '' },
  { id: 'filosofia_sociologia', name: 'Filosofia/Sociologia', emoji: '\u{1F9E0}', color: '#6a1b9a', colorLight: '#f3e5f5', description: '' },
];

const DEFAULT_SCHEDULE_COLUMNS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const DEFAULT_SCHEDULE_START_HOUR = 7;
const DEFAULT_SCHEDULE_END_HOUR = 22;
const DEFAULT_ESSAY_TIMER_DURATION: 60 | 90 = 90;
const DEFAULT_STUDY_GOALS: StudyGoals = {
  dailyQuestionsTarget: 30,
  weeklyReviewTarget: 20,
  weeklyEssayTarget: 1,
};

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function toNonNegativeInt(value: unknown, max = 1_000_000): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return clampInt(parsed, 0, max);
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ensureGoals(raw: unknown): StudyGoals {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_STUDY_GOALS };
  const candidate = raw as Partial<StudyGoals> & { dailyStudyTarget?: number };
  return {
    dailyQuestionsTarget: clampInt(
      Number(candidate.dailyQuestionsTarget ?? candidate.dailyStudyTarget ?? DEFAULT_STUDY_GOALS.dailyQuestionsTarget),
      1,
      200,
    ),
    weeklyReviewTarget: clampInt(Number(candidate.weeklyReviewTarget ?? DEFAULT_STUDY_GOALS.weeklyReviewTarget), 1, 100),
    weeklyEssayTarget: clampInt(Number(candidate.weeklyEssayTarget ?? DEFAULT_STUDY_GOALS.weeklyEssayTarget), 1, 14),
  };
}

function normalizeTopicTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const tag of raw) {
    const normalized = normalizeLoadedText(tag, '').replace(/\s+/g, ' ').trim();
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase('pt-BR');
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(normalized);
  }
  return tags.slice(0, 12);
}

function normalizeQuestionLogs(raw: unknown): QuestionLogEntry[] {
  if (!Array.isArray(raw)) return [];
  const byDate = new Map<string, QuestionLogEntry>();
  for (const itemRaw of raw) {
    if (!itemRaw || typeof itemRaw !== 'object') continue;
    const item = itemRaw as Partial<QuestionLogEntry>;
    const date = normalizeLoadedText(item.date, '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const questionsMade = clampInt(Number(item.questionsMade ?? 0), 0, 5000);
    const questionsCorrect = clampInt(Number(item.questionsCorrect ?? 0), 0, 5000);
    const existing = byDate.get(date);
    if (existing) {
      existing.questionsMade += questionsMade;
      existing.questionsCorrect += questionsCorrect;
    } else {
      byDate.set(date, { date, questionsMade, questionsCorrect });
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function createEmptyScheduleRow(columnsCount: number, timeLabel = '') {
  return {
    id: 'sched_' + generateId(),
    timeLabel,
    cells: Array.from({ length: columnsCount }, (): ScheduleCellData => ({ text: '' })),
  };
}

function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function getDefaultWeeklySchedule(): WeeklySchedule {
  return {
    columns: [...DEFAULT_SCHEDULE_COLUMNS],
    rows: Array.from(
      { length: DEFAULT_SCHEDULE_END_HOUR - DEFAULT_SCHEDULE_START_HOUR + 1 },
      (_, index) => createEmptyScheduleRow(
        DEFAULT_SCHEDULE_COLUMNS.length,
        formatHourLabel(DEFAULT_SCHEDULE_START_HOUR + index),
      ),
    ),
  };
}

function ensureWeeklySchedule(raw: unknown): WeeklySchedule {
  const fallback = getDefaultWeeklySchedule();
  if (!raw || typeof raw !== 'object') return fallback;

  const candidate = raw as Partial<WeeklySchedule>;
  const columnsRaw = Array.isArray(candidate.columns)
    ? candidate.columns.map(col => normalizeLoadedText(col, '').trim()).filter(Boolean)
    : [];
  const columns = columnsRaw.length > 0 ? columnsRaw : fallback.columns;

  const rows = Array.isArray(candidate.rows)
    ? candidate.rows.map((row, idx) => {
        const item = (row as unknown as Record<string, unknown>) || {};
        const id = normalizeLoadedText(item.id, 'sched_' + generateId());
        const timeLabel = normalizeLoadedText(item.timeLabel, '');
        const rawCells = Array.isArray(item.cells) ? item.cells : [];
        const cells = Array.from({ length: columns.length }, (_, colIdx): ScheduleCellData => {
          const rawVal = rawCells[colIdx];
          if (typeof rawVal === 'string') {
            return { text: normalizeLoadedText(rawVal, '') };
          }
          if (rawVal && typeof rawVal === 'object') {
            const cellRaw = rawVal as Record<string, unknown>;
            const subjectIdCandidate = normalizeLoadedText(cellRaw.subjectId, '').trim();
            return {
              text: normalizeLoadedText(cellRaw.text, ''),
              subjectId: subjectIdCandidate || undefined,
            };
          }
          return { text: '' };
        });
        return {
          id: id || ('sched_' + generateId() + '_' + idx),
          timeLabel,
          cells,
        };
      })
    : [];

  const isLegacyDefaultSchedule =
    columns.length === 7 &&
    rows.length === 3 &&
    rows[0]?.timeLabel === '08:00 - 09:00' &&
    rows[1]?.timeLabel === '09:00 - 10:00' &&
    rows[2]?.timeLabel === '10:00 - 11:00';

  if (isLegacyDefaultSchedule) {
    return fallback;
  }

  return {
    columns,
    rows: rows.length > 0 ? rows : fallback.rows.map(row => ({
      ...row,
      cells: row.cells.map(cell => ({ text: cell.text, subjectId: cell.subjectId })),
    })),
  };
}

function clampEssayScore(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(200, Math.round(parsed)));
}

function toEssayTotal(c1: number, c2: number, c3: number, c4: number, c5: number): number {
  return c1 + c2 + c3 + c4 + c5;
}

function ensureEssayEntry(raw: unknown): EssayEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const c1 = clampEssayScore(item.c1);
  const c2 = clampEssayScore(item.c2);
  const c3 = clampEssayScore(item.c3);
  const c4 = clampEssayScore(item.c4);
  const c5 = clampEssayScore(item.c5);
  const dateCandidate = normalizeLoadedText(item.date, '').trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateCandidate)
    ? dateCandidate
    : toDateOnlyString(new Date());
  const nowIso = new Date().toISOString();

  return {
    id: normalizeLoadedText(item.id, '') || ('essay_' + generateId()),
    theme: normalizeLoadedText(item.theme, 'Redação sem tema').trim() || 'Redação sem tema',
    date,
    c1,
    c2,
    c3,
    c4,
    c5,
    totalScore: toEssayTotal(c1, c2, c3, c4, c5),
    content: normalizeLoadedText(item.content, ''),
    createdAt: normalizeLoadedText(item.createdAt, nowIso),
    updatedAt: normalizeLoadedText(item.updatedAt, nowIso),
  };
}

function ensureEssayMonitorSettings(raw: unknown): EssayMonitorSettings {
  if (!raw || typeof raw !== 'object') {
    return {
      essays: [],
      timerDurationMinutes: DEFAULT_ESSAY_TIMER_DURATION,
    };
  }

  const candidate = raw as Partial<EssayMonitorSettings> & Record<string, unknown>;
  const essays = Array.isArray(candidate.essays)
    ? candidate.essays
        .map(ensureEssayEntry)
        .filter((entry): entry is EssayEntry => entry !== null)
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  return {
    essays,
    timerDurationMinutes: candidate.timerDurationMinutes === 60 ? 60 : 90,
  };
}

function ensurePracticeTestsSettings(raw: unknown): PracticeTestsSettings {
  if (!raw || typeof raw !== 'object') return { tests: [] };

  const candidate = raw as Record<string, unknown>;
  const testsRaw = Array.isArray(candidate.tests) ? candidate.tests : [];
  const tests: PracticeTestEntry[] = testsRaw
    .map((testRaw, idx) => {
      if (!testRaw || typeof testRaw !== 'object') return null;
      const test = testRaw as Record<string, unknown>;
      const dateCandidate = normalizeLoadedText(test.date, '').trim();
      const date = /^\d{4}-\d{2}-\d{2}$/.test(dateCandidate)
        ? dateCandidate
        : toDateOnlyString(new Date());
      const totalQuestions = clampInt(Number(test.totalQuestions ?? test.questionsTotal ?? 0), 1, 500);
      const correctAnswers = clampInt(Number(test.correctAnswers ?? 0), 0, totalQuestions);

      const marksRaw = Array.isArray(test.questionMarks) ? test.questionMarks : [];
      const markMap = new Map<number, PracticeQuestionMark['status']>();
      for (const markRaw of marksRaw) {
        if (!markRaw || typeof markRaw !== 'object') continue;
        const mark = markRaw as Record<string, unknown>;
        const questionNumber = clampInt(Number(mark.questionNumber), 1, totalQuestions);
        const status = mark.status === 'mastered' ? 'mastered' : mark.status === 'wrong' ? 'wrong' : null;
        if (!status) continue;
        markMap.set(questionNumber, status);
      }
      const questionMarks: PracticeQuestionMark[] = Array.from(markMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([questionNumber, status]) => ({ questionNumber, status }));

      const nowIso = new Date().toISOString();
      return {
        id: normalizeLoadedText(test.id, '') || `practice_${generateId()}_${idx}`,
        date,
        totalQuestions,
        correctAnswers,
        questionMarks,
        createdAt: normalizeLoadedText(test.createdAt, nowIso),
        updatedAt: normalizeLoadedText(test.updatedAt, nowIso),
      } satisfies PracticeTestEntry;
    })
    .filter((test): test is PracticeTestEntry => test !== null)
    .sort((a, b) => b.date.localeCompare(a.date));

  return { tests };
}

function getDefaultSettings(): StudyData['settings'] {
  return {
    fsrs: normalizeFSRSConfig(DEFAULT_FSRS_CONFIG),
    schedule: getDefaultWeeklySchedule(),
    essayMonitor: {
      essays: [],
      timerDurationMinutes: DEFAULT_ESSAY_TIMER_DURATION,
    },
    practiceTests: {
      tests: [],
    },
    goals: { ...DEFAULT_STUDY_GOALS },
  };
}

function ensureTopicFields(t: Record<string, unknown>): Topic {
  const questionsTotal = toNonNegativeInt(t.questionsTotal);
  const questionsCorrect = Math.min(questionsTotal, toNonNegativeInt(t.questionsCorrect));
  const fsrsDifficulty = Math.max(0, toFiniteNumber(t.fsrsDifficulty, 0));
  const fsrsStability = Math.max(0, toFiniteNumber(t.fsrsStability, 0));

  return {
    id: (t.id as string) || generateId(),
    name: normalizeLoadedText(t.name, ''),
    studied: !!(t.studied),
    questionsTotal,
    questionsCorrect,
    questionLogs: normalizeQuestionLogs(t.questionLogs),
    notes: normalizeLoadedText(t.notes, ''),
    tags: normalizeTopicTags(t.tags),
    dateStudied: (t.dateStudied as string) || null,
    priority: (t.priority as Priority) || null,
    deadline: (t.deadline as string) || null,
    // FSRS fields
    fsrsDifficulty,
    fsrsStability,
    fsrsLastReview: (t.fsrsLastReview as string) || null,
    fsrsNextReview: (t.fsrsNextReview as string) || null,
    reviewHistory: ((t.reviewHistory as ReviewEntry[]) || []).map(entry => ({
      ...entry,
      ratingLabel: normalizeLoadedText(entry.ratingLabel, ''),
    })),
  };
}

export function normalizeStudyData(raw: unknown): StudyData {
  const fallbackSubjects = defaultSubjects.map(s => ({ ...s, topicGroups: [], blocks: [] }));
  const baseSettings = getDefaultSettings();

  if (!raw || typeof raw !== 'object') {
    return {
      subjects: fallbackSubjects,
      settings: baseSettings,
      lastUpdated: new Date().toISOString(),
    };
  }

  const data = raw as Record<string, unknown>;
  const subjectsRaw = Array.isArray(data.subjects) ? data.subjects : [];
  const normalizedSubjects = subjectsRaw
    .map((subjectRaw, idx) => {
      if (!subjectRaw || typeof subjectRaw !== 'object') return null;
      const subject = subjectRaw as Record<string, unknown>;

      const topicGroupsRaw: unknown[] = Array.isArray(subject.topicGroups)
        ? subject.topicGroups
        : Array.isArray(subject.topics)
          ? [{
              id: generateId(),
              name: 'Geral',
              topics: subject.topics,
            }]
          : [];

      const topicGroups: TopicGroup[] = topicGroupsRaw
        .map((groupRaw, groupIdx) => {
          if (!groupRaw || typeof groupRaw !== 'object') return null;
          const group = groupRaw as Record<string, unknown>;
          const topicsRaw = Array.isArray(group.topics) ? group.topics : [];
          const topics = topicsRaw
            .map(topicRaw => (topicRaw && typeof topicRaw === 'object' ? ensureTopicFields(topicRaw as Record<string, unknown>) : null))
            .filter((topic): topic is Topic => topic !== null);

          return {
            id: normalizeLoadedText(group.id, '') || generateId() + '_' + groupIdx,
            name: normalizeLoadedText(group.name, 'Geral'),
            topics,
          };
        })
        .filter((group): group is TopicGroup => group !== null);

      const baseSubject = defaultSubjects[idx % defaultSubjects.length];

      // Normalize blocks within subject
      const blocksRaw = Array.isArray(subject.blocks) ? subject.blocks : [];
      const blocks: StudyBlock[] = blocksRaw
        .map((blockRaw, blockIdx) => {
          if (!blockRaw || typeof blockRaw !== 'object') return null;
          const block = blockRaw as Record<string, unknown>;
          const topicGroupIdsRaw = Array.isArray(block.topicGroupIds) ? block.topicGroupIds : [];
          const topicGroupIds: string[] = topicGroupIdsRaw
            .map(id => normalizeLoadedText(id, '').trim())
            .filter(id => id && topicGroups.some(g => g.id === id));

          const practiceTestsRaw = Array.isArray(block.practiceTests) ? block.practiceTests : [];
          const practiceTests: BlockPracticeTest[] = practiceTestsRaw
            .map((testRaw, testIdx) => {
              if (!testRaw || typeof testRaw !== 'object') return null;
              const test = testRaw as Record<string, unknown>;
              const dateCandidate = normalizeLoadedText(test.date, '').trim();
              const date = /^\d{4}-\d{2}-\d{2}$/.test(dateCandidate)
                ? dateCandidate
                : toDateOnlyString(new Date());
              const questionsTotal = clampInt(Number(test.questionsTotal ?? 0), 1, 5000);
              const correctAnswers = clampInt(Number(test.correctAnswers ?? 0), 0, questionsTotal);
              return {
                id: normalizeLoadedText(test.id, '') || `ptest_${generateId()}_${testIdx}`,
                date,
                questionsTotal,
                correctAnswers,
                notes: normalizeLoadedText(test.notes, ''),
              } satisfies BlockPracticeTest;
            })
            .filter((test): test is BlockPracticeTest => test !== null)
            .sort((a, b) => b.date.localeCompare(a.date));

          const cumulativeReviewsRaw = Array.isArray(block.cumulativeReviews) ? block.cumulativeReviews : [];
          const cumulativeReviews: BlockCumulativeReview[] = cumulativeReviewsRaw
            .map((reviewRaw, reviewIdx) => {
              if (!reviewRaw || typeof reviewRaw !== 'object') return null;
              const review = reviewRaw as Record<string, unknown>;
              const titleCandidate = normalizeLoadedText(review.title, '').replace(/\s+/g, ' ').trim();
              const goalText = normalizeLoadedText(review.goalText ?? review.goal, '').replace(/\s+/g, ' ').trim();
              return {
                id: normalizeLoadedText(review.id, '') || `crev_${generateId()}_${reviewIdx}`,
                title: titleCandidate || `Revisao ${reviewIdx + 1}`,
                questionsCount: clampInt(
                  Number(review.questionsCount ?? review.questionsTotal ?? review.questions ?? 0),
                  1,
                  5000,
                ),
                goalText,
                completed: !!review.completed,
              } satisfies BlockCumulativeReview;
            })
            .filter((review): review is BlockCumulativeReview => review !== null);

          return {
            id: normalizeLoadedText(block.id, '') || `block_${generateId()}_${blockIdx}`,
            name: normalizeLoadedText(block.name, `Bloco ${blockIdx + 1}`),
            description: normalizeLoadedText(block.description, ''),
            color: normalizeLoadedText(block.color, '#1565c0'),
            order: toNonNegativeInt(block.order, 999),
            topicGroupIds,
            practiceTests,
            cumulativeReviews,
          } satisfies StudyBlock;
        })
        .filter((block): block is StudyBlock => block !== null)
        .sort((a, b) => a.order - b.order);

      return {
        id: normalizeLoadedText(subject.id, '') || `subject_${generateId()}_${idx}`,
        name: normalizeLoadedText(subject.name, baseSubject?.name || 'Disciplina'),
        emoji: normalizeLoadedText(subject.emoji, baseSubject?.emoji || '\u{1F4DA}'),
        color: normalizeLoadedText(subject.color, baseSubject?.color || '#1565c0'),
        colorLight: normalizeLoadedText(subject.colorLight, baseSubject?.colorLight || '#e3f2fd'),
        description: normalizeLoadedText(subject.description, ''),
        topicGroups,
        blocks,
      } satisfies Subject;
    })
    .filter((subject): subject is Subject => subject !== null);

  const settingsRaw = (data.settings as Record<string, unknown> | undefined) ?? {};
  const normalizedSettings: StudyData['settings'] = {
    ...baseSettings,
    ...settingsRaw,
    fsrs: normalizeFSRSConfig(settingsRaw.fsrs ?? baseSettings.fsrs),
    schedule: ensureWeeklySchedule(settingsRaw.schedule ?? baseSettings.schedule),
    essayMonitor: ensureEssayMonitorSettings(settingsRaw.essayMonitor ?? baseSettings.essayMonitor),
    practiceTests: ensurePracticeTestsSettings(settingsRaw.practiceTests ?? baseSettings.practiceTests),
    goals: ensureGoals(settingsRaw.goals ?? baseSettings.goals),
  };

  if (normalizedSettings.practiceTests.tests.length === 0) {
    const migratedTests: PracticeTestEntry[] = [];
    for (const subject of normalizedSubjects) {
      for (const block of subject.blocks) {
        for (const test of block.practiceTests) {
          migratedTests.push({
            id: `practice_${subject.id}_${block.id}_${test.id}`,
            date: test.date,
            totalQuestions: test.questionsTotal,
            correctAnswers: test.correctAnswers,
            questionMarks: [],
            createdAt: new Date(test.date + 'T00:00:00').toISOString(),
            updatedAt: new Date(test.date + 'T00:00:00').toISOString(),
          });
        }
      }
    }
    if (migratedTests.length > 0) {
      normalizedSettings.practiceTests.tests = migratedTests
        .sort((a, b) => b.date.localeCompare(a.date));
    }
  }

  if (Array.isArray(data.blocks)) {
    // Legacy global blocks are ignored; blocks are stored per subject.
  }

  return {
    subjects: normalizedSubjects.length > 0 ? normalizedSubjects : fallbackSubjects,
    settings: normalizedSettings,
    lastUpdated: normalizeLoadedText(data.lastUpdated, new Date().toISOString()),
  };
}

export function loadData(): StudyData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return normalizeStudyData(JSON.parse(raw));
    }
  } catch {
    // ignore
  }

  return normalizeStudyData(null);
}

export function saveData(data: StudyData) {
  const payload: StudyData = {
    ...data,
    lastUpdated: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
}

export function createTopic(name: string, priority: Priority | null = null, deadline: string | null = null): Topic {
  return {
    id: generateId(),
    name,
    studied: false,
    questionsTotal: 0,
    questionsCorrect: 0,
    questionLogs: [],
    notes: '',
    tags: [],
    dateStudied: null,
    priority,
    deadline,
    fsrsDifficulty: 0,
    fsrsStability: 0,
    fsrsLastReview: null,
    fsrsNextReview: null,
    reviewHistory: [],
  };
}

export function createTopicGroup(name: string): TopicGroup {
  return {
    id: generateId(),
    name,
    topics: [],
  };
}

export function getAllTopics(subject: Subject): Topic[] {
  return subject.topicGroups.flatMap(g => g.topics);
}

export function getGroupStats(group: TopicGroup) {
  const total = group.topics.length;
  const studied = group.topics.filter(t => t.studied).length;
  const questionsTotal = group.topics.reduce((sum, t) => sum + t.questionsTotal, 0);
  const questionsCorrect = group.topics.reduce((sum, t) => sum + t.questionsCorrect, 0);
  const rendimento = questionsTotal > 0 ? questionsCorrect / questionsTotal : 0;
  const progresso = total > 0 ? studied / total : 0;
  const today = toDateOnlyString(new Date());
  const reviewsDue = group.topics.filter(t => {
    if (!t.studied) return false;
    if (!t.fsrsNextReview) return false;
    return t.fsrsNextReview <= today;
  }).length;
  return { total, studied, questionsTotal, questionsCorrect, rendimento, progresso, reviewsDue };
}

export function getSubjectStats(subject: Subject) {
  const topics = getAllTopics(subject);
  const total = topics.length;
  const studied = topics.filter(t => t.studied).length;
  const questionsTotal = topics.reduce((sum, t) => sum + t.questionsTotal, 0);
  const questionsCorrect = topics.reduce((sum, t) => sum + t.questionsCorrect, 0);
  const rendimento = questionsTotal > 0 ? questionsCorrect / questionsTotal : 0;
  const progresso = total > 0 ? studied / total : 0;
  const today = toDateOnlyString(new Date());
  const reviewsDue = topics.filter(t => {
    if (!t.studied) return false;
    if (!t.fsrsNextReview) return false;
    return t.fsrsNextReview <= today;
  }).length;
  return { total, studied, questionsTotal, questionsCorrect, rendimento, progresso, reviewsDue };
}

export function getOverallStats(subjects: Subject[]) {
  let totalTopics = 0;
  let studiedTopics = 0;
  let questionsTotal = 0;
  let questionsCorrect = 0;
  let reviewsDue = 0;

  for (const subject of subjects) {
    const stats = getSubjectStats(subject);
    totalTopics += stats.total;
    studiedTopics += stats.studied;
    questionsTotal += stats.questionsTotal;
    questionsCorrect += stats.questionsCorrect;
    reviewsDue += stats.reviewsDue;
  }

  const rendimento = questionsTotal > 0 ? questionsCorrect / questionsTotal : 0;
  const progresso = totalTopics > 0 ? studiedTopics / totalTopics : 0;

  return { totalTopics, studiedTopics, questionsTotal, questionsCorrect, rendimento, progresso, reviewsDue };
}

export interface DeadlineItem {
  subjectId: string;
  subjectName: string;
  subjectEmoji: string;
  subjectColor: string;
  groupName: string;
  topic: Topic;
}

export function getUpcomingDeadlines(subjects: Subject[]): DeadlineItem[] {
  const items: DeadlineItem[] = [];
  for (const subject of subjects) {
    for (const group of subject.topicGroups) {
      for (const topic of group.topics) {
        if (topic.deadline && !topic.studied) {
          items.push({
            subjectId: subject.id,
            subjectName: subject.name,
            subjectEmoji: subject.emoji,
            subjectColor: subject.color,
            groupName: group.name,
            topic,
          });
        }
      }
    }
  }
  items.sort((a, b) => a.topic.deadline!.localeCompare(b.topic.deadline!));
  return items;
}

export interface ReviewDueItem {
  subjectId: string;
  subjectName: string;
  subjectEmoji: string;
  subjectColor: string;
  groupId: string;
  groupName: string;
  topic: Topic;
  daysOverdue: number;
}

export function getReviewsDue(subjects: Subject[]): ReviewDueItem[] {
  const items: ReviewDueItem[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateOnlyString(today);

  for (const subject of subjects) {
    for (const group of subject.topicGroups) {
      for (const topic of group.topics) {
        if (!topic.studied) continue;
        if (!topic.fsrsNextReview) continue;
        if (topic.fsrsNextReview > todayStr) continue;

        const reviewDate = new Date(topic.fsrsNextReview + 'T00:00:00');
        const daysOverdue = Math.floor((today.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24));
        items.push({
          subjectId: subject.id,
          subjectName: subject.name,
          subjectEmoji: subject.emoji,
          subjectColor: subject.color,
          groupId: group.id,
          groupName: group.name,
          topic,
          daysOverdue,
        });
      }
    }
  }
  // Sort: most overdue first
  items.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return items;
}

export function getUpcomingReviews(subjects: Subject[], limit = 10): ReviewDueItem[] {
  const items: ReviewDueItem[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateOnlyString(today);

  for (const subject of subjects) {
    for (const group of subject.topicGroups) {
      for (const topic of group.topics) {
        if (!topic.studied) continue;
        if (!topic.fsrsNextReview) continue;
        if (topic.fsrsNextReview <= todayStr) continue;
        const reviewDate = new Date(topic.fsrsNextReview + 'T00:00:00');
        const daysUntil = Math.ceil((reviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        items.push({
          subjectId: subject.id,
          subjectName: subject.name,
          subjectEmoji: subject.emoji,
          subjectColor: subject.color,
          groupId: group.id,
          groupName: group.name,
          topic,
          daysOverdue: -daysUntil, // negative = future
        });
      }
    }
  }
  items.sort((a, b) => b.daysOverdue - a.daysOverdue); // closest first (least negative)
  return items.slice(0, limit);
}

export function getPriorityStats(subjects: Subject[]) {
  let alta = 0;
  let media = 0;
  let baixa = 0;
  let sem = 0;

  for (const subject of subjects) {
    for (const topic of getAllTopics(subject)) {
      if (topic.studied) continue;
      if (topic.priority === 'alta') alta++;
      else if (topic.priority === 'media') media++;
      else if (topic.priority === 'baixa') baixa++;
      else sem++;
    }
  }

  return { alta, media, baixa, sem, total: alta + media + baixa + sem };
}

export function getDeadlineInfo(deadline: string | null): { text: string; className: string; urgency: 'overdue' | 'today' | 'soon' | 'normal' | 'none' } | null {
  if (!deadline) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const nowStr = toDateOnlyString(now);
  if (deadline === nowStr) return { text: 'Hoje!', className: 'text-orange-700 bg-orange-100', urgency: 'today' };
  if (deadline < nowStr) {
    const deadlineDate = new Date(deadline + 'T00:00:00');
    const diffPast = Math.floor((now.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24));
    return { text: `Atrasado (${Math.max(1, diffPast)}d)`, className: 'text-red-700 bg-red-100', urgency: 'overdue' };
  }
  const deadlineDate = new Date(deadline + 'T00:00:00');
  const diff = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 1) return { text: 'Amanhã', className: 'text-amber-700 bg-amber-100', urgency: 'soon' };
  if (diff <= 3) return { text: `${diff} dias`, className: 'text-yellow-700 bg-yellow-100', urgency: 'soon' };
  if (diff <= 7) return { text: `${diff} dias`, className: 'text-blue-700 bg-blue-100', urgency: 'normal' };
  return { text: `${diff} dias`, className: 'text-gray-600 bg-gray-100', urgency: 'normal' };
}

export function parseStructuredImport(text: string): { name: string; topics: string[] }[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const groups: { name: string; topics: string[] }[] = [];
  let currentGroup: { name: string; topics: string[] } | null = null;

  for (const line of lines) {
    if (line.startsWith('#')) {
      const name = line.replace(/^#+\s*/, '').trim();
      if (name) {
        currentGroup = { name, topics: [] };
        groups.push(currentGroup);
      }
    } else if (currentGroup) {
      currentGroup.topics.push(line);
    } else {
      currentGroup = { name: 'Geral', topics: [line] };
      groups.push(currentGroup);
    }
  }

  return groups;
}

export const PRIORITY_CONFIG = {
  alta: { label: 'Alta', emoji: '\u{1F534}', color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-200', ring: 'ring-red-400' },
  media: { label: 'Média', emoji: '\u{1F7E1}', color: 'text-yellow-700', bg: 'bg-yellow-100', border: 'border-yellow-200', ring: 'ring-yellow-400' },
  baixa: { label: 'Baixa', emoji: '\u{1F7E2}', color: 'text-green-700', bg: 'bg-green-100', border: 'border-green-200', ring: 'ring-green-400' },
} as const;

// ---- Block / Phase helpers ----

const BLOCK_COLOR_PALETTE = [
  '#1565c0', '#2e7d32', '#e65100', '#6a1b9a',
  '#00695c', '#c62828', '#283593', '#37474f',
  '#00838f', '#ef6c00',
] as const;

export function createBlock(name: string, order: number): StudyBlock {
  return {
    id: `block_${generateId()}`,
    name,
    description: '',
    color: BLOCK_COLOR_PALETTE[order % BLOCK_COLOR_PALETTE.length],
    order,
    topicGroupIds: [],
    practiceTests: [],
    cumulativeReviews: [],
  };
}

export function getBlockTopicGroups(
  block: StudyBlock,
  subject: Subject,
): TopicGroup[] {
  return block.topicGroupIds
    .map(id => subject.topicGroups.find(g => g.id === id))
    .filter((g): g is TopicGroup => g !== undefined);
}

export function getBlockStats(block: StudyBlock, subject: Subject) {
  const groups = getBlockTopicGroups(block, subject);
  const topics = groups.flatMap(g => g.topics);
  const total = topics.length;
  const studied = topics.filter(t => t.studied).length;
  const questionsTotal = topics.reduce((sum, t) => sum + t.questionsTotal, 0);
  const questionsCorrect = topics.reduce((sum, t) => sum + t.questionsCorrect, 0);
  const rendimento = questionsTotal > 0 ? questionsCorrect / questionsTotal : 0;
  const progresso = total > 0 ? studied / total : 0;
  const today = toDateOnlyString(new Date());
  const reviewsDue = topics.filter(t => {
    if (!t.studied) return false;
    if (!t.fsrsNextReview) return false;
    return t.fsrsNextReview <= today;
  }).length;
  return { total, studied, questionsTotal, questionsCorrect, rendimento, progresso, reviewsDue, groupCount: groups.length };
}

export function getUnassignedTopicGroups(subject: Subject): TopicGroup[] {
  const assignedIds = new Set(subject.blocks.flatMap(b => b.topicGroupIds));
  return subject.topicGroups.filter(g => !assignedIds.has(g.id));
}
