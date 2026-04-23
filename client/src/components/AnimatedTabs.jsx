import { useRef, useState, useEffect } from 'react';

export default function AnimatedTabs({ tabs, activeTab, onChange, className = '' }) {
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const tabRefs = useRef({});

  useEffect(() => {
    const activeEl = tabRefs.current[activeTab];
    if (activeEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
      });
    }
  }, [activeTab]);

  const baseClasses = `relative flex gap-1 bg-[var(--bg-secondary)] rounded-lg p-1`;
  const tabClasses = (isActive) =>
    `relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
      isActive
        ? 'text-[var(--text-primary)]'
        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
    }`;

  return (
    <nav className={`${baseClasses} ${className}`} role="tablist">
      <div
        className="absolute h-8 bg-[var(--bg-primary)] rounded-md shadow-sm transition-all duration-200 ease-out"
        style={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
          top: 4,
        }}
        aria-hidden="true"
      />
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => (tabRefs.current[tab.id] = el)}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={tabClasses(isActive)}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}