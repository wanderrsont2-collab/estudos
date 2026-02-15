import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { Priority, Subject } from '../../../types';
import type { StatusFilter, ViewMode } from './useSubjectDetailState';

interface UseSubjectDetailPersistenceParams {
  subject: Subject;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  priorityFilter: Priority | 'all';
  setPriorityFilter: (value: Priority | 'all') => void;
  tagFilter: string;
  setTagFilter: (value: string) => void;
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
  collapsedGroups: Set<string>;
  setCollapsedGroups: (value: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  collapsedSubjectIdRef: MutableRefObject<string>;
  allTopicIds: string[];
  setSelectedTopicIds: (value: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  allAvailableTags: string[];
  isEditingDescription: boolean;
  setDescriptionDraft: (value: string) => void;
}

export function useSubjectDetailPersistence({
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
}: UseSubjectDetailPersistenceParams) {
  useEffect(() => {
    window.localStorage.setItem(`subject_status_filter_${subject.id}`, statusFilter);
  }, [statusFilter, subject.id]);

  useEffect(() => {
    window.localStorage.setItem(`subject_priority_filter_${subject.id}`, priorityFilter);
  }, [priorityFilter, subject.id]);

  useEffect(() => {
    window.localStorage.setItem(`subject_tag_filter_${subject.id}`, tagFilter);
  }, [tagFilter, subject.id]);

  useEffect(() => {
    window.localStorage.setItem(`subject_view_mode_${subject.id}`, viewMode);
  }, [viewMode, subject.id]);

  useEffect(() => {
    const ids = Array.from(collapsedGroups);
    window.localStorage.setItem(
      `subject_collapsed_groups_${collapsedSubjectIdRef.current}`,
      JSON.stringify(ids),
    );
  }, [collapsedGroups, collapsedSubjectIdRef]);

  useEffect(() => {
    const statusStored = window.localStorage.getItem(`subject_status_filter_${subject.id}`);
    setStatusFilter(statusStored === 'studied' || statusStored === 'pending' ? statusStored : 'all');

    const priorityStored = window.localStorage.getItem(`subject_priority_filter_${subject.id}`);
    setPriorityFilter(priorityStored === 'alta' || priorityStored === 'media' || priorityStored === 'baixa' ? priorityStored : 'all');

    const tagStored = window.localStorage.getItem(`subject_tag_filter_${subject.id}`);
    setTagFilter(tagStored && tagStored.trim().length > 0 ? tagStored : 'all');

    const viewStored = window.localStorage.getItem(`subject_view_mode_${subject.id}`);
    setViewMode(viewStored === 'table' || viewStored === 'grid' || viewStored === 'groups' ? viewStored : 'cards');

    collapsedSubjectIdRef.current = subject.id;
    const collapsedStored = window.localStorage.getItem(`subject_collapsed_groups_${subject.id}`);
    if (collapsedStored) {
      try {
        const parsed = JSON.parse(collapsedStored) as string[];
        const validIds = new Set(subject.topicGroups.map(group => group.id));
        const next = new Set(
          (Array.isArray(parsed) ? parsed : []).filter(id => validIds.has(id)),
        );
        setCollapsedGroups(next);
      } catch {
        setCollapsedGroups(new Set());
      }
    } else {
      setCollapsedGroups(new Set());
    }
  }, [
    subject.id,
    subject.topicGroups,
    collapsedSubjectIdRef,
    setCollapsedGroups,
    setPriorityFilter,
    setStatusFilter,
    setTagFilter,
    setViewMode,
  ]);

  useEffect(() => {
    const validIds = new Set(allTopicIds);
    setSelectedTopicIds(prev => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      let changed = false;
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [allTopicIds, setSelectedTopicIds]);

  useEffect(() => {
    if (tagFilter === 'all') return;
    if (allAvailableTags.includes(tagFilter)) return;
    setTagFilter('all');
  }, [allAvailableTags, tagFilter, setTagFilter]);

  useEffect(() => {
    if (subject.topicGroups.length === 0) return;
    setCollapsedGroups(prev => {
      const validIds = new Set(subject.topicGroups.map(group => group.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [subject.topicGroups, setCollapsedGroups]);

  useEffect(() => {
    if (isEditingDescription) return;
    setDescriptionDraft(subject.description || '');
  }, [subject.description, subject.id, isEditingDescription, setDescriptionDraft]);
}
