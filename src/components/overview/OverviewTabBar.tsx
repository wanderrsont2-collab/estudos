import type { LucideIcon } from 'lucide-react';
import type { OverviewTab } from './types';

interface OverviewTabBarProps {
  tabs: Array<{ id: OverviewTab; label: string; icon: LucideIcon }>;
  active: OverviewTab;
  onChange: (tab: OverviewTab) => void;
}

export function OverviewTabBar({ tabs, active, onChange }: OverviewTabBarProps) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-1.5 flex flex-wrap gap-1 shadow-sm">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={`overview-tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all duration-200 ${
              isActive
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Icon size={14} /> {tab.label}
          </button>
        );
      })}
    </div>
  );
}
