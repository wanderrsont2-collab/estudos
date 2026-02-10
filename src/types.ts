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

export interface StudyData {
  subjects: Subject[];
  settings: {
    fsrs: FSRSConfig;
  };
  lastUpdated: string;
}
