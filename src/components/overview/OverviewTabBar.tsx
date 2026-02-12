import type { LucideIcon } from 'lucide-react';
import type { OverviewTab } from './types';

interface OverviewTabBarProps {
  tabs: Array<{ id: OverviewTab; label: string; icon: LucideIcon }>;
  active: OverviewTab;
  onChange: (tab: OverviewTab) => void;
}

export function OverviewTabBar({ tabs, active, onChange }: OverviewTabBarProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 flex flex-wrap gap-1.5">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={`overview-tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`px-3 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
              isActive
                ? 'bg-cyan-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Icon size={14} /> {tab.label}
          </button>
        );
      })}
    </div>
  );
}
