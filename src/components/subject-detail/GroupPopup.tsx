import { useEffect, useRef } from 'react';
import { BookOpen, Check, ChevronRight, Clock, Target, TrendingUp, X } from 'lucide-react';
import type { Topic, TopicGroup } from '../../types';
import { cn } from '../../utils/cn';
import { isReviewDue, StudiedToggleButton } from './shared';

interface GroupPopupProps {
  group: TopicGroup;
  visibleTopics: Topic[];
  subjectColor: string;
  onClose: () => void;
  onOpenTopic: (groupId: string, topicId: string) => void;
  onSetTopicStudied: (groupId: string, topicId: string, studied: boolean) => void;
}

export function GroupPopup({
  group,
  visibleTopics,
  subjectColor,
  onClose,
  onOpenTopic,
  onSetTopicStudied,
}: GroupPopupProps) {
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    function handleClickOutside(event: MouseEvent) {
      if (!popupRef.current) return;
      if (!popupRef.current.contains(event.target as Node)) onClose();
    }

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const studiedCount = group.topics.filter(topic => topic.studied).length;
  const pendingCount = group.topics.length - studiedCount;
  const progress = group.topics.length > 0 ? studiedCount / group.topics.length : 0;
  const dueReviews = group.topics.filter(topic => topic.studied && isReviewDue(topic.fsrsNextReview)).length;
  const totalQuestions = group.topics.reduce((sum, topic) => sum + topic.questionsTotal, 0);
  const correctQuestions = group.topics.reduce((sum, topic) => sum + topic.questionsCorrect, 0);
  const accuracy = totalQuestions > 0 ? correctQuestions / totalQuestions : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        ref={popupRef}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-2xl backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/85"
      >
        <div className="relative px-6 py-5" style={{ backgroundColor: `${subjectColor}10` }}>
          <div className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: subjectColor }} />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-white">
                {"\u{1F4C1}"} {group.name}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {visibleTopics.length} de {group.topics.length} assuntos
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">Progresso</span>
            <span className="font-semibold text-slate-900 dark:text-white">{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress * 100}%`, backgroundColor: subjectColor }}
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-px bg-slate-100 dark:bg-slate-800">
          {[
            { icon: Check, label: 'Estudados', value: studiedCount, className: 'text-emerald-600' },
            { icon: Clock, label: 'Pendentes', value: pendingCount, className: 'text-amber-600' },
            { icon: Target, label: 'Revisoes', value: dueReviews, className: 'text-purple-600' },
            { icon: TrendingUp, label: 'Acuracia', value: `${Math.round(accuracy * 100)}%`, className: 'text-blue-600' },
          ].map(stat => (
            <div key={stat.label} className="flex flex-col items-center justify-center bg-white py-4 dark:bg-slate-900">
              <stat.icon className={cn('mb-1 h-4 w-4', stat.className)} />
              <span className="text-lg font-semibold text-slate-900 dark:text-white">{stat.value}</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{stat.label}</span>
            </div>
          ))}
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {visibleTopics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500">
              <BookOpen className="mb-2 h-8 w-8" />
              <p className="text-sm">Nenhum assunto para mostrar neste filtro</p>
            </div>
          ) : (
            <div className="space-y-1">
              {visibleTopics.slice(0, 10).map(topic => {
                const due = topic.studied && isReviewDue(topic.fsrsNextReview);
                return (
                  <div
                    key={`group-popup-topic-${topic.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenTopic(group.id, topic.id)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onOpenTopic(group.id, topic.id);
                      }
                    }}
                    className={cn(
                      'w-full rounded-xl px-3 py-2.5 text-left transition-colors flex items-center gap-3 cursor-pointer',
                      'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                      due && 'bg-purple-50/50 dark:bg-purple-900/10',
                    )}
                    title="Abrir topico"
                  >
                    <StudiedToggleButton
                      studied={topic.studied}
                      onToggle={() => {
                        const nextStudied = !topic.studied;
                        onSetTopicStudied(group.id, topic.id, nextStudied);
                        if (nextStudied) {
                          onOpenTopic(group.id, topic.id);
                        }
                      }}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        'truncate text-sm',
                        topic.studied
                          ? 'text-slate-400 line-through dark:text-slate-500'
                          : 'text-slate-700 dark:text-slate-200',
                      )}>
                        {topic.name}
                      </p>
                      {topic.tags.length > 0 && (
                        <div className="mt-0.5 flex items-center gap-1">
                          {topic.tags.slice(0, 2).map(tag => (
                            <span key={`${topic.id}-tag-${tag}`} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              #{tag}
                            </span>
                          ))}
                          {topic.tags.length > 2 && (
                            <span className="text-[10px] text-slate-400">+{topic.tags.length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>
                    {due && (
                      <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:bg-purple-900/30 dark:text-purple-300">
                        Revisao
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                  </div>
                );
              })}
              {visibleTopics.length > 10 && (
                <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">
                  +{visibleTopics.length - 10} assuntos
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
