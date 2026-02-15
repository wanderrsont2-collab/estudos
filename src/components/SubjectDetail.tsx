import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowLeft, BookOpen, Brain, CheckCircle2, Clock3, Edit3, FolderPlus, HelpCircle, Save, SlidersHorizontal, TrendingUp, X } from 'lucide-react';
import { Subject, Topic, TopicGroup, Priority, type ReviewEntry } from '../types';
import {
  createTopic, createTopicGroup, getSubjectStats, generateId,
  getDeadlineInfo, parseStructuredImport, getAllTopics,
} from '../store';
import {
  fsrsReview,
  RATING_OPTIONS,
  generateReviewId,
  normalizeFSRSConfig,
  type FSRSConfig,
  type FSRSRating,
} from '../fsrs';
import {
  COMMON_TAG_PRESETS,
  formatPercent,
  getRingColorStyle,
  isReviewDue,
  toDateOnlyString,
} from './subject-detail/shared';
import { TopicStudyModal } from './subject-detail/TopicStudyModal';
import { SubjectFilters, type SortOption } from './subject-detail/SubjectFilters';
import { SubjectBulkActions } from './subject-detail/SubjectBulkActions';
import { SubjectAddTopicGroup } from './subject-detail/SubjectAddTopicGroup';
import { SubjectTopicGroups } from './subject-detail/SubjectTopicGroups';
import { useSubjectDetailPersistence } from './subject-detail/hooks/useSubjectDetailPersistence';
import { useSubjectDetailState } from './subject-detail/hooks/useSubjectDetailState';

interface SubjectDetailProps {
  subject: Subject;
  globalTagSuggestions: string[];
  fsrsConfig: FSRSConfig;
  onBack: () => void;
  onUpdate: (subject: Subject) => void;
  focusTopicId?: string | null;
  onConsumeFocusTopic?: () => void;
}

type ControlsSection = 'filters' | 'add' | 'bulk';

function toRgbChannels(hexColor: string): [number, number, number] | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor.trim());
  if (!match) return null;
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

function getSubjectHeroStyle(subjectColor: string): CSSProperties {
  const rgb = toRgbChannels(subjectColor);
  if (!rgb) return { backgroundColor: subjectColor };
  const [r, g, b] = rgb;
  return {
    backgroundColor: subjectColor,
    backgroundImage: [
      'radial-gradient(125% 110% at 8% -25%, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0) 54%)',
      `radial-gradient(120% 110% at 96% 130%, rgba(${r}, ${g}, ${b}, 0.2), rgba(15, 23, 42, 0) 56%)`,
      `linear-gradient(135deg, rgba(${r}, ${g}, ${b}, 0.98) 0%, rgba(${r}, ${g}, ${b}, 0.86) 60%, rgba(15, 23, 42, 0.42) 118%)`,
    ].join(', '),
  };
}


export function SubjectDetail({
  subject,
  globalTagSuggestions,
  fsrsConfig,
  onBack,
  onUpdate,
  focusTopicId = null,
  onConsumeFocusTopic,
}: SubjectDetailProps) {
  const {
    newGroupName,
    setNewGroupName,
    collapsedGroups,
    setCollapsedGroups,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    tagFilter,
    setTagFilter,
    viewMode,
    setViewMode,
    editingGroupId,
    setEditingGroupId,
    editGroupName,
    setEditGroupName,
    editingTopicId,
    setEditingTopicId,
    editTopicName,
    setEditTopicName,
    deleteConfirm,
    setDeleteConfirm,
    showStructuredImport,
    setShowStructuredImport,
    structuredImportText,
    setStructuredImportText,
    newTopicInputs,
    setNewTopicInputs,
    showBulkAdd,
    setShowBulkAdd,
    bulkInputs,
    setBulkInputs,
    priorityMenuTopic,
    setPriorityMenuTopic,
    expandedTopics,
    setExpandedTopics,
    studyPopup,
    setStudyPopup,
    tagInputs,
    setTagInputs,
    selectedTopicIds,
    setSelectedTopicIds,
    selectionMode,
    setSelectionMode,
    bulkActionKind,
    setBulkActionKind,
    bulkStudiedValue,
    setBulkStudiedValue,
    bulkPriorityValue,
    setBulkPriorityValue,
    bulkTagDraft,
    setBulkTagDraft,
    bulkReviewRating,
    setBulkReviewRating,
    highlightTopicId,
    setHighlightTopicId,
    focusHandledRef,
    collapsedSubjectIdRef,
    isEditingDescription,
    setIsEditingDescription,
    descriptionDraft,
    setDescriptionDraft,
    subjectRef,
    onUpdateRef,
    editTopicNameRef,
    saveDescription,
    cancelDescriptionEdit,
  } = useSubjectDetailState({ subject, onUpdate });

  const stats = getSubjectStats(subject);
  const allTopics = getAllTopics(subject);
  const allAvailableTags = useMemo(() => {
    const unique = new Set<string>();
    for (const topic of allTopics) {
      for (const tag of topic.tags ?? []) {
        unique.add(tag);
      }
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [allTopics]);
  const tagSuggestionCatalog = useMemo(() => {
    const unique = new Set<string>(COMMON_TAG_PRESETS);
    for (const tag of globalTagSuggestions) unique.add(tag);
    for (const tag of allAvailableTags) unique.add(tag);
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [allAvailableTags, globalTagSuggestions]);
  const tagSuggestionListId = `subject-tag-suggestions-${subject.id}`;
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [controlsSection, setControlsSection] = useState<ControlsSection>(() => (
    allTopics.length === 0 ? 'add' : 'filters'
  ));

  const updateTopicGroups = useCallback((updater: (groups: TopicGroup[]) => TopicGroup[]) => {
    const currentSubject = subjectRef.current;
    const nextSubject = {
      ...currentSubject,
      topicGroups: updater(currentSubject.topicGroups),
    };
    subjectRef.current = nextSubject;
    onUpdateRef.current(nextSubject);
  }, []);

  // ---- Group CRUD ----
  const addGroup = useCallback(() => {
    const name = newGroupName.trim();
    if (!name) return;
    updateTopicGroups(groups => [...groups, createTopicGroup(name)]);
    setNewGroupName('');
  }, [newGroupName, updateTopicGroups]);

  const removeGroup = useCallback((groupId: string) => {
    updateTopicGroups(groups => groups.filter(g => g.id !== groupId));
    setDeleteConfirm(null);
  }, [updateTopicGroups]);

  const saveGroupEdit = useCallback((groupId: string) => {
    const name = editGroupName.trim();
    setEditingGroupId(null);
    if (!name) return;
    updateTopicGroups(groups =>
      groups.map(g => (g.id === groupId ? { ...g, name } : g))
    );
  }, [editGroupName, updateTopicGroups]);

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      window.localStorage.setItem(
        `subject_collapsed_groups_${subject.id}`,
        JSON.stringify(Array.from(next)),
      );
      return next;
    });
  }, [subject.id]);

  const collapseAllGroups = useCallback(() => {
    const next = new Set(subjectRef.current.topicGroups.map(group => group.id));
    window.localStorage.setItem(
      `subject_collapsed_groups_${subjectRef.current.id}`,
      JSON.stringify(Array.from(next)),
    );
    setCollapsedGroups(next);
  }, []);

  const expandAllGroups = useCallback(() => {
    const next = new Set<string>();
    window.localStorage.setItem(
      `subject_collapsed_groups_${subjectRef.current.id}`,
      JSON.stringify(Array.from(next)),
    );
    setCollapsedGroups(next);
  }, []);

  // ---- Topic CRUD ----
  const addTopicToGroup = useCallback((groupId: string) => {
    const name = (newTopicInputs[groupId] || '').trim();
    if (!name) return;
    updateTopicGroups(groups =>
      groups.map(g => (g.id === groupId ? { ...g, topics: [...g.topics, createTopic(name)] } : g))
    );
    setNewTopicInputs(prev => ({ ...prev, [groupId]: '' }));
  }, [newTopicInputs, updateTopicGroups]);

  const addBulkTopicsToGroup = useCallback((groupId: string) => {
    const lines = Array.from(
      new Set((bulkInputs[groupId] || '').split('\n').map(l => l.trim()).filter(Boolean))
    );
    if (lines.length === 0) return;
    const newTopics = lines.map(name => createTopic(name));
    updateTopicGroups(groups =>
      groups.map(g => (g.id === groupId ? { ...g, topics: [...g.topics, ...newTopics] } : g))
    );
    setBulkInputs(prev => ({ ...prev, [groupId]: '' }));
    setShowBulkAdd(null);
  }, [bulkInputs, updateTopicGroups]);

  const removeTopic = useCallback((groupId: string, topicId: string) => {
    updateTopicGroups(groups =>
      groups.map(g => (g.id === groupId ? { ...g, topics: g.topics.filter(t => t.id !== topicId) } : g))
    );
    setDeleteConfirm(null);
  }, [updateTopicGroups]);

  const updateTopicInGroup = useCallback((groupId: string, topicId: string, changes: Partial<Topic>) => {
    updateTopicGroups(groups =>
      groups.map(g =>
        g.id === groupId
          ? { ...g, topics: g.topics.map(t => (t.id === topicId ? { ...t, ...changes } : t)) }
          : g
      )
    );
  }, [updateTopicGroups]);

  const findTopic = useCallback((groupId: string, topicId: string): Topic | null => {
    const group = subjectRef.current.topicGroups.find(g => g.id === groupId);
    const topic = group?.topics.find(t => t.id === topicId);
    return topic ?? null;
  }, []);

  const setTopicStudied = useCallback((groupId: string, topicId: string, studied: boolean) => {
    const topic = findTopic(groupId, topicId);
    if (!topic) return;
    updateTopicInGroup(groupId, topicId, {
      studied,
      dateStudied: studied ? topic.dateStudied ?? new Date().toISOString() : null,
    });
  }, [findTopic, updateTopicInGroup]);

  const openStudyPopup = useCallback((groupId: string, topicId: string) => {
    setStudyPopup({ groupId, topicId });
  }, []);

  const toggleTopicExpanded = useCallback((topicId: string) => {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  }, []);

  const runTopicReview = useCallback((groupId: string, topicId: string, rating: FSRSRating) => {
    const topic = findTopic(groupId, topicId);
    if (!topic) return;
    const today = toDateOnlyString(new Date());
    const lastReview = topic.reviewHistory[topic.reviewHistory.length - 1];
    if (lastReview && lastReview.date === today && lastReview.rating === rating) {
      return;
    }

    const normalizedFsrsConfig = normalizeFSRSConfig(fsrsConfig);
    const currentState = {
      difficulty: topic.fsrsDifficulty,
      stability: topic.fsrsStability,
      lastReview: topic.fsrsLastReview,
      nextReview: topic.fsrsNextReview,
    };

    const { newState, intervalDays, scheduledDays, retrievability } = fsrsReview(currentState, rating, normalizedFsrsConfig);
    const ratingOption = RATING_OPTIONS.find(option => option.value === rating);

    if (!ratingOption) return;

    const performanceScore = topic.questionsTotal > 0
      ? topic.questionsCorrect / topic.questionsTotal
      : null;

    const reviewEntry: ReviewEntry = {
      id: generateReviewId(),
      reviewNumber: topic.reviewHistory.length + 1,
      date: today,
      rating,
      ratingLabel: ratingOption.label,
      difficultyBefore: currentState.difficulty,
      difficultyAfter: newState.difficulty,
      stabilityBefore: currentState.stability,
      stabilityAfter: newState.stability,
      intervalDays,
      scheduledDays,
      retrievability,
      performanceScore,
      questionsTotal: topic.questionsTotal,
      questionsCorrect: topic.questionsCorrect,
      algorithmVersion: normalizedFsrsConfig.version,
      requestedRetention: normalizedFsrsConfig.requestedRetention,
      usedCustomWeights: normalizedFsrsConfig.customWeights !== null,
    };

    updateTopicInGroup(groupId, topicId, {
      studied: true,
      dateStudied: topic.dateStudied ?? new Date().toISOString(),
      fsrsDifficulty: newState.difficulty,
      fsrsStability: newState.stability,
      fsrsLastReview: newState.lastReview,
      fsrsNextReview: newState.nextReview,
      deadline: newState.nextReview ?? topic.deadline,
      reviewHistory: [...topic.reviewHistory, reviewEntry],
    });
  }, [findTopic, fsrsConfig, updateTopicInGroup]);

  const setPriority = useCallback((groupId: string, topicId: string, priority: Priority | null) => {
    updateTopicInGroup(groupId, topicId, { priority });
    setPriorityMenuTopic(null);
  }, [updateTopicInGroup]);

  const updateTopicQuestionProgress = useCallback((
    groupId: string,
    topicId: string,
    nextTotal: number,
    nextCorrect: number,
  ) => {
    const topic = findTopic(groupId, topicId);
    if (!topic) return;

    const safeTotal = Math.max(0, nextTotal);
    const safeCorrect = Math.max(0, Math.min(safeTotal, nextCorrect));
    const deltaMade = Math.max(0, safeTotal - topic.questionsTotal);
    const deltaCorrect = Math.max(0, safeCorrect - topic.questionsCorrect);
    const today = toDateOnlyString(new Date());
    const nextLogs = [...(topic.questionLogs ?? [])];

    if (deltaMade > 0 || deltaCorrect > 0) {
      const existingLogIdx = nextLogs.findIndex(log => log.date === today);
      if (existingLogIdx >= 0) {
        const existing = nextLogs[existingLogIdx];
        nextLogs[existingLogIdx] = {
          ...existing,
          questionsMade: existing.questionsMade + deltaMade,
          questionsCorrect: existing.questionsCorrect + deltaCorrect,
        };
      } else {
        nextLogs.push({
          date: today,
          questionsMade: deltaMade,
          questionsCorrect: deltaCorrect,
        });
      }
    }

    updateTopicInGroup(groupId, topicId, {
      questionsTotal: safeTotal,
      questionsCorrect: safeCorrect,
      questionLogs: nextLogs,
    });
  }, [findTopic, updateTopicInGroup]);

  function normalizeTag(tag: string): string {
    return tag.replace(/\s+/g, ' ').trim();
  }

  const addTagToTopic = useCallback((groupId: string, topicId: string, rawTag: string) => {
    const normalized = normalizeTag(rawTag);
    if (!normalized) return;
    const topic = findTopic(groupId, topicId);
    if (!topic) return;
    const existingTags = topic.tags ?? [];
    const exists = existingTags.some(tag => tag.toLocaleLowerCase('pt-BR') === normalized.toLocaleLowerCase('pt-BR'));
    if (exists) return;
    updateTopicInGroup(groupId, topicId, {
      tags: [...existingTags, normalized].slice(0, 12),
    });
    setTagInputs(prev => ({ ...prev, [topicId]: '' }));
  }, [findTopic, updateTopicInGroup]);

  const removeTagFromTopic = useCallback((groupId: string, topicId: string, tagToRemove: string) => {
    const topic = findTopic(groupId, topicId);
    if (!topic) return;
    updateTopicInGroup(groupId, topicId, {
      tags: (topic.tags ?? []).filter(tag => tag !== tagToRemove),
    });
  }, [findTopic, updateTopicInGroup]);

  const startTopicEdit = useCallback((topic: Topic) => {
    setEditingTopicId(topic.id);
    editTopicNameRef.current = topic.name;
    setEditTopicName(topic.name);
  }, []);

  const saveTopicEdit = useCallback((groupId: string, topicId: string) => {
    const trimmedName = editTopicNameRef.current.trim();
    if (trimmedName) {
      updateTopicInGroup(groupId, topicId, { name: trimmedName });
    }
    setEditingTopicId(null);
  }, [updateTopicInGroup]);

  const cancelTopicEdit = useCallback(() => {
    setEditingTopicId(null);
  }, []);

  const setEditTopicNameDraft = useCallback((name: string) => {
    editTopicNameRef.current = name;
    setEditTopicName(name);
  }, []);

  const handleTagDraftChange = useCallback((topicId: string, value: string) => {
    setTagInputs(prev => ({ ...prev, [topicId]: value }));
  }, []);

  const toggleTopicSelection = useCallback((topicId: string) => {
    setSelectedTopicIds(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  }, []);

  const toggleSelectAllFiltered = useCallback(() => {
    setSelectionMode(true);
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('pt-BR');
    const visibleTopicIds: string[] = [];
    for (const group of subject.topicGroups) {
      for (const topic of group.topics) {
        if (statusFilter === 'studied' && !topic.studied) continue;
        if (statusFilter === 'pending' && topic.studied) continue;
        if (priorityFilter !== 'all' && topic.priority !== priorityFilter) continue;
        if (tagFilter !== 'all') {
          const tags = topic.tags ?? [];
          const hasTag = tags.some(tag => (
            tag.toLocaleLowerCase('pt-BR') === tagFilter.toLocaleLowerCase('pt-BR')
          ));
          if (!hasTag) continue;
        }
        if (normalizedQuery) {
          const inName = topic.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery);
          const inNotes = (topic.notes ?? '').toLocaleLowerCase('pt-BR').includes(normalizedQuery);
          const inTags = (topic.tags ?? []).some(tag => (
            tag.toLocaleLowerCase('pt-BR').includes(normalizedQuery)
          ));
          if (!inName && !inNotes && !inTags) continue;
        }
        visibleTopicIds.push(topic.id);
      }
    }

    setSelectedTopicIds(prev => {
      const next = new Set(prev);
      const alreadySelectedAll = visibleTopicIds.every(topicId => next.has(topicId));
      if (alreadySelectedAll) {
        for (const topicId of visibleTopicIds) next.delete(topicId);
      } else {
        for (const topicId of visibleTopicIds) next.add(topicId);
      }
      return next;
    });
  }, [priorityFilter, searchQuery, statusFilter, subject.topicGroups, tagFilter]);

  const clearSelectedTopics = useCallback(() => {
    setSelectedTopicIds(new Set());
    setSelectionMode(false);
  }, []);

  const applyBulkStudied = useCallback((studied: boolean) => {
    if (selectedTopicIds.size === 0) return;
    const selected = selectedTopicIds;
    const nowIso = new Date().toISOString();
    updateTopicGroups(groups => groups.map(group => ({
      ...group,
      topics: group.topics.map(topic => (
        selected.has(topic.id)
          ? {
              ...topic,
              studied,
              dateStudied: studied ? topic.dateStudied ?? nowIso : null,
            }
          : topic
      )),
    })));
  }, [selectedTopicIds, updateTopicGroups]);

  const applyBulkPriority = useCallback((priority: Priority | null) => {
    if (selectedTopicIds.size === 0) return;
    const selected = selectedTopicIds;
    updateTopicGroups(groups => groups.map(group => ({
      ...group,
      topics: group.topics.map(topic => (
        selected.has(topic.id)
          ? { ...topic, priority }
          : topic
      )),
    })));
  }, [selectedTopicIds, updateTopicGroups]);

  const applyBulkTag = useCallback(() => {
    const normalized = normalizeTag(bulkTagDraft);
    if (!normalized || selectedTopicIds.size === 0) return;
    const selected = selectedTopicIds;
    updateTopicGroups(groups => groups.map(group => ({
      ...group,
      topics: group.topics.map(topic => {
        if (!selected.has(topic.id)) return topic;
        const existingTags = topic.tags ?? [];
        const exists = existingTags.some(tag => (
          tag.toLocaleLowerCase('pt-BR') === normalized.toLocaleLowerCase('pt-BR')
        ));
        if (exists) return topic;
        return {
          ...topic,
          tags: [...existingTags, normalized].slice(0, 12),
        };
      }),
    })));
    setBulkTagDraft('');
  }, [bulkTagDraft, selectedTopicIds, updateTopicGroups]);

  const applyBulkReview = useCallback(() => {
    if (selectedTopicIds.size === 0) return;
    const selected = selectedTopicIds;
    const normalizedFsrsConfig = normalizeFSRSConfig(fsrsConfig);
    const ratingOption = RATING_OPTIONS.find(option => option.value === bulkReviewRating);
    if (!ratingOption) return;
    const nowIso = new Date().toISOString();
    const today = toDateOnlyString(new Date());

    updateTopicGroups(groups => groups.map(group => ({
      ...group,
      topics: group.topics.map(topic => {
        if (!selected.has(topic.id)) return topic;

        const currentState = {
          difficulty: topic.fsrsDifficulty,
          stability: topic.fsrsStability,
          lastReview: topic.fsrsLastReview,
          nextReview: topic.fsrsNextReview,
        };
        const { newState, intervalDays, scheduledDays, retrievability } = fsrsReview(
          currentState,
          bulkReviewRating,
          normalizedFsrsConfig,
        );
        const performanceScore = topic.questionsTotal > 0
          ? topic.questionsCorrect / topic.questionsTotal
          : null;

        const reviewEntry: ReviewEntry = {
          id: generateReviewId(),
          reviewNumber: topic.reviewHistory.length + 1,
          date: today,
          rating: bulkReviewRating,
          ratingLabel: ratingOption.label,
          difficultyBefore: currentState.difficulty,
          difficultyAfter: newState.difficulty,
          stabilityBefore: currentState.stability,
          stabilityAfter: newState.stability,
          intervalDays,
          scheduledDays,
          retrievability,
          performanceScore,
          questionsTotal: topic.questionsTotal,
          questionsCorrect: topic.questionsCorrect,
          algorithmVersion: normalizedFsrsConfig.version,
          requestedRetention: normalizedFsrsConfig.requestedRetention,
          usedCustomWeights: normalizedFsrsConfig.customWeights !== null,
        };

        return {
          ...topic,
          studied: true,
          dateStudied: topic.dateStudied ?? nowIso,
          fsrsDifficulty: newState.difficulty,
          fsrsStability: newState.stability,
          fsrsLastReview: newState.lastReview,
          fsrsNextReview: newState.nextReview,
          deadline: newState.nextReview ?? topic.deadline,
          reviewHistory: [...topic.reviewHistory, reviewEntry],
        };
      }),
    })));
  }, [bulkReviewRating, fsrsConfig, selectedTopicIds, updateTopicGroups]);

  const canRunBulkAction = useMemo(() => {
    if (selectedTopicIds.size === 0) return false;
    if (bulkActionKind === 'tag') return bulkTagDraft.trim().length > 0;
    return true;
  }, [bulkActionKind, bulkTagDraft, selectedTopicIds]);

  const runBulkAction = useCallback(() => {
    if (selectedTopicIds.size === 0) return;
    if (bulkActionKind === 'studied') {
      applyBulkStudied(bulkStudiedValue === 'studied');
      return;
    }
    if (bulkActionKind === 'priority') {
      applyBulkPriority(bulkPriorityValue === 'none' ? null : bulkPriorityValue);
      return;
    }
    if (bulkActionKind === 'tag') {
      applyBulkTag();
      return;
    }
    applyBulkReview();
  }, [
    applyBulkPriority,
    applyBulkReview,
    applyBulkStudied,
    applyBulkTag,
    bulkActionKind,
    bulkPriorityValue,
    bulkStudiedValue,
    selectedTopicIds,
  ]);

  function handleStructuredImport() {
    const groups = parseStructuredImport(structuredImportText);
    if (groups.length === 0) return;
    const newGroups: TopicGroup[] = groups.map(g => ({
      id: generateId(),
      name: g.name,
      topics: g.topics.map(name => createTopic(name)),
    }));
    updateTopicGroups(existing => [...existing, ...newGroups]);
    setStructuredImportText('');
    setShowStructuredImport(false);
  }

  // ---- Filtering ----
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase('pt-BR');

  const matchesSearchQuery = useCallback((topic: Topic): boolean => {
    if (!normalizedSearchQuery) return true;
    const inName = topic.name.toLocaleLowerCase('pt-BR').includes(normalizedSearchQuery);
    const inNotes = (topic.notes ?? '').toLocaleLowerCase('pt-BR').includes(normalizedSearchQuery);
    const inTags = (topic.tags ?? []).some(tag => (
      tag.toLocaleLowerCase('pt-BR').includes(normalizedSearchQuery)
    ));
    return inName || inNotes || inTags;
  }, [normalizedSearchQuery]);

  const sortTopics = useCallback((topics: Topic[]): Topic[] => {
    const sorted = [...topics];
    sorted.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'pt-BR');
      }
      if (sortBy === 'priority') {
        const order: Record<Priority | 'none', number> = {
          alta: 0,
          media: 1,
          baixa: 2,
          none: 3,
        };
        const left = a.priority ?? 'none';
        const right = b.priority ?? 'none';
        return order[left] - order[right];
      }
      if (sortBy === 'date') {
        const leftDate = a.dateStudied ?? a.fsrsLastReview ?? '';
        const rightDate = b.dateStudied ?? b.fsrsLastReview ?? '';
        if (leftDate === rightDate) return a.name.localeCompare(b.name, 'pt-BR');
        return rightDate.localeCompare(leftDate);
      }
      const leftProgress = Number(a.studied);
      const rightProgress = Number(b.studied);
      if (leftProgress !== rightProgress) return rightProgress - leftProgress;
      if (a.questionsTotal !== b.questionsTotal) return b.questionsTotal - a.questionsTotal;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
    return sorted;
  }, [sortBy]);

  const filterTopics = useCallback((topics: Topic[]): Topic[] => {
    const filtered = topics.filter(topic => {
      if (statusFilter === 'studied' && !topic.studied) return false;
      if (statusFilter === 'pending' && topic.studied) return false;
      if (priorityFilter !== 'all' && topic.priority !== priorityFilter) return false;
      if (tagFilter !== 'all') {
        const tags = topic.tags ?? [];
        if (!tags.some(tag => tag.toLocaleLowerCase('pt-BR') === tagFilter.toLocaleLowerCase('pt-BR'))) return false;
      }
      if (!matchesSearchQuery(topic)) return false;
      return true;
    });
    return sortTopics(filtered);
  }, [matchesSearchQuery, priorityFilter, sortTopics, statusFilter, tagFilter]);

  const filteredTopicRefs = useMemo(() => {
    const rows: { groupId: string; topic: Topic }[] = [];
    for (const group of subject.topicGroups) {
      for (const topic of filterTopics(group.topics)) {
        rows.push({ groupId: group.id, topic });
      }
    }
    return rows;
  }, [filterTopics, subject.topicGroups]);

  const filteredTopicIds = useMemo(
    () => filteredTopicRefs.map(row => row.topic.id),
    [filteredTopicRefs],
  );

  const allTopicIds = useMemo(
    () => allTopics.map(topic => topic.id),
    [allTopics],
  );

  const selectedTotalCount = useMemo(
    () => allTopicIds.reduce((count, topicId) => count + (selectedTopicIds.has(topicId) ? 1 : 0), 0),
    [allTopicIds, selectedTopicIds],
  );

  const selectedFilteredCount = useMemo(
    () => filteredTopicIds.reduce((count, topicId) => count + (selectedTopicIds.has(topicId) ? 1 : 0), 0),
    [filteredTopicIds, selectedTopicIds],
  );

  const allTopicsSelected = allTopicIds.length > 0 && selectedTotalCount === allTopicIds.length;
  const allFilteredSelected = filteredTopicIds.length > 0 && selectedFilteredCount === filteredTopicIds.length;

  const toggleSelectAllTopics = useCallback(() => {
    setSelectionMode(true);
    setSelectedTopicIds(prev => {
      const next = new Set(prev);
      const alreadySelectedAll = allTopicIds.every(topicId => next.has(topicId));
      if (alreadySelectedAll) {
        for (const topicId of allTopicIds) next.delete(topicId);
      } else {
        for (const topicId of allTopicIds) next.add(topicId);
      }
      return next;
    });
  }, [allTopicIds]);

  useSubjectDetailPersistence({
    subject,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    tagFilter,
    setTagFilter,
    viewMode,
    setViewMode,
    collapsedGroups,
    setCollapsedGroups,
    collapsedSubjectIdRef,
    allTopicIds,
    setSelectedTopicIds,
    allAvailableTags,
    isEditingDescription,
    setDescriptionDraft,
  });

  // ---- Stats ----
  const pendingHighPriority = allTopics.filter(t => !t.studied && t.priority === 'alta').length;
  const overdueCount = allTopics.filter(t => {
    if (!t.deadline || t.studied) return false;
    const info = getDeadlineInfo(t.deadline);
    return info?.urgency === 'overdue';
  }).length;
  const reviewsDueCount = allTopics.filter(t => t.studied && isReviewDue(t.fsrsNextReview)).length;
  const pendingTopicsCount = allTopics.filter(t => !t.studied).length;
  const progressPercent = stats.total > 0 ? Math.round((stats.studied / stats.total) * 100) : 0;
  const subjectDescription = subject.description?.trim() ?? '';
  const subjectHeroStyle = useMemo(() => getSubjectHeroStyle(subject.color), [subject.color]);

  useEffect(() => {
    if (allTopics.length === 0 && controlsSection !== 'add') {
      setControlsSection('add');
    }
  }, [allTopics.length, controlsSection]);

  useEffect(() => {
    if (!focusTopicId) {
      focusHandledRef.current = null;
    }
  }, [focusTopicId]);

  useEffect(() => {
    if (!focusTopicId || focusHandledRef.current === focusTopicId) return;

    let targetGroupId: string | null = null;
    let targetTopic: Topic | null = null;
    for (const group of subject.topicGroups) {
      const match = group.topics.find(t => t.id === focusTopicId);
      if (match) {
        targetGroupId = group.id;
        targetTopic = match;
        break;
      }
    }

    focusHandledRef.current = focusTopicId;
    onConsumeFocusTopic?.();

    if (!targetGroupId || !targetTopic) return;

    setCollapsedGroups(prev => {
      if (!prev.has(targetGroupId)) return prev;
      const next = new Set(prev);
      next.delete(targetGroupId);
      return next;
    });

    setExpandedTopics(prev => {
      const next = new Set(prev);
      next.add(focusTopicId);
      return next;
    });

    const matchesFilters = (() => {
      if (statusFilter === 'studied' && !targetTopic.studied) return false;
      if (statusFilter === 'pending' && targetTopic.studied) return false;
      if (priorityFilter !== 'all' && targetTopic.priority !== priorityFilter) return false;
      if (tagFilter !== 'all') {
        const tags = targetTopic.tags ?? [];
        if (!tags.some(tag => tag.toLocaleLowerCase('pt-BR') === tagFilter.toLocaleLowerCase('pt-BR'))) return false;
      }
      if (!matchesSearchQuery(targetTopic)) return false;
      return true;
    })();

    if (!matchesFilters) {
      setStatusFilter('all');
      setPriorityFilter('all');
      setTagFilter('all');
      setSearchQuery('');
    }

    setHighlightTopicId(focusTopicId);
    const timer = window.setTimeout(() => {
      setHighlightTopicId(prev => (prev === focusTopicId ? null : prev));
    }, 2200);

    requestAnimationFrame(() => {
      window.setTimeout(() => {
        const el = document.getElementById(`topic-${focusTopicId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 80);
    });

    return () => window.clearTimeout(timer);
  }, [
    focusTopicId,
    subject.topicGroups,
    statusFilter,
    priorityFilter,
    tagFilter,
    matchesSearchQuery,
    onConsumeFocusTopic,
  ]);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 pb-20 lg:pb-8 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-indigo-200/30 blur-3xl dark:bg-indigo-900/20" />
        <div className="absolute top-1/2 -left-40 h-80 w-80 rounded-full bg-purple-200/30 blur-3xl dark:bg-purple-900/20" />
        <div className="absolute -bottom-40 right-1/3 h-80 w-80 rounded-full bg-pink-200/20 blur-3xl dark:bg-pink-900/10" />
      </div>
      <div className="relative z-10">
      <datalist id={tagSuggestionListId}>
        {tagSuggestionCatalog.map(tag => (
          <option key={`tag-suggestion-${tag}`} value={tag} />
        ))}
      </datalist>

      <div className="relative overflow-hidden" style={subjectHeroStyle}>
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 h-52 w-52 rounded-full bg-white/10 translate-y-1/2 -translate-x-1/2" />

        <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-7">
          <button
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeft size={18} />
            Voltar para visao geral
          </button>

          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm text-white">
              <BookOpen size={24} />
            </div>
            <div className="min-w-0 flex-1 text-white">
              <h1 className="text-2xl font-bold sm:text-3xl">
                {subject.emoji} {subject.name}
              </h1>

              <div className="mt-2 flex items-start gap-2">
                {isEditingDescription ? (
                  <textarea
                    value={descriptionDraft}
                    onChange={event => setDescriptionDraft(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault();
                        saveDescription();
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelDescriptionEdit();
                      }
                    }}
                    rows={2}
                    placeholder="Adicione uma frase para descrever esta disciplina..."
                    className="w-full max-w-2xl rounded-lg border border-white/30 bg-white/90 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2"
                    style={getRingColorStyle(subject.color)}
                  />
                ) : (
                  <p className={`max-w-2xl text-sm sm:text-base ${subjectDescription ? 'text-white/85' : 'italic text-white/65'}`}>
                    {subjectDescription || 'Adicione uma frase para descrever esta disciplina.'}
                  </p>
                )}

                <div className="shrink-0 flex items-center gap-1">
                  {isEditingDescription ? (
                    <>
                      <button
                        onClick={saveDescription}
                        className="rounded-lg bg-white/20 p-2 text-white transition-colors hover:bg-white/30"
                        title="Salvar descricao"
                      >
                        <Save size={16} />
                      </button>
                      <button
                        onClick={cancelDescriptionEdit}
                        className="rounded-lg bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20"
                        title="Cancelar"
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditingDescription(true)}
                      className="rounded-lg bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20"
                      title={subjectDescription ? 'Editar descricao' : 'Adicionar descricao'}
                    >
                      <Edit3 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
            {pendingHighPriority > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1.5 font-medium text-white">
                {"\u{1F525}"} {pendingHighPriority} de alta prioridade
              </span>
            )}
            {overdueCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/20 px-3 py-1.5 font-medium text-white">
                {"\u26A0\uFE0F"} {overdueCount} prazo{overdueCount > 1 ? 's' : ''} vencido{overdueCount > 1 ? 's' : ''}
              </span>
            )}
            {reviewsDueCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/20 px-3 py-1.5 font-medium text-white">
                {"\u{1F9E0}"} {reviewsDueCount} revisoes pendentes
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div className="relative z-10 -mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white/75 p-4 backdrop-blur-xl shadow-lg shadow-slate-200/35 dark:border-slate-700/70 dark:bg-slate-900/70 dark:shadow-slate-900/35">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ backgroundColor: subject.color }}>
                <BookOpen size={18} />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Progresso</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{stats.studied}/{stats.total}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{progressPercent}% concluido</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/75 p-4 backdrop-blur-xl shadow-lg shadow-slate-200/35 dark:border-slate-700/70 dark:bg-slate-900/70 dark:shadow-slate-900/35">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white">
                <HelpCircle size={18} />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Questoes</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{stats.questionsTotal}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{stats.questionsCorrect} corretas</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/75 p-4 backdrop-blur-xl shadow-lg shadow-slate-200/35 dark:border-slate-700/70 dark:bg-slate-900/70 dark:shadow-slate-900/35">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white">
                <TrendingUp size={18} />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Rendimento</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{formatPercent(stats.rendimento)}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">acerto geral</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/75 p-4 backdrop-blur-xl shadow-lg shadow-slate-200/35 dark:border-slate-700/70 dark:bg-slate-900/70 dark:shadow-slate-900/35">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500 text-white">
                <Clock3 size={18} />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Revisoes</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{stats.reviewsDue}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">pendentes</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 backdrop-blur-2xl shadow-xl shadow-slate-200/35 ring-1 ring-white/70 dark:border-slate-700/70 dark:bg-slate-900/70 dark:shadow-slate-900/40 dark:ring-slate-700/50 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Painel de Controle</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {progressPercent}%
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {stats.studied} estudados, {pendingTopicsCount} pendentes e {filteredTopicIds.length} visiveis.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setControlsSection('add')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  controlsSection === 'add'
                    ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <FolderPlus size={14} />
                Adicionar Topico
              </button>
              {allTopics.length > 0 && (
                <button
                  type="button"
                  onClick={() => setControlsSection('filters')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    controlsSection === 'filters'
                      ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  <SlidersHorizontal size={14} />
                  Filtros e Modos
                </button>
              )}
              {allTopics.length > 0 && (
                <button
                  type="button"
                  onClick={() => setControlsSection('bulk')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    controlsSection === 'bulk'
                      ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  <CheckCircle2 size={14} />
                  Acoes em Massa
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${stats.progresso * 100}%`, backgroundColor: subject.color }}
            />
          </div>

          <div className="mt-4">
            {controlsSection === 'add' && (
              <SubjectAddTopicGroup
                subjectColor={subject.color}
                newGroupName={newGroupName}
                onNewGroupNameChange={setNewGroupName}
                onAddGroup={addGroup}
                showStructuredImport={showStructuredImport}
                onToggleStructuredImport={() => setShowStructuredImport(prev => !prev)}
                structuredImportText={structuredImportText}
                onStructuredImportTextChange={setStructuredImportText}
                onHandleStructuredImport={handleStructuredImport}
              />
            )}

            {controlsSection === 'filters' && allTopics.length > 0 && (
              <SubjectFilters
                allTopicsCount={allTopics.length}
                pendingTopicsCount={pendingTopicsCount}
                studiedCount={stats.studied}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                priorityFilter={priorityFilter}
                onPriorityFilterChange={setPriorityFilter}
                tagFilter={tagFilter}
                onTagFilterChange={setTagFilter}
                allAvailableTags={allAvailableTags}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onCollapseAllGroups={collapseAllGroups}
                onExpandAllGroups={expandAllGroups}
                filteredTopicCount={filteredTopicIds.length}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                sortBy={sortBy}
                onSortChange={setSortBy}
              />
            )}

            {controlsSection === 'bulk' && allTopics.length > 0 && (
              <SubjectBulkActions
                allTopicsCount={allTopics.length}
                selectedTotalCount={selectedTotalCount}
                allTopicIdsCount={allTopicIds.length}
                selectedFilteredCount={selectedFilteredCount}
                filteredTopicIdsCount={filteredTopicIds.length}
                allTopicsSelected={allTopicsSelected}
                allFilteredSelected={allFilteredSelected}
                selectionMode={selectionMode}
                selectedTopicIdsSize={selectedTopicIds.size}
                onToggleSelectAllTopics={toggleSelectAllTopics}
                onToggleSelectAllFiltered={toggleSelectAllFiltered}
                onClearSelectedTopics={clearSelectedTopics}
                bulkActionKind={bulkActionKind}
                onBulkActionKindChange={setBulkActionKind}
                bulkStudiedValue={bulkStudiedValue}
                onBulkStudiedValueChange={setBulkStudiedValue}
                bulkPriorityValue={bulkPriorityValue}
                onBulkPriorityValueChange={setBulkPriorityValue}
                bulkTagDraft={bulkTagDraft}
                onBulkTagDraftChange={setBulkTagDraft}
                bulkReviewRating={bulkReviewRating}
                onBulkReviewRatingChange={setBulkReviewRating}
                tagSuggestionListId={tagSuggestionListId}
                subjectColor={subject.color}
                canRunBulkAction={canRunBulkAction}
                onRunBulkAction={runBulkAction}
              />
            )}
          </div>
        </div>

        <SubjectTopicGroups
          subject={subject}
          viewMode={viewMode}
          hasActiveFilter={statusFilter !== 'all' || priorityFilter !== 'all' || tagFilter !== 'all' || searchQuery.trim().length > 0}
          filterTopics={filterTopics}
          collapsedGroups={collapsedGroups}
          editingGroupId={editingGroupId}
          editGroupName={editGroupName}
          deleteConfirm={deleteConfirm}
          showBulkAdd={showBulkAdd}
          editingTopicId={editingTopicId}
          editTopicName={editTopicName}
          priorityMenuTopic={priorityMenuTopic}
          expandedTopics={expandedTopics}
          highlightTopicId={highlightTopicId}
          selectedTopicIds={selectedTopicIds}
          selectionMode={selectionMode}
          newTopicInputs={newTopicInputs}
          bulkInputs={bulkInputs}
          tagInputs={tagInputs}
          tagSuggestionListId={tagSuggestionListId}
          onToggleGroupCollapse={toggleGroupCollapse}
          onSetEditingGroupId={setEditingGroupId}
          onSetEditGroupName={setEditGroupName}
          onSaveGroupEdit={saveGroupEdit}
          onRemoveGroup={removeGroup}
          onSetDeleteConfirm={setDeleteConfirm}
          onSetNewTopicInputs={(updater: (prev: Record<string, string>) => Record<string, string>) => setNewTopicInputs(updater)}
          onAddTopicToGroup={addTopicToGroup}
          onSetShowBulkAdd={setShowBulkAdd}
          onSetBulkInputs={(updater: (prev: Record<string, string>) => Record<string, string>) => setBulkInputs(updater)}
          onAddBulkTopicsToGroup={addBulkTopicsToGroup}
          onToggleTopicSelection={toggleTopicSelection}
          onSetTopicStudied={setTopicStudied}
          onOpenStudyPopup={openStudyPopup}
          onStartTopicEdit={startTopicEdit}
          onSaveTopicEdit={saveTopicEdit}
          onCancelTopicEdit={cancelTopicEdit}
          onSetEditTopicName={setEditTopicNameDraft}
          onRemoveTopic={removeTopic}
          onSetPriority={setPriority}
          onSetPriorityMenuTopic={setPriorityMenuTopic}
          onToggleTopicExpanded={toggleTopicExpanded}
          onUpdateTopic={updateTopicInGroup}
          onUpdateQuestionProgress={updateTopicQuestionProgress}
          onTagDraftChange={handleTagDraftChange}
          onAddTag={addTagToTopic}
          onRemoveTag={removeTagFromTopic}
        />

        {studyPopup && (
          <TopicStudyModal
            key={`${studyPopup.groupId}-${studyPopup.topicId}`}
            topic={findTopic(studyPopup.groupId, studyPopup.topicId)}
            groupId={studyPopup.groupId}
            subjectColor={subject.color}
            fsrsConfig={fsrsConfig}
            onClose={() => setStudyPopup(null)}
            onUpdateTopic={updateTopicInGroup}
            onUpdateQuestionProgress={updateTopicQuestionProgress}
            onSetStudied={setTopicStudied}
            onRunReview={runTopicReview}
            onSetPriority={setPriority}
            onAddTag={addTagToTopic}
            onRemoveTag={removeTagFromTopic}
            tagSuggestionListId={tagSuggestionListId}
          />
        )}

        {allTopics.length > 0 && (
          <div className="rounded-2xl p-5 text-white shadow-lg" style={{ backgroundColor: subject.color }}>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={16} />
                {stats.studied} de {stats.total} conteudos estudados
              </span>
              <span className="inline-flex items-center gap-2">
                <HelpCircle size={16} />
                {stats.questionsTotal} questoes feitas
              </span>
              <span className="inline-flex items-center gap-2">
                <TrendingUp size={16} />
                {formatPercent(stats.rendimento)} de rendimento
              </span>
              {stats.reviewsDue > 0 && (
                <span className="inline-flex items-center gap-2">
                  <Brain size={16} />
                  {stats.reviewsDue} revisoes pendentes
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}







