import { StudyData, Subject, Topic, TopicGroup, Priority, ReviewEntry } from './types';
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

const defaultSubjects: Omit<Subject, 'topicGroups'>[] = [
  { id: 'matematica', name: 'Matematica', emoji: '\u{1F4D0}', color: '#1565c0', colorLight: '#e3f2fd' },
  { id: 'biologia', name: 'Biologia', emoji: '\u{1F9EC}', color: '#2e7d32', colorLight: '#e8f5e9' },
  { id: 'fisica', name: 'Fisica', emoji: '\u26A1', color: '#e65100', colorLight: '#fff3e0' },
  { id: 'quimica', name: 'Quimica', emoji: '\u{1F9EA}', color: '#6a1b9a', colorLight: '#f3e5f5' },
  { id: 'historia', name: 'Historia', emoji: '\u{1F4DC}', color: '#5d4037', colorLight: '#efebe9' },
  { id: 'geografia', name: 'Geografia', emoji: '\u{1F30D}', color: '#00695c', colorLight: '#e0f2f1' },
  { id: 'filosofia_sociologia', name: 'Filosofia/Sociologia', emoji: '\u{1F9E0}', color: '#6a1b9a', colorLight: '#f3e5f5' },
];

function getDefaultSettings(): StudyData['settings'] {
  return {
    fsrs: normalizeFSRSConfig(DEFAULT_FSRS_CONFIG),
  };
}

function ensureTopicFields(t: Record<string, unknown>): Topic {
  return {
    id: (t.id as string) || generateId(),
    name: normalizeLoadedText(t.name, ''),
    studied: !!(t.studied),
    questionsTotal: (t.questionsTotal as number) || 0,
    questionsCorrect: (t.questionsCorrect as number) || 0,
    notes: normalizeLoadedText(t.notes, ''),
    dateStudied: (t.dateStudied as string) || null,
    priority: (t.priority as Priority) || null,
    deadline: (t.deadline as string) || null,
    // FSRS fields
    fsrsDifficulty: (t.fsrsDifficulty as number) || 0,
    fsrsStability: (t.fsrsStability as number) || 0,
    fsrsLastReview: (t.fsrsLastReview as string) || null,
    fsrsNextReview: (t.fsrsNextReview as string) || null,
    reviewHistory: ((t.reviewHistory as ReviewEntry[]) || []).map(entry => ({
      ...entry,
      ratingLabel: normalizeLoadedText(entry.ratingLabel, ''),
    })),
  };
}

export function loadData(): StudyData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);

      for (const subject of data.subjects) {
        subject.name = normalizeLoadedText(subject.name, subject.name || '');
        subject.emoji = normalizeLoadedText(subject.emoji, subject.emoji || '');

        // Migration: old format had topics[] directly on subject
        if (subject.topics && !subject.topicGroups) {
          subject.topicGroups = [];
          if (subject.topics.length > 0) {
            subject.topicGroups.push({
              id: generateId(),
              name: 'Geral',
              topics: subject.topics.map((t: Record<string, unknown>) => ensureTopicFields(t)),
            });
          }
          delete subject.topics;
        }

        // Ensure existing topic groups have proper topic fields
        if (subject.topicGroups) {
          for (const group of subject.topicGroups) {
            group.name = normalizeLoadedText(group.name, group.name || '');
            group.topics = group.topics.map((t: Record<string, unknown>) => ensureTopicFields(t));
          }
        } else {
          subject.topicGroups = [];
        }
      }

      // Ensure all default subjects exist
      for (const def of defaultSubjects) {
        if (!data.subjects.find((s: Subject) => s.id === def.id)) {
          data.subjects.push({ ...def, topicGroups: [] });
        }
      }

      const baseSettings = getDefaultSettings();
      data.settings = {
        ...baseSettings,
        ...(data.settings || {}),
        fsrs: normalizeFSRSConfig(data.settings?.fsrs ?? baseSettings.fsrs),
      };

      return data as StudyData;
    }
  } catch {
    // ignore
  }

  return {
    subjects: defaultSubjects.map(s => ({ ...s, topicGroups: [] })),
    settings: getDefaultSettings(),
    lastUpdated: new Date().toISOString(),
  };
}

export function saveData(data: StudyData) {
  data.lastUpdated = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function createTopic(name: string, priority: Priority | null = null, deadline: string | null = null): Topic {
  return {
    id: generateId(),
    name,
    studied: false,
    questionsTotal: 0,
    questionsCorrect: 0,
    notes: '',
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
  const reviewsDue = group.topics.filter(t => {
    if (!t.fsrsNextReview) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(t.fsrsNextReview + 'T00:00:00') <= today;
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
  const reviewsDue = topics.filter(t => {
    if (!t.fsrsNextReview) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(t.fsrsNextReview + 'T00:00:00') <= today;
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
  items.sort((a, b) => (a.topic.deadline! > b.topic.deadline! ? 1 : -1));
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

  for (const subject of subjects) {
    for (const group of subject.topicGroups) {
      for (const topic of group.topics) {
        if (topic.fsrsNextReview) {
          const reviewDate = new Date(topic.fsrsNextReview + 'T00:00:00');
          if (reviewDate <= today) {
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

  for (const subject of subjects) {
    for (const group of subject.topicGroups) {
      for (const topic of group.topics) {
        if (topic.fsrsNextReview) {
          const reviewDate = new Date(topic.fsrsNextReview + 'T00:00:00');
          if (reviewDate > today) {
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
  const deadlineDate = new Date(deadline + 'T00:00:00');
  const diff = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return { text: `Atrasado (${Math.abs(diff)}d)`, className: 'text-red-700 bg-red-100', urgency: 'overdue' };
  if (diff === 0) return { text: 'Hoje!', className: 'text-orange-700 bg-orange-100', urgency: 'today' };
  if (diff === 1) return { text: 'Amanha', className: 'text-amber-700 bg-amber-100', urgency: 'soon' };
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
  media: { label: 'Media', emoji: '\u{1F7E1}', color: 'text-yellow-700', bg: 'bg-yellow-100', border: 'border-yellow-200', ring: 'ring-yellow-400' },
  baixa: { label: 'Baixa', emoji: '\u{1F7E2}', color: 'text-green-700', bg: 'bg-green-100', border: 'border-green-200', ring: 'ring-green-400' },
} as const;

