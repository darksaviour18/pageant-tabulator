import { useRef, useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function AnimatedTabs({ tabs, activeTab, onChange, className = '' }) {
  const { isDark } = useTheme();
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

  const baseClasses = `relative flex gap-1 ${isDark ? 'bg-zinc-800' : 'bg-slate-100'} rounded-lg p-1`;
  const tabClasses = (isActive) =>
    `relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
      isActive
        ? isDark
          ? 'text-zinc-100'
          : 'text-slate-900'
        : isDark
        ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
    }`;

  return (
    <nav className={`${baseClasses} ${className}`} role="tablist">
      <div
        className="absolute h-8 bg-white dark:bg-zinc-700 rounded-md shadow-sm transition-all duration-200 ease-out"
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