import { useState, type CSSProperties } from 'react';
import { Subject, Topic, TopicGroup, Priority } from '../types';
import {
  createTopic, createTopicGroup, getSubjectStats, getGroupStats, generateId,
  getDeadlineInfo, parseStructuredImport, PRIORITY_CONFIG, getAllTopics,
} from '../store';
import { getReviewStatus, type FSRSConfig } from '../fsrs';
import { TopicReviewWidget } from './ReviewSystem';
import {
  ArrowLeft, Plus, Trash2, Check, X, BookOpen, Edit3, Save,
  ChevronDown, ChevronRight, FolderPlus, Calendar, AlertTriangle,
  Clock, Flag, Brain,
} from 'lucide-react';

interface SubjectDetailProps {
  subject: Subject;
  fsrsConfig: FSRSConfig;
  onBack: () => void;
  onUpdate: (subject: Subject) => void;
}

type StatusFilter = 'all' | 'studied' | 'pending';
const PRIORITY_OPTIONS: Priority[] = ['alta', 'media', 'baixa'];

function getStartOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isReviewDue(nextReview: string | null): boolean {
  if (!nextReview) return false;
  return new Date(nextReview + 'T00:00:00') <= getStartOfToday();
}

function parseNonNegativeInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
}

function getRingColorStyle(color: string): CSSProperties {
  return { '--tw-ring-color': color } as CSSProperties;
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div
        className="h-3 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${Math.min(value * 100, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function formatPercent(v: number) {
  return `${Math.round(v * 100)}%`;
}

function PriorityBadge({ priority, onClick, size = 'sm' }: { priority: Priority | null; onClick?: () => void; size?: 'sm' | 'xs' }) {
  if (!priority) {
    if (!onClick) return null;
    return (
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors ${size === 'xs' ? 'text-[10px]' : 'text-xs'}`}
        title="Definir prioridade"
      >
        <Flag size={size === 'xs' ? 10 : 12} />
        <span>Prioridade</span>
      </button>
    );
  }

  const config = PRIORITY_CONFIG[priority];
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bg} ${config.color} font-medium transition-all hover:opacity-80 ${size === 'xs' ? 'text-[10px]' : 'text-xs'}`}
      title="Alterar prioridade"
    >
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </button>
  );
}

function DeadlineBadge({ deadline, size = 'sm' }: { deadline: string | null; size?: 'sm' | 'xs' }) {
  const info = getDeadlineInfo(deadline);
  if (!info) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${info.className} ${size === 'xs' ? 'text-[10px]' : 'text-xs'}`}>
      {info.urgency === 'overdue' ? <AlertTriangle size={size === 'xs' ? 10 : 12} /> : <Clock size={size === 'xs' ? 10 : 12} />}
      {info.text}
    </span>
  );
}

export function SubjectDetail({ subject, fsrsConfig, onBack, onUpdate }: SubjectDetailProps) {
  const [newGroupName, setNewGroupName] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
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

  const stats = getSubjectStats(subject);
  const allTopics = getAllTopics(subject);

  function updateTopicGroups(updater: (groups: TopicGroup[]) => TopicGroup[]) {
    onUpdate({
      ...subject,
      topicGroups: updater(subject.topicGroups),
    });
  }

  // ---- Group CRUD ----
  function addGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    updateTopicGroups(groups => [...groups, createTopicGroup(name)]);
    setNewGroupName('');
  }

  function removeGroup(groupId: string) {
    updateTopicGroups(groups => groups.filter(g => g.id !== groupId));
    setDeleteConfirm(null);
  }

  function saveGroupEdit(groupId: string) {
    const name = editGroupName.trim();
    setEditingGroupId(null);
    if (!name) return;
    updateTopicGroups(groups =>
      groups.map(g => (g.id === groupId ? { ...g, name } : g))
    );
  }

  function toggleGroupCollapse(groupId: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  // ---- Topic CRUD ----
  function addTopicToGroup(groupId: string) {
    const name = (newTopicInputs[groupId] || '').trim();
    if (!name) return;
    updateTopicGroups(groups =>
      groups.map(g => (g.id === groupId ? { ...g, topics: [...g.topics, createTopic(name)] } : g))
    );
    setNewTopicInputs(prev => ({ ...prev, [groupId]: '' }));
  }

  function addBulkTopicsToGroup(groupId: string) {
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
  }

  function removeTopic(groupId: string, topicId: string) {
    updateTopicGroups(groups =>
      groups.map(g => (g.id === groupId ? { ...g, topics: g.topics.filter(t => t.id !== topicId) } : g))
    );
    setDeleteConfirm(null);
  }

  function updateTopicInGroup(groupId: string, topicId: string, changes: Partial<Topic>) {
    updateTopicGroups(groups =>
      groups.map(g =>
        g.id === groupId
          ? { ...g, topics: g.topics.map(t => (t.id === topicId ? { ...t, ...changes } : t)) }
          : g
      )
    );
  }

  // Generic update handler for FSRS widget (takes subjectId too)
  function handleFsrsUpdate(_subjectId: string, groupId: string, topicId: string, changes: Partial<Topic>) {
    updateTopicInGroup(groupId, topicId, changes);
  }

  function toggleStudied(groupId: string, topicId: string) {
    const group = subject.topicGroups.find(g => g.id === groupId);
    const topic = group?.topics.find(t => t.id === topicId);
    if (!topic) return;
    updateTopicInGroup(groupId, topicId, {
      studied: !topic.studied,
      dateStudied: !topic.studied ? new Date().toISOString() : null,
    });
  }

  function setPriority(groupId: string, topicId: string, priority: Priority | null) {
    updateTopicInGroup(groupId, topicId, { priority });
    setPriorityMenuTopic(null);
  }

  function startTopicEdit(topic: Topic) {
    setEditingTopicId(topic.id);
    setEditTopicName(topic.name);
  }

  function saveTopicEdit(groupId: string, topicId: string) {
    const trimmedName = editTopicName.trim();
    if (trimmedName) {
      updateTopicInGroup(groupId, topicId, { name: trimmedName });
    }
    setEditingTopicId(null);
  }

  function cancelTopicEdit() {
    setEditingTopicId(null);
  }

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
  function filterTopics(topics: Topic[]): Topic[] {
    return topics.filter(t => {
      if (statusFilter === 'studied' && !t.studied) return false;
      if (statusFilter === 'pending' && t.studied) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      return true;
    });
  }

  // ---- Stats ----
  const pendingHighPriority = allTopics.filter(t => !t.studied && t.priority === 'alta').length;
  const overdueCount = allTopics.filter(t => {
    if (!t.deadline || t.studied) return false;
    const info = getDeadlineInfo(t.deadline);
    return info?.urgency === 'overdue';
  }).length;
  const reviewsDueCount = allTopics.filter(t => isReviewDue(t.fsrsNextReview)).length;
  const pendingTopicsCount = allTopics.filter(t => !t.studied).length;

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div
        className="rounded-2xl p-6 text-white shadow-xl relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${subject.color}, ${subject.color}dd)` }}
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzEuNjU3IDAgMy0xLjM0MyAzLTNzLTEuMzQzLTMtMy0zLTMgMS4zNDMtMyAzIDEuMzQzIDMgMyAzem0wIDMwYzEuNjU3IDAgMy0xLjM0MyAzLTNzLTEuMzQzLTMtMy0zLTMgMS4zNDMtMyAzIDEuMzQzIDMgMyAzem0tMTgtMTVjMS42NTcgMCAzLTEuMzQzIDMtM3MtMS4zNDMtMy0zLTMtMyAxLjM0My0zIDMgMS4zNDMgMyAzIDN6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        <div className="relative">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-3 transition-colors text-sm"
          >
            <ArrowLeft size={18} /> Voltar para Visao Geral
          </button>
          <h1 className="text-2xl md:text-3xl font-bold">
            {subject.emoji} {subject.name}
          </h1>
          <p className="text-white/70 mt-1 text-sm">
            Gerencie topicos, assuntos, prioridades, prazos e revisoes
          </p>
          {/* Alerts */}
          <div className="flex flex-wrap gap-2 mt-3">
            {pendingHighPriority > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/20 text-white text-xs font-medium">
                {"\u{1F534}"} {pendingHighPriority} prioridade{pendingHighPriority > 1 ? 's' : ''} alta{pendingHighPriority > 1 ? 's' : ''}
              </span>
            )}
            {overdueCount > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500/20 text-white text-xs font-medium">
                {"\u26A0\uFE0F"} {overdueCount} prazo{overdueCount > 1 ? 's' : ''} vencido{overdueCount > 1 ? 's' : ''}
              </span>
            )}
            {reviewsDueCount > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-500/20 text-white text-xs font-medium">
                {"\u{1F9E0}"} {reviewsDueCount} revisao(oes) pendente(s)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: '\u{1F4DA} Estudados', value: stats.studied },
          { label: '\u{1F4CB} Total', value: stats.total },
          { label: '\u{1F4C1} Topicos', value: subject.topicGroups.length },
          { label: '\u{1F4DD} Questoes', value: stats.questionsTotal },
          { label: '\u{1F4CA} Rendimento', value: formatPercent(stats.rendimento) },
          { label: '\u{1F9E0} Revisoes', value: stats.reviewsDue > 0 ? `${stats.reviewsDue} \u{1F514}` : '0' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-xs text-gray-500 font-medium mb-1">{card.label}</p>
            <p className="text-2xl font-bold" style={{ color: subject.color }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-600">Progresso Geral</span>
          <span className="text-sm font-bold" style={{ color: subject.color }}>{formatPercent(stats.progresso)}</span>
        </div>
        <ProgressBar value={stats.progresso} color={subject.color} />
        <p className="text-xs text-gray-400 mt-2 text-center italic">
          {stats.studied} de {stats.total} conteudos estudados
        </p>
      </div>

      {/* Add Topic Group */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <FolderPlus size={18} style={{ color: subject.color }} />
          Adicionar Topico
        </h3>
        <p className="text-xs text-gray-500">
          Crie topicos para organizar seus assuntos (ex: "Matematica Basica", "Geometria", "Algebra")
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addGroup()}
            placeholder='Nome do topico (ex: "Matematica Basica")'
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
            style={getRingColorStyle(subject.color)}
          />
          <button
            onClick={addGroup}
            className="px-5 py-2.5 rounded-lg text-white font-medium text-sm hover:opacity-90 transition-opacity shrink-0 flex items-center gap-2"
            style={{ backgroundColor: subject.color }}
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Criar</span>
          </button>
        </div>

        {/* Structured Import */}
        <button
          onClick={() => setShowStructuredImport(!showStructuredImport)}
          className="text-sm hover:underline transition-colors flex items-center gap-1"
          style={{ color: subject.color }}
        >
          {showStructuredImport ? 'Fechar importacao' : '\u{1F4CB} Importar estrutura completa (topicos + assuntos)'}
        </button>

        {showStructuredImport && (
          <div className="space-y-2 bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-600">
              Use <code className="bg-gray-200 px-1 rounded">#</code> para criar topicos e linhas simples para assuntos:
            </p>
            <textarea
              value={structuredImportText}
              onChange={e => setStructuredImportText(e.target.value)}
              placeholder={`# Matematica Basica\nQuatro operacoes\nFracoes\nPotenciacao\n\n# Geometria\nAreas\nVolumes\nTriangulos`}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent h-40 resize-y font-mono"
              style={getRingColorStyle(subject.color)}
            />
            <button
              onClick={handleStructuredImport}
              className="px-5 py-2.5 rounded-lg text-white font-medium text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
              style={{ backgroundColor: subject.color }}
            >
              <Plus size={16} /> Importar Tudo
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      {allTopics.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mr-1">Status:</span>
          {[
            { key: 'all' as const, label: `Todos (${allTopics.length})` },
            { key: 'pending' as const, label: `Pendentes (${pendingTopicsCount})` },
            { key: 'studied' as const, label: `Estudados (${stats.studied})` },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === f.key
                  ? 'text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={statusFilter === f.key ? { backgroundColor: subject.color } : undefined}
            >
              {f.label}
            </button>
          ))}

          <span className="text-gray-300 mx-1">|</span>

          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mr-1">Prioridade:</span>
          <button
            onClick={() => setPriorityFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              priorityFilter === 'all' ? 'text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={priorityFilter === 'all' ? { backgroundColor: subject.color } : undefined}
          >
            Todas
          </button>
          {PRIORITY_OPTIONS.map(p => {
            const config = PRIORITY_CONFIG[p];
            return (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  priorityFilter === p
                    ? `${config.bg} ${config.color} ring-2 ${config.ring}`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {config.emoji} {config.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Topic Groups */}
      {subject.topicGroups.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <FolderPlus size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium mb-1">Nenhum topico criado ainda</p>
          <p className="text-gray-400 text-sm">
            Crie topicos acima para organizar seus assuntos de estudo.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {subject.topicGroups.map((group) => {
            const filtered = filterTopics(group.topics);
            const groupStats = getGroupStats(group);
            const isCollapsed = collapsedGroups.has(group.id);
            const hasActiveFilter = statusFilter !== 'all' || priorityFilter !== 'all';
            const hasFilteredContent = filtered.length > 0 || !hasActiveFilter;

            if (!hasFilteredContent && group.topics.length > 0) return null;

            return (
              <div key={group.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Group Header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{ borderLeft: `4px solid ${subject.color}` }}
                  onClick={() => toggleGroupCollapse(group.id)}
                >
                  <button className="text-gray-400 shrink-0">
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                  </button>

                  {editingGroupId === group.id ? (
                    <div className="flex-1 flex gap-2 items-center" onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editGroupName}
                        onChange={e => setEditGroupName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveGroupEdit(group.id); if (e.key === 'Escape') setEditingGroupId(null); }}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
                        style={getRingColorStyle(subject.color)}
                        autoFocus
                      />
                      <button onClick={() => saveGroupEdit(group.id)} className="text-green-600 hover:text-green-700"><Save size={16} /></button>
                      <button onClick={() => setEditingGroupId(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-800">{"\u{1F4C1}"} {group.name}</span>
                          <span className="text-xs text-gray-400">
                            {groupStats.studied}/{groupStats.total} estudados
                          </span>
                          {groupStats.total > 0 && (
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: subject.color + '15', color: subject.color }}
                            >
                              {formatPercent(groupStats.progresso)}
                            </span>
                          )}
                          {groupStats.reviewsDue > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium flex items-center gap-1">
                              <Brain size={10} /> {groupStats.reviewsDue} revisao(oes)
                            </span>
                          )}
                        </div>
                        {groupStats.total > 0 && (
                          <div className="mt-1.5 max-w-xs">
                            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${groupStats.progresso * 100}%`, backgroundColor: subject.color }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Group Actions */}
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => { setEditingGroupId(group.id); setEditGroupName(group.name); }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
                          title="Renomear topico"
                        >
                          <Edit3 size={14} />
                        </button>
                        {deleteConfirm === `group-${group.id}` ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => removeGroup(group.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Check size={14} /></button>
                            <button onClick={() => setDeleteConfirm(null)} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg"><X size={14} /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(`group-${group.id}`)}
                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                            title="Excluir topico"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Group Content (when expanded) */}
                {!isCollapsed && (
                  <div className="border-t border-gray-100">
                    {/* Add topic to group */}
                    <div className="px-4 py-3 bg-gray-50/50 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newTopicInputs[group.id] || ''}
                          onChange={e => setNewTopicInputs(prev => ({ ...prev, [group.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && addTopicToGroup(group.id)}
                          placeholder="Adicionar assunto..."
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-white"
                          style={getRingColorStyle(subject.color)}
                        />
                        <button
                          onClick={() => addTopicToGroup(group.id)}
                          className="px-3 py-2 rounded-lg text-white text-sm hover:opacity-90 transition-opacity shrink-0"
                          style={{ backgroundColor: subject.color }}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <button
                        onClick={() => setShowBulkAdd(showBulkAdd === group.id ? null : group.id)}
                        className="text-xs hover:underline transition-colors"
                        style={{ color: subject.color }}
                      >
                        {showBulkAdd === group.id ? 'Fechar' : '\u{1F4CB} Adicionar varios assuntos'}
                      </button>
                      {showBulkAdd === group.id && (
                        <div className="space-y-2">
                          <textarea
                            value={bulkInputs[group.id] || ''}
                            onChange={e => setBulkInputs(prev => ({ ...prev, [group.id]: e.target.value }))}
                            placeholder={"Um assunto por linha:\nQuatro operacoes\nFracoes\nPotenciacao"}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent h-28 resize-y bg-white"
                            style={getRingColorStyle(subject.color)}
                          />
                          <button
                            onClick={() => addBulkTopicsToGroup(group.id)}
                            className="px-4 py-2 rounded-lg text-white text-sm hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: subject.color }}
                          >
                            Adicionar Todos
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Topics List */}
                    {filtered.length === 0 && group.topics.length > 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-400">
                        Nenhum assunto corresponde ao filtro selecionado.
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-400">
                        <BookOpen size={24} className="mx-auto mb-2 text-gray-300" />
                        Nenhum assunto adicionado neste topico ainda.
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {filtered.map((topic, index) => (
                          <TopicRow
                            key={topic.id}
                            topic={topic}
                            index={index}
                            groupId={group.id}
                            subjectId={subject.id}
                            subjectColor={subject.color}
                            fsrsConfig={fsrsConfig}
                            editingTopicId={editingTopicId}
                            editTopicName={editTopicName}
                            deleteConfirm={deleteConfirm}
                            priorityMenuTopic={priorityMenuTopic}
                            onToggleStudied={toggleStudied}
                            onUpdateTopic={updateTopicInGroup}
                            onFsrsUpdate={handleFsrsUpdate}
                            onRemoveTopic={removeTopic}
                            onStartEdit={startTopicEdit}
                            onSaveEdit={saveTopicEdit}
                            onCancelEdit={cancelTopicEdit}
                            onSetEditName={setEditTopicName}
                            onSetDeleteConfirm={setDeleteConfirm}
                            onSetPriority={setPriority}
                            onTogglePriorityMenu={setPriorityMenuTopic}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {allTopics.length > 0 && (
        <div
          className="rounded-xl p-4 text-white text-center text-sm font-medium"
          style={{ backgroundColor: subject.color }}
        >
          {stats.studied} de {stats.total} conteudos estudados | {stats.questionsTotal} questoes feitas | {formatPercent(stats.rendimento)} de rendimento
          {stats.reviewsDue > 0 && ` | \u{1F9E0} ${stats.reviewsDue} revisao(oes) pendente(s)`}
        </div>
      )}
    </div>
  );
}

// ---- TopicRow sub-component ----
interface TopicRowProps {
  topic: Topic;
  index: number;
  groupId: string;
  subjectId: string;
  subjectColor: string;
  fsrsConfig: FSRSConfig;
  editingTopicId: string | null;
  editTopicName: string;
  deleteConfirm: string | null;
  priorityMenuTopic: string | null;
  onToggleStudied: (groupId: string, topicId: string) => void;
  onUpdateTopic: (groupId: string, topicId: string, changes: Partial<Topic>) => void;
  onFsrsUpdate: (subjectId: string, groupId: string, topicId: string, changes: Partial<Topic>) => void;
  onRemoveTopic: (groupId: string, topicId: string) => void;
  onStartEdit: (topic: Topic) => void;
  onSaveEdit: (groupId: string, topicId: string) => void;
  onCancelEdit: () => void;
  onSetEditName: (name: string) => void;
  onSetDeleteConfirm: (id: string | null) => void;
  onSetPriority: (groupId: string, topicId: string, priority: Priority | null) => void;
  onTogglePriorityMenu: (id: string | null) => void;
}

function TopicRow({
  topic, index, groupId, subjectId, subjectColor, fsrsConfig,
  editingTopicId, editTopicName, deleteConfirm, priorityMenuTopic,
  onToggleStudied, onUpdateTopic, onFsrsUpdate, onRemoveTopic,
  onStartEdit, onSaveEdit, onCancelEdit, onSetEditName,
  onSetDeleteConfirm, onSetPriority, onTogglePriorityMenu,
}: TopicRowProps) {
  const isEditing = editingTopicId === topic.id;
  const showPriorityMenu = priorityMenuTopic === topic.id;
  const reviewStatus = getReviewStatus(topic.fsrsNextReview);
  const isDue = isReviewDue(topic.fsrsNextReview);
  const accuracy = topic.questionsTotal > 0 ? topic.questionsCorrect / topic.questionsTotal : 0;

  return (
    <div className={`px-4 py-3 transition-all ${topic.studied ? 'bg-green-50/30' : 'hover:bg-gray-50/50'} ${isDue ? 'border-l-2 border-l-purple-400' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onToggleStudied(groupId, topic.id)}
          className={`mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
            topic.studied
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          {topic.studied && <Check size={14} />}
        </button>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Row 1: Name + badges */}
          {isEditing ? (
            <div className="flex gap-2 items-center mb-2">
              <input
                type="text"
                value={editTopicName}
                onChange={e => onSetEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(groupId, topic.id); if (e.key === 'Escape') onCancelEdit(); }}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
                style={getRingColorStyle(subjectColor)}
                autoFocus
              />
              <button onClick={() => onSaveEdit(groupId, topic.id)} className="text-green-600 hover:text-green-700"><Save size={16} /></button>
              <button onClick={onCancelEdit} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-mono text-gray-400 w-5">{index + 1}.</span>
              <span className={`font-medium text-sm ${topic.studied ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                {topic.name}
              </span>
              {topic.studied && (
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                  {"\u2713"} Estudado
                </span>
              )}

              {/* Priority badge */}
              <div className="relative">
                <PriorityBadge
                  priority={topic.priority}
                  onClick={() => onTogglePriorityMenu(showPriorityMenu ? null : topic.id)}
                  size="xs"
                />
                {showPriorityMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => onTogglePriorityMenu(null)} />
                    <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]">
                      {PRIORITY_OPTIONS.map(p => {
                        const config = PRIORITY_CONFIG[p];
                        return (
                          <button
                            key={p}
                            onClick={() => onSetPriority(groupId, topic.id, p)}
                            className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 flex items-center gap-2 ${
                              topic.priority === p ? 'font-bold' : ''
                            }`}
                          >
                            <span>{config.emoji}</span>
                            <span>{config.label}</span>
                            {topic.priority === p && <Check size={12} className="ml-auto text-green-600" />}
                          </button>
                        );
                      })}
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button
                          onClick={() => onSetPriority(groupId, topic.id, null)}
                          className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 text-gray-500"
                        >
                          Remover prioridade
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Deadline badge */}
              <DeadlineBadge deadline={topic.deadline} size="xs" />

              {/* FSRS Review badge */}
              {topic.reviewHistory.length > 0 && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${reviewStatus.className}`}>
                  <Brain size={10} />
                  {reviewStatus.text}
                </span>
              )}
            </div>
          )}

          {/* Row 2: Questions + Deadline + Date studied */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500">Questoes:</label>
              <input
                type="number"
                min="0"
                value={topic.questionsTotal || ''}
                onChange={e => {
                  const nextTotal = parseNonNegativeInt(e.target.value);
                  onUpdateTopic(groupId, topic.id, {
                    questionsTotal: nextTotal,
                    questionsCorrect: Math.min(topic.questionsCorrect, nextTotal),
                  });
                }}
                className="w-14 border border-gray-200 rounded-md px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 bg-white"
                style={getRingColorStyle(subjectColor)}
                placeholder="0"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500">Acertos:</label>
              <input
                type="number"
                min="0"
                max={topic.questionsTotal}
                value={topic.questionsCorrect || ''}
                onChange={e => onUpdateTopic(groupId, topic.id, {
                  questionsCorrect: Math.min(parseNonNegativeInt(e.target.value), topic.questionsTotal),
                })}
                className="w-14 border border-gray-200 rounded-md px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 bg-white"
                style={getRingColorStyle(subjectColor)}
                placeholder="0"
              />
            </div>
            {topic.questionsTotal > 0 && (
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  accuracy >= 0.7
                    ? 'bg-green-100 text-green-700'
                    : accuracy >= 0.5
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {formatPercent(accuracy)}
              </span>
            )}

            <span className="text-gray-200">|</span>

            {/* Deadline input */}
            <div className="flex items-center gap-1.5">
              <Calendar size={12} className="text-gray-400" />
              <label className="text-xs text-gray-500">Prazo:</label>
              <input
                type="date"
                value={topic.deadline || ''}
                onChange={e => onUpdateTopic(groupId, topic.id, { deadline: e.target.value || null })}
                className="border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 bg-white"
                style={getRingColorStyle(subjectColor)}
              />
            </div>

            {topic.dateStudied && (
              <>
                <span className="text-gray-200">|</span>
                <span className="text-xs text-gray-400">
                  {"\u{1F4C5}"} Estudado: {new Date(topic.dateStudied).toLocaleDateString('pt-BR')}
                </span>
              </>
            )}
          </div>

          {/* Row 3: Notes */}
          <div className="mt-2">
            <input
              type="text"
              value={topic.notes}
              onChange={e => onUpdateTopic(groupId, topic.id, { notes: e.target.value })}
              placeholder="\u{1F4DD} Anotacoes..."
              className="w-full border-0 border-b border-gray-200 text-xs text-gray-500 py-1 focus:outline-none focus:border-gray-400 bg-transparent placeholder-gray-300"
            />
          </div>

          {/* Row 4: FSRS Review Widget */}
          {topic.studied && (
            <TopicReviewWidget
              topic={topic}
              groupId={groupId}
              subjectId={subjectId}
              subjectColor={subjectColor}
              fsrsConfig={fsrsConfig}
              onUpdate={onFsrsUpdate}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onStartEdit(topic)}
            className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
            title="Editar nome"
          >
            <Edit3 size={14} />
          </button>
          {deleteConfirm === `topic-${topic.id}` ? (
            <div className="flex items-center gap-1">
              <button onClick={() => onRemoveTopic(groupId, topic.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Check size={14} /></button>
              <button onClick={() => onSetDeleteConfirm(null)} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg"><X size={14} /></button>
            </div>
          ) : (
            <button
              onClick={() => onSetDeleteConfirm(`topic-${topic.id}`)}
              className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
              title="Excluir assunto"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
