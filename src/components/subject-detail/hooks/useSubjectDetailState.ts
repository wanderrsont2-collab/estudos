import { useEffect, useRef, useState } from 'react';
import type { Priority, Subject } from '../../../types';
import type { FSRSRating } from '../../../fsrs';

export type StatusFilter = 'all' | 'studied' | 'pending';
export type ViewMode = 'cards' | 'grid' | 'table' | 'groups';
export type BulkActionKind = 'studied' | 'priority' | 'tag' | 'review';
export type BulkStudiedValue = 'studied' | 'pending';
export type BulkPriorityValue = Priority | 'none';

export interface StudyPopupState {
  groupId: string;
  topicId: string;
}

function readCollapsedGroups(subjectId: string): Set<string> {
  const stored = window.localStorage.getItem(`subject_collapsed_groups_${subjectId}`);
  if (!stored) return new Set();
  try {
    const parsed = JSON.parse(stored) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function readStatusFilter(subjectId: string): StatusFilter {
  const stored = window.localStorage.getItem(`subject_status_filter_${subjectId}`);
  return stored === 'studied' || stored === 'pending' ? stored : 'all';
}

function readPriorityFilter(subjectId: string): Priority | 'all' {
  const stored = window.localStorage.getItem(`subject_priority_filter_${subjectId}`);
  return stored === 'alta' || stored === 'media' || stored === 'baixa' ? stored : 'all';
}

function readTagFilter(subjectId: string): string {
  const stored = window.localStorage.getItem(`subject_tag_filter_${subjectId}`);
  return stored && stored.trim().length > 0 ? stored : 'all';
}

function readViewMode(subjectId: string): ViewMode {
  const stored = window.localStorage.getItem(`subject_view_mode_${subjectId}`);
  return stored === 'table' || stored === 'grid' || stored === 'groups' ? stored : 'cards';
}

interface UseSubjectDetailStateParams {
  subject: Subject;
  onUpdate: (subject: Subject) => void;
}

export function useSubjectDetailState({ subject, onUpdate }: UseSubjectDetailStateParams) {
  const [newGroupName, setNewGroupName] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => readCollapsedGroups(subject.id));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => readStatusFilter(subject.id));
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>(() => readPriorityFilter(subject.id));
  const [tagFilter, setTagFilter] = useState<string>(() => readTagFilter(subject.id));
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode(subject.id));
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicName, setEditTopicName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showStructuredImport, setShowStructuredImport] = useState(false);
  const [structuredImportText, setStructuredImportText] = useState('');
  const [newTopicInputs, setNewTopicInputs] = useState<Record<string, string>>({});
  const [showBulkAdd, setShowBulkAdd] = useState<string | null>(null);
  const [bulkInputs, setBulkInputs] = useState<Record<string, string>>({});
  const [priorityMenuTopic, setPriorityMenuTopic] = useState<string | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [studyPopup, setStudyPopup] = useState<StudyPopupState | null>(null);
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkActionKind, setBulkActionKind] = useState<BulkActionKind>('studied');
  const [bulkStudiedValue, setBulkStudiedValue] = useState<BulkStudiedValue>('studied');
  const [bulkPriorityValue, setBulkPriorityValue] = useState<BulkPriorityValue>('alta');
  const [bulkTagDraft, setBulkTagDraft] = useState('');
  const [bulkReviewRating, setBulkReviewRating] = useState<FSRSRating>(3);
  const [highlightTopicId, setHighlightTopicId] = useState<string | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(subject.description || '');

  const focusHandledRef = useRef<string | null>(null);
  const collapsedSubjectIdRef = useRef(subject.id);
  const subjectRef = useRef(subject);
  const onUpdateRef = useRef(onUpdate);
  const editTopicNameRef = useRef(editTopicName);

  useEffect(() => {
    subjectRef.current = subject;
  }, [subject]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    editTopicNameRef.current = editTopicName;
  }, [editTopicName]);

  function saveDescription() {
    const trimmed = descriptionDraft.trim();
    const nextSubject = { ...subjectRef.current, description: trimmed };
    subjectRef.current = nextSubject;
    onUpdateRef.current(nextSubject);
    setIsEditingDescription(false);
  }

  function cancelDescriptionEdit() {
    setDescriptionDraft(subject.description || '');
    setIsEditingDescription(false);
  }

  return {
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
  };
}
