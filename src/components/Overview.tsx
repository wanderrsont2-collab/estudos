import { useState } from 'react';
import { Flame, Target, TrendingUp } from 'lucide-react';
import { Subject, WeeklySchedule, EssayEntry, StudyGoals } from '../types';
import { ScheduleWidget } from './ScheduleWidget';
import { OverviewHeader } from './overview/OverviewHeader';
import { QuickActions } from './overview/QuickActions';
import { OverviewTabBar } from './overview/OverviewTabBar';
import { ConsistencySection } from './overview/ConsistencySection';
import { InsightsSection } from './overview/InsightsSection';
import { AlertsSection } from './overview/AlertsSection';
import { SubjectsPerformance } from './overview/SubjectsPerformance';
import { PrioritiesPanel } from './overview/PrioritiesPanel';
import { WeeklyReviewCalendar } from './overview/WeeklyReviewCalendar';
import type { OverviewTab } from './overview/types';
import { useOverviewModel } from './overview/useOverviewModel';

interface OverviewProps {
  subjects: Subject[];
  schedule: WeeklySchedule;
  goals: StudyGoals;
  essays: EssayEntry[];
  onUpdateSchedule: (schedule: WeeklySchedule) => void;
  onUpdateGoals: (goals: StudyGoals) => void;
  onSelectSubject: (id: string) => void;
  onOpenReviews: () => void;
}

export function Overview({ subjects, schedule, goals, essays, onUpdateSchedule, onUpdateGoals, onSelectSubject, onOpenReviews }: OverviewProps) {
  const [activeTab, setActiveTab] = useState<OverviewTab>('consistency');

  const model = useOverviewModel({
    subjects,
    essays,
    goals,
    onUpdateGoals,
  });

  return (
    <div className="space-y-5 pb-20 lg:pb-6">
      <OverviewHeader
        todayLabel={model.todayLabel}
        overall={model.overall}
        streakCurrent={model.streakInfo.current}
        todayStudyMinutes={model.todayStudyMinutes}
        weeklyStudyMinutes={model.weeklyStudyMinutes}
        onExportReport={model.exportReport}
        onOpenReviews={onOpenReviews}
        completionEstimate={model.completionEstimate}
      />

      <QuickActions
        todayQuestionsMade={model.todayActivity.questionsMade}
        dailyQuestionsTarget={goals.dailyQuestionsTarget}
        reviewsDueCount={model.reviewsDue.length}
        overdueDeadlinesCount={model.overdueDeadlines.length}
        todayStudyMinutes={model.todayStudyMinutes}
        weeklyQuestionsMade={model.weeklyQuestionsMade}
        weeklyQuestionsDelta={model.weekComparison.questionsDelta}
        onOpenReviews={onOpenReviews}
      />

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_1.4fr] gap-5">
        <div>
          <OverviewTabBar
            tabs={[
              { id: 'consistency', label: 'Consistencia', icon: Flame },
              { id: 'subjects', label: 'Disciplinas', icon: TrendingUp },
              { id: 'priorities', label: 'Prioridades', icon: Target },
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />

          <div className="mt-3">
            {activeTab === 'consistency' ? (
              <div className="space-y-3">
                <ConsistencySection
                  mode={model.consistencyPanelMode}
                  onModeChange={model.setConsistencyPanelMode}
                  weeklyQuestionsMade={model.weeklyQuestionsMade}
                  todayStudyMinutes={model.todayStudyMinutes}
                  todayQuestionsMade={model.todayActivity.questionsMade}
                  goals={goals}
                  onDailyTargetChange={value => model.updateGoal('dailyQuestionsTarget', value)}
                  onWeeklyReviewTargetChange={value => model.updateGoal('weeklyReviewTarget', value)}
                  onWeeklyEssayTargetChange={value => model.updateGoal('weeklyEssayTarget', value)}
                  heatmapDays={model.heatmapDays}
                  streakCurrent={model.streakInfo.current}
                  streakLongest={model.streakInfo.longest}
                  streakActiveDays={model.streakInfo.activeDays}
                  evolutionTrend={model.evolutionTrend}
                  last14Total={model.last14Total}
                  last14Correct={model.last14Correct}
                  evolutionDays={model.evolutionDays}
                  evolutionMax={model.evolutionMax}
                  weekComparison={model.weekComparison}
                  accuracyDeltaPp={model.accuracyDeltaPp}
                  subjects={subjects}
                  onSessionEnd={model.handleSessionEnd}
                  weeklyStudyMinutes={model.weeklyStudyMinutes}
                  weeklyReviews={model.weeklyReviews}
                  weeklyEssays={model.weeklyEssays}
                />

                <InsightsSection
                  weakSubjects={model.weakSubjects}
                  neglectedSubjects={model.neglectedSubjects}
                  onSelectSubject={onSelectSubject}
                />
              </div>
            ) : null}

            {activeTab === 'subjects' ? (
              <SubjectsPerformance
                subjectsCount={subjects.length}
                sortedSubjects={model.sortedSubjects}
                onSelectSubject={onSelectSubject}
              />
            ) : null}

            {activeTab === 'priorities' ? (
              <div className="space-y-4">
                <PrioritiesPanel
                  priorityStats={model.priorityStats}
                  upcomingDeadlines={model.upcomingDeadlines}
                  onSelectSubject={onSelectSubject}
                />

                <AlertsSection
                  overdueDeadlines={model.overdueDeadlines}
                  reviewsDue={model.reviewsDue}
                  onSelectSubject={onSelectSubject}
                  onOpenReviews={onOpenReviews}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <ScheduleWidget subjects={subjects} schedule={schedule} onUpdateSchedule={onUpdateSchedule} />
          <WeeklyReviewCalendar
            weeklyReviewCalendar={model.weeklyReviewCalendar}
            onSelectSubject={onSelectSubject}
            onOpenReviews={onOpenReviews}
          />
        </div>
      </section>
    </div>
  );
}
