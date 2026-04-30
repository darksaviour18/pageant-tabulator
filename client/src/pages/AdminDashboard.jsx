import { useState, useCallback, useMemo } from 'react';
import EventSetup from './EventSetup';
import AdminMonitor from './AdminMonitor';
import PrintReport from './PrintReport';
import AuditLogs from './AuditLogs';
import AnimatedTabs from '../components/AnimatedTabs';
import { ClipboardList, BarChart3, Printer, History } from 'lucide-react';
import { useHotkeys, HotkeyHint } from '../hooks/useHotkeys';

const TABS = [
  { id: 'setup', label: 'Setup', icon: ClipboardList },
  { id: 'monitor', label: 'Monitor', icon: BarChart3 },
  { id: 'reports', label: 'Reports', icon: Printer },
  { id: 'audit', label: 'Audit', icon: History },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('setup');

  const cycleTab = useCallback((direction) => {
    const currentIndex = TABS.findIndex(t => t.id === activeTab);
    const nextIndex = (currentIndex + direction + TABS.length) % TABS.length;
    setActiveTab(TABS[nextIndex].id);
  }, [activeTab]);

  const save = useCallback(() => {
    const saveButton = document.querySelector('[data-save-button]');
    if (saveButton) saveButton.click();
  }, []);

  const handlers = useMemo(() => ({
    'j+mod': () => cycleTab(1),
    'k+mod': () => cycleTab(-1),
    's+mod': () => save(),
  }), [cycleTab, save]);

  useHotkeys(handlers, [activeTab]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <AnimatedTabs 
          tabs={TABS} 
          activeTab={activeTab} 
          onChange={setActiveTab}
        />
        <div className="hidden sm:flex items-center gap-2">
          <HotkeyHint keys={['J']} label="Next" />
          <HotkeyHint keys={['K']} label="Prev" />
          <HotkeyHint keys={['Cmd', 'S']} label="Save" />
        </div>
      </div>

      <div role="tabpanel">
        {activeTab === 'setup' && <EventSetup />}
        {activeTab === 'monitor' && <AdminMonitor />}
        {activeTab === 'reports' && <PrintReport />}
        {activeTab === 'audit' && <AuditLogs />}
      </div>
    </div>
  );
}