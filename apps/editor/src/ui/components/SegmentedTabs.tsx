import type { LucideIcon } from 'lucide-react';

export interface SegmentedTab<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

interface SegmentedTabsProps<T extends string> {
  tabs: Array<SegmentedTab<T>>;
  activeTab: T;
  onTabChange: (tab: T) => void;
}

export function SegmentedTabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: SegmentedTabsProps<T>) {
  return (
    <div className="right-panel-tabs" role="tablist" aria-label="Tool panels">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={
              activeTab === tab.id
                ? 'panel-tab panel-tab-active ew-focus-ring'
                : 'panel-tab ew-focus-ring'
            }
            type="button"
            onClick={() => onTabChange(tab.id)}
          >
            <Icon size={16} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
