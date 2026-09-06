import Logo from '../assets/icons/logo.svg';

export type TabType = 'schedules' | 'templates' | 'calendar' | 'health' | 'diary' | 'settings';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const tabs = [
    { id: 'schedules', icon: './icons/Doc.png', title: '今日日程' },
    { id: 'templates', icon: './icons/Template.png', title: '日程模板' },
    { id: 'calendar', icon: './icons/Calendar.png', title: '日程日历' },
    { id: 'health', icon: './icons/Clock.png', title: '健康监测' },
    { id: 'diary', icon: './icons/Upload.png', title: '日记生成' },
    { id: 'settings', icon: './icons/Setting.png', title: '个人中心' }
  ];

  return (
    <div className="app-sidebar">
      <div className="app-sidebar-header">
        <img src={Logo} alt="拾光录" style={{ width: '70px', height: 'auto' }} />
      </div>
      <div className="nav-menu">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as TabType)}
            title={tab.title}
          >
            <img src={tab.icon} alt={tab.title} />
          </div>
        ))}
      </div>
      <div style={{ paddingBottom: '2rem', fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 'bold' }}>
        v1.0
      </div>
    </div>
  );
}
