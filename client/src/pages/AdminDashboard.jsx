import { useState } from 'react';
import EventSetup from './EventSetup';
import AdminMonitor from './AdminMonitor';
import { ClipboardList, BarChart3 } from 'lucide-react';

const TABS = [
  { id: 'setup', label: 'Setup', icon: ClipboardList },
  { id: 'monitor', label: 'Monitor', icon: BarChart3 },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('setup');

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <nav className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit" role="tablist">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                isActive
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Tab Content */}
      <div role="tabpanel">
        {activeTab === 'setup' && <EventSetup />}
        {activeTab === 'monitor' && <AdminMonitor />}
      </div>
    </div>
  );
}
