import type { DeadlineItem, ReviewDueItem } from '../../store';

export interface ActivityDay {
  date: string;
  questionsMade: number;
  questionsCorrect: number;
  total: number;
}

export interface UpcomingReviewItem {
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectEmoji: string;
  groupName: string;
  nextReview: string;
}

export interface WeeklyReviewDay {
  label: string;
  isoDate: string;
  items: UpcomingReviewItem[];
}

export type ConsistencyPanelMode = 'radial' | 'heatmap' | 'both' | 'evolution';
export type OverviewTab = 'consistency' | 'subjects' | 'priorities';
export type HeatmapDay = { date: string; count: number };

export type CompletionEstimate =
  | {
      type: 'estimate';
      daysRemaining: number;
      topicsPerDay: string;
      remaining: number;
      estimatedDate: Date;
    }
  | {
      type: 'complete';
    }
  | null;

export interface SubjectStatsView {
  studied: number;
  total: number;
  questionsCorrect: number;
  questionsTotal: number;
  progresso: number;
  rendimento: number;
}

export interface WeekComparisonData {
  thisWeek: { total: number; correct: number };
  lastWeek: { total: number; correct: number };
  questionsDelta: number;
  accuracyThis: number;
  accuracyLast: number;
}

export type DeadlineInfoView = {
  text: string;
  className: string;
  urgency: 'none' | 'normal' | 'overdue' | 'today' | 'soon';
};

export interface DeadlineDisplayItem extends DeadlineItem {
  subjectId: string | null;
  deadlineInfo: DeadlineInfoView;
}

export type ReviewDueDisplayItem = ReviewDueItem;
