import type { FSRSConfig, FSRSRating, FSRSVersion } from './fsrs';

export type Priority = 'alta' | 'media' | 'baixa';

export interface ReviewEntry {
  id: string;
  reviewNumber: number;
  date: string;           // YYYY-MM-DD
  rating: FSRSRating;
  ratingLabel: string;
  difficultyBefore: number;
  difficultyAfter: number;
  stabilityBefore: number;
  stabilityAfter: number;
  intervalDays: number;
  retrievability: number | null;
  performanceScore: number | null; // questions accuracy at time of review
  questionsTotal: number;
  questionsCorrect: number;
  algorithmVersion?: FSRSVersion;
  requestedRetention?: number;
  usedCustomWeights?: boolean;
}

export interface Topic {
  id: string;
  name: string;
  studied: boolean;
  questionsTotal: number;
  questionsCorrect: number;
  notes: string;
  dateStudied: string | null;
  priority: Priority | null;
  deadline: string | null; // YYYY-MM-DD format
  // FSRS fields
  fsrsDifficulty: number;
  fsrsStability: number;
  fsrsLastReview: string | null;  // YYYY-MM-DD
  fsrsNextReview: string | null;  // YYYY-MM-DD
  reviewHistory: ReviewEntry[];
}

export interface TopicGroup {
  id: string;
  name: string;
  topics: Topic[];
}

export interface Subject {
  id: string;
  name: string;
  emoji: string;
  color: string;
  colorLight: string;
  topicGroups: TopicGroup[];
}

export interface ScheduleRow {
  id: string;
  timeLabel: string;
  cells: string[];
}

export interface WeeklySchedule {
  columns: string[];
  rows: ScheduleRow[];
}

export interface EssayEntry {
  id: string;
  theme: string;
  date: string; // YYYY-MM-DD
  c1: number; // 0-200
  c2: number; // 0-200
  c3: number; // 0-200
  c4: number; // 0-200
  c5: number; // 0-200
  totalScore: number; // 0-1000
  content: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface EssayMonitorSettings {
  essays: EssayEntry[];
  timerDurationMinutes: 60 | 90;
}

export interface StudyData {
  subjects: Subject[];
  settings: {
    fsrs: FSRSConfig;
    schedule: WeeklySchedule;
    essayMonitor: EssayMonitorSettings;
  };
  lastUpdated: string;
}
