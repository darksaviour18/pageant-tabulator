import { useState } from 'react';
import EventSetup from './EventSetup';
import AdminMonitor from './AdminMonitor';
import PrintReport from './PrintReport';
import AnimatedTabs from '../components/AnimatedTabs';
import { ClipboardList, BarChart3, Printer } from 'lucide-react';

const TABS = [
  { id: 'setup', label: 'Setup', icon: ClipboardList },
  { id: 'monitor', label: 'Monitor', icon: BarChart3 },
  { id: 'reports', label: 'Reports', icon: Printer },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('setup');

  return (
    <div className="space-y-6">
      <AnimatedTabs 
        tabs={TABS} 
        activeTab={activeTab} 
        onChange={setActiveTab}
      />

      <div role="tabpanel">
        {activeTab === 'setup' && <EventSetup />}
        {activeTab === 'monitor' && <AdminMonitor />}
        {activeTab === 'reports' && <PrintReport />}
      </div>
    </div>
  );
}