import { useEffect, useState, type ReactNode } from 'react';
import {
  LayoutGrid,
  List,
  Table,
  ChevronsDownUp,
  ChevronsUpDown,
  Search,
  X,
  Sparkles,
  TrendingUp,
  Clock,
  CheckCircle2,
  Circle,
  Flame,
  Zap,
  Leaf,
  Tag,
  SlidersHorizontal,
  Eye,
  ChevronDown,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Priority } from '../../types';
import { cn } from '../../utils/cn';

type StatusFilter = 'all' | 'studied' | 'pending';
type ViewMode = 'cards' | 'grid' | 'table' | 'groups';
export type SortOption = 'name' | 'priority' | 'date' | 'progress';

interface SubjectFiltersProps {
  allTopicsCount: number;
  pendingTopicsCount: number;
  studiedCount: number;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  priorityFilter: Priority | 'all';
  onPriorityFilterChange: (value: Priority | 'all') => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
  allAvailableTags: string[];
  viewMode: ViewMode;
  onViewModeChange: (value: ViewMode) => void;
  onCollapseAllGroups: () => void;
  onExpandAllGroups: () => void;
  filteredTopicCount: number;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  sortBy?: SortOption;
  onSortChange?: (value: SortOption) => void;
}

interface FilterChipProps {
  active: boolean;
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  count?: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

function FilterChip({ active, label, onClick, icon, count, variant = 'default' }: FilterChipProps) {
  const variantStyles = {
    default: active
      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-200/50 dark:shadow-indigo-900/30'
      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700',
    success: active
      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/30'
      : 'bg-white text-slate-600 hover:bg-emerald-50 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700',
    warning: active
      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-200/50 dark:shadow-amber-900/30'
      : 'bg-white text-slate-600 hover:bg-amber-50 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700',
    danger: active
      ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-200/50 dark:shadow-rose-900/30'
      : 'bg-white text-slate-600 hover:bg-rose-50 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700',
  };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'h-9 rounded-xl px-4 text-sm font-medium transition-all duration-200 flex items-center gap-2',
        variantStyles[variant],
      )}
    >
      {icon && <span className="opacity-80">{icon}</span>}
      <span>{label}</span>
      {count !== undefined && (
        <span className={cn(
          'ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
          active
            ? 'bg-white/20 text-white'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
        )}>
          {count}
        </span>
      )}
    </motion.button>
  );
}

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
}

function ToggleButton({ active, onClick, icon, title }: ToggleButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      title={title}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'h-10 w-10 rounded-xl transition-all duration-200 flex items-center justify-center',
        active
          ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-200/50 dark:shadow-indigo-900/30'
          : 'bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 dark:hover:bg-slate-700',
      )}
    >
      {icon}
    </motion.button>
  );
}

interface IconButtonProps {
  onClick: () => void;
  icon: ReactNode;
  title: string;
}

function IconButton({ onClick, icon, title }: IconButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      title={title}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="h-10 w-10 rounded-xl transition-all duration-200 flex items-center justify-center border bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
    >
      {icon}
    </motion.button>
  );
}

interface FilterSectionProps {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

function FilterSection({ label, icon, children, defaultOpen = true }: FilterSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full group"
      >
        <div className="flex items-center gap-2 flex-1">
          <span className="text-slate-400 dark:text-slate-500">{icon}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-slate-400 group-hover:text-slate-600 dark:text-slate-500"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="flex items-center gap-3 flex-1">
      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 min-w-[3rem] text-right">
        {percentage.toFixed(0)}%
      </span>
    </div>
  );
}

export function SubjectFilters({
  allTopicsCount,
  pendingTopicsCount,
  studiedCount,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  tagFilter,
  onTagFilterChange,
  allAvailableTags,
  viewMode,
  onViewModeChange,
  onCollapseAllGroups,
  onExpandAllGroups,
  filteredTopicCount,
  searchQuery = '',
  onSearchChange,
  sortBy = 'name',
  onSortChange,
}: SubjectFiltersProps) {
  const activeFilterCount = Number(statusFilter !== 'all') + Number(priorityFilter !== 'all') + Number(tagFilter !== 'all');
  const [showFilterPanel, setShowFilterPanel] = useState(activeFilterCount > 0);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    if (activeFilterCount > 0) setShowFilterPanel(true);
  }, [activeFilterCount]);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onSearchChange?.(localSearch);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  if (allTopicsCount === 0) return null;

  const clearAllFilters = () => {
    onStatusFilterChange('all');
    onPriorityFilterChange('all');
    onTagFilterChange('all');
    setLocalSearch('');
    onSearchChange?.('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-slate-200/70 bg-white/65 backdrop-blur-2xl shadow-2xl shadow-slate-300/35 ring-1 ring-white/70 dark:border-slate-700/70 dark:bg-slate-900/70 dark:shadow-slate-950/45 dark:ring-slate-700/50 overflow-hidden"
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 max-w-xl">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
              <input
                type="text"
                value={localSearch}
                onChange={event => setLocalSearch(event.target.value)}
                placeholder="Buscar assuntos, tags ou descricoes..."
                className="w-full h-12 pl-12 pr-12 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-700 placeholder-slate-400 transition-all duration-200 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:border-indigo-600 dark:focus:ring-indigo-900/30"
              />
              {localSearch && (
                <button
                  onClick={() => {
                    setLocalSearch('');
                    onSearchChange?.('');
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <motion.button
              type="button"
              onClick={() => setShowFilterPanel(prev => !prev)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'inline-flex h-11 items-center gap-2.5 rounded-xl px-4 text-sm font-medium transition-all duration-200 border',
                showFilterPanel
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-transparent shadow-lg shadow-indigo-200/50 dark:shadow-indigo-900/30'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700',
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filtros</span>
              {activeFilterCount > 0 && (
                <span className={cn(
                  'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                  showFilterPanel
                    ? 'bg-white/20 text-white'
                    : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300',
                )}>
                  {activeFilterCount}
                </span>
              )}
            </motion.button>

            {activeFilterCount > 0 && (
              <motion.button
                type="button"
                onClick={clearAllFilters}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-900/20"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Limpar</span>
              </motion.button>
            )}

            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

            <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80">
              <ToggleButton
                active={viewMode === 'groups'}
                onClick={() => onViewModeChange('groups')}
                icon={<FolderOpen className="h-4 w-4" />}
                title="Cartoes de grupos"
              />
              <ToggleButton
                active={viewMode === 'cards'}
                onClick={() => onViewModeChange('cards')}
                icon={<List className="h-4 w-4" />}
                title="Lista"
              />
              <ToggleButton
                active={viewMode === 'grid'}
                onClick={() => onViewModeChange('grid')}
                icon={<LayoutGrid className="h-4 w-4" />}
                title="Grade"
              />
              <ToggleButton
                active={viewMode === 'table'}
                onClick={() => onViewModeChange('table')}
                icon={<Table className="h-4 w-4" />}
                title="Tabela"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <IconButton
                onClick={onCollapseAllGroups}
                icon={<ChevronsDownUp className="h-4 w-4" />}
                title="Minimizar todos"
              />
              <IconButton
                onClick={onExpandAllGroups}
                icon={<ChevronsUpDown className="h-4 w-4" />}
                title="Expandir todos"
              />
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showFilterPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 sm:px-6 pb-5 sm:pb-6 border-t border-slate-100 dark:border-slate-800 pt-5">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <FilterSection
                  label="Status"
                  icon={<Eye className="h-4 w-4" />}
                >
                  <FilterChip
                    active={statusFilter === 'all'}
                    label="Todos"
                    count={allTopicsCount}
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                    onClick={() => onStatusFilterChange('all')}
                  />
                  <FilterChip
                    active={statusFilter === 'pending'}
                    label="Pendentes"
                    count={pendingTopicsCount}
                    icon={<Circle className="h-3.5 w-3.5" />}
                    onClick={() => onStatusFilterChange('pending')}
                    variant="warning"
                  />
                  <FilterChip
                    active={statusFilter === 'studied'}
                    label="Estudados"
                    count={studiedCount}
                    icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                    onClick={() => onStatusFilterChange('studied')}
                    variant="success"
                  />
                </FilterSection>

                <FilterSection
                  label="Prioridade"
                  icon={<TrendingUp className="h-4 w-4" />}
                >
                  <FilterChip
                    active={priorityFilter === 'all'}
                    label="Todas"
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                    onClick={() => onPriorityFilterChange('all')}
                  />
                  <FilterChip
                    active={priorityFilter === 'alta'}
                    label="Alta"
                    icon={<Flame className="h-3.5 w-3.5" />}
                    onClick={() => onPriorityFilterChange('alta')}
                    variant="danger"
                  />
                  <FilterChip
                    active={priorityFilter === 'media'}
                    label="Media"
                    icon={<Zap className="h-3.5 w-3.5" />}
                    onClick={() => onPriorityFilterChange('media')}
                    variant="warning"
                  />
                  <FilterChip
                    active={priorityFilter === 'baixa'}
                    label="Baixa"
                    icon={<Leaf className="h-3.5 w-3.5" />}
                    onClick={() => onPriorityFilterChange('baixa')}
                    variant="success"
                  />
                </FilterSection>

                <FilterSection
                  label="Tags"
                  icon={<Tag className="h-4 w-4" />}
                  defaultOpen={allAvailableTags.length <= 6}
                >
                  <FilterChip
                    active={tagFilter === 'all'}
                    label="Todas"
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                    onClick={() => onTagFilterChange('all')}
                  />
                  {allAvailableTags.map(tag => (
                    <FilterChip
                      key={`tag-filter-${tag}`}
                      active={tagFilter === tag}
                      label={`#${tag}`}
                      onClick={() => onTagFilterChange(tag)}
                    />
                  ))}
                </FilterSection>

                {onSortChange && (
                  <FilterSection
                    label="Ordenar por"
                    icon={<Clock className="h-4 w-4" />}
                  >
                    <FilterChip
                      active={sortBy === 'name'}
                      label="Nome"
                      onClick={() => onSortChange('name')}
                    />
                    <FilterChip
                      active={sortBy === 'priority'}
                      label="Prioridade"
                      onClick={() => onSortChange('priority')}
                    />
                    <FilterChip
                      active={sortBy === 'date'}
                      label="Data"
                      onClick={() => onSortChange('date')}
                    />
                    <FilterChip
                      active={sortBy === 'progress'}
                      label="Progresso"
                      onClick={() => onSortChange('progress')}
                    />
                  </FilterSection>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 border-t border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-bold text-slate-800 dark:text-slate-200">{filteredTopicCount}</span>
                <span className="mx-1.5 text-slate-400">de</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{allTopicsCount}</span>
                <span className="ml-1.5">assuntos</span>
              </p>
            </div>

            <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="font-medium">{studiedCount} concluidos</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <Circle className="h-3.5 w-3.5" />
                <span className="font-medium">{pendingTopicsCount} pendentes</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 min-w-[200px]">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Progresso</span>
            <ProgressBar value={studiedCount} max={allTopicsCount} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
