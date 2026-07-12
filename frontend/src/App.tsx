import React, { useState, useEffect } from 'react'
import DiaryPanel from './DiaryPanel'

declare global {
  interface Window {
    api: {
      getSchedules: (date: string) => Promise<any[]>;
      addSchedule: (item: any) => Promise<any>;
      updateSchedule: (item: any) => Promise<any>;
      deleteSchedule: (id: string) => Promise<boolean>;
      getTemplates: () => Promise<any[]>;
      addTemplate: (item: any) => Promise<any>;
      updateTemplate: (item: any) => Promise<any>;
      deleteTemplate: (id: string) => Promise<boolean>;
    }
  }
}

export interface Schedule {
  id?: string;
  templateId?: string;
  date?: string;
  title: string;
  description: string;
  time: string; // "HH:MM"
  type?: string;
  isGenerated?: boolean;
  is_completed?: boolean;
}

export interface Template {
  id?: string;
  title: string;
  description: string;
  time: string;
  ruleType: 'daily' | 'weekly' | 'monthly';
  ruleValue: string;
  type?: string;
}

const SCHEDULE_TYPES = ['工作', '学习', '娱乐', '运动', '其他'];

// --- Basic UI Components ---
const Card: React.FC<{ title?: string, children: React.ReactNode, className?: string, style?: React.CSSProperties }> = ({ title, children, className, style }) => (
  <div className={`card ${className || ''}`} style={style}>
    {title && <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>{title}</h3>}
    {children}
  </div>
);

const Button: React.FC<{ onClick: () => void, children: React.ReactNode, variant?: 'primary'|'secondary', style?: React.CSSProperties }> = ({ onClick, children, variant = 'secondary', style }) => (
  <button className={`btn-${variant}`} onClick={onClick} style={style}>
    {children}
  </button>
);

const Modal: React.FC<{ isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode, style?: React.CSSProperties }> = ({ isOpen, onClose, title, children, style }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={style}>
        <h3 className="tech-heading" style={{ marginBottom: '1.5rem' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
};

export default function App() {
  type TabType = 'schedules' | 'templates' | 'calendar' | 'health' | 'diary' | 'settings';
  const [activeTab, setActiveTab] = useState<TabType>('schedules');
  
  // Schedule state
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [scheduleForm, setScheduleForm] = useState<Schedule>({ title: '', description: '', time: '12:00', type: '工作' });
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, isDanger?: boolean } | null>(null);

  // Template state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateForm, setTemplateForm] = useState<Template>({ title: '', description: '', time: '12:00', ruleType: 'daily', ruleValue: '1', type: '工作' });

  // --- Health Polling & Notification ---
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const notifiedRef = React.useRef({ sedentary: false, eye_care: false });

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('http://localhost:8000/health/status');
        const data = await res.json();
        setHealthStatus(data);

        if (!data.is_suspended) {
          if (data.sedentary.time_left <= 0 && !notifiedRef.current.sedentary) {
            new Notification('健康提醒', { body: data.sedentary.phase === 'sedentary' ? '您已持续坐立，请站起来运动一下吧！' : '运动时间结束，可以坐下啦！' });
            notifiedRef.current.sedentary = true;
          } else if (data.sedentary.time_left > 0) {
            notifiedRef.current.sedentary = false;
          }

          if (data.eye_care.time_left <= 0 && !notifiedRef.current.eye_care) {
            new Notification('用眼提醒', { body: '您已持续看屏幕20分钟，请眺望远方休息20秒！' });
            notifiedRef.current.eye_care = true;
          } else if (data.eye_care.time_left > 0) {
            notifiedRef.current.eye_care = false;
          }
        }
      } catch (e) {}
    };
    if (Notification.permission === 'default') Notification.requestPermission();
    fetchHealth();
    const timer = setInterval(fetchHealth, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Auto Upload & Downgrade Mechanism ---
  useEffect(() => {
    const checkTasks = async () => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const lastHandledDate = localStorage.getItem('last_handled_date') || todayStr;

      // 1. Downgrade Check (If day rolled over and yesterday wasn't handled)
      if (lastHandledDate !== todayStr) {
        try {
          const diaryRes = await fetch(`http://localhost:8000/diary/${lastHandledDate}`);
          const diaryData = await diaryRes.json();
          if (!diaryData.content) {
            const schedulesData = await window.api.getSchedules(lastHandledDate);
            const scheduleText = schedulesData.map(s => s.time + ' ' + s.title).join('\n');
            const statsRes = await fetch('http://localhost:8000/stats');
            const statsData = await statsRes.json();
            const appStatsText = (statsData || []).map((s: any) => s.app_name + ': ' + (s.active_time_seconds || 0) + 's').join('\n');
            
            const downgradeContent = `【保底降级日记 - ${lastHandledDate}】\n\n[日程]\n${scheduleText || '无'}\n\n[应用使用]\n${appStatsText || '无'}\n\n// 自动转储生数据`;
            await fetch('http://localhost:8000/save-diary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: lastHandledDate, content: downgradeContent })
            });
            console.log('Downgrade successful for', lastHandledDate);
          }
          await fetch('http://localhost:8000/reset-stats', { method: 'POST' });
          localStorage.setItem('last_handled_date', todayStr);
        } catch(e) {}
      }

      // 2. Auto Upload Check
      const uploadEnabled = localStorage.getItem('auto_upload_enabled') === 'true';
      const uploadTime = localStorage.getItem('auto_upload_time') || '23:30';
      if (uploadEnabled) {
        const [uh, um] = uploadTime.split(':').map(Number);
        if (now.getHours() > uh || (now.getHours() === uh && now.getMinutes() >= um)) {
           // Should trigger auto upload if today isn't generated
           const diaryRes = await fetch(`http://localhost:8000/diary/${todayStr}`);
           const diaryData = await diaryRes.json();
           if (!diaryData.content) {
             console.log('Triggering auto upload for', todayStr);
             // Silent generate logic could go here
           }
        }
      }
    };
    
    checkTasks();
    const interval = setInterval(checkTasks, 30 * 60 * 1000); // 30 minutes
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'schedules') {
      loadSchedules(date);
    } else {
      loadTemplates();
    }
  }, [date, activeTab]);

  const loadSchedules = async (d: string) => {
    const data = await window.api.getSchedules(d);
    setSchedules(data);
  };

  const loadTemplates = async () => {
    const data = await window.api.getTemplates();
    setTemplates(data);
  };

  const openScheduleModal = (item?: Schedule) => {
    if (item) {
      setEditingSchedule(item);
      setScheduleForm({ ...item, type: item.type || '工作' });
    } else {
      setEditingSchedule(null);
      setScheduleForm({ title: '', description: '', time: '12:00', type: '工作' });
    }
    setIsScheduleModalOpen(true);
  };

  const closeScheduleModal = () => setIsScheduleModalOpen(false);

  const handleSaveSchedule = async () => {
    if (!scheduleForm.title) return;
    const itemToSave = { ...scheduleForm, date };
    if (editingSchedule && editingSchedule.id) {
      await window.api.updateSchedule({ ...itemToSave, id: editingSchedule.id });
    } else {
      await window.api.addSchedule(itemToSave);
    }
    closeScheduleModal();
    loadSchedules(date);
  };

  const handleDeleteSchedule = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: '删除日程',
      message: '确认删除该日程记录吗？此操作不可撤销。',
      onConfirm: async () => {
        await window.api.deleteSchedule(id);
        loadSchedules(date);
        setConfirmModal(null);
      }
    });
  };

  const handleCompleteSchedule = async (s: Schedule) => {
    if (!s.id) return;
    await window.api.updateSchedule({ ...s, is_completed: true });
    loadSchedules(date);
  };

  const openTemplateModal = (item?: Template) => {
    if (item) {
      setEditingTemplate(item);
      setTemplateForm({ ...item, type: item.type || '工作' });
    } else {
      setEditingTemplate(null);
      setTemplateForm({ title: '', description: '', time: '12:00', ruleType: 'daily', ruleValue: '1', type: '工作' });
    }
    setIsTemplateModalOpen(true);
  };

  const closeTemplateModal = () => setIsTemplateModalOpen(false);

  const handleSaveTemplate = async () => {
    if (!templateForm.title) return;
    // Limit to 6 days
    if (templateForm.ruleType !== 'daily') {
      const parts = templateForm.ruleValue.split(',').filter(x=>x);
      if (parts.length > 6) {
        alert("最多只能选择6天！");
        return;
      }
    }
    
    if (editingTemplate && editingTemplate.id) {
      await window.api.updateTemplate({ ...templateForm, id: editingTemplate.id });
    } else {
      await window.api.addTemplate(templateForm);
    }
    closeTemplateModal();
    loadTemplates();
  };

  const handleDeleteTemplate = async (id: string) => {
    setConfirmModal({
        isOpen: true,
        title: '删除规则',
        message: '确认删除该固定规则？（不影响已生成的日程）',
        isDanger: true,
        onConfirm: async () => {
          await window.api.deleteTemplate(id);
          loadTemplates();
          setConfirmModal(null);
        }
      });
  };

  const renderRuleLabel = (tpl: Template) => {
    if (tpl.ruleType === 'daily') return '每天';
    if (tpl.ruleType === 'weekly') {
      const days = ['周日','周一','周二','周三','周四','周五','周六'];
      return `每周 ${tpl.ruleValue.split(',').map(v => days[parseInt(v)]).join(', ')}`;
    }
    if (tpl.ruleType === 'monthly') return `每月 ${tpl.ruleValue} 日`;
    return '自定义规则';
  };

  const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m} 分 ${s < 10 ? '0'+s : s} 秒`;
  };

  const handleHealthControl = async (type: string, action: string) => {
    await fetch('http://localhost:8000/health/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, action })
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg-base)' }}>
      {/* 纯黑机能风标题栏 */}
      <div className="title-bar">
        <div className="title-bar-brand" style={{ display: 'flex', alignItems: 'center' }}>
          <span className="brand-accent" style={{ marginRight: '0.5rem' }}>//</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', fontSize: '10px', lineHeight: 1, fontWeight: 900 }}>
            <span>日</span><span>程</span>
            <span>助</span><span>理</span>
          </div>
        </div>
        <div className="title-bar-controls">
          <button onClick={() => window.ipcRenderer?.send('window-minimize')}>一</button>
          <button className="close" onClick={() => window.ipcRenderer?.send('window-close')}>×</button>
        </div>
      </div>

      <div className="app-layout">
        <aside className="sidebar">
          <nav className="nav-menu">
            <button className={`nav-item ${activeTab === 'schedules' ? 'active' : ''}`} onClick={() => setActiveTab('schedules')}>
              <img src="/data/Calendar.png" alt="icon" className="nav-icon" /> <span>日常日程</span>
            </button>
            <button className={`nav-item ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>
              <img src="/data/Template.png" alt="icon" className="nav-icon" /> <span>固定规则</span>
            </button>
            <button className={`nav-item ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>
              <img src="/data/Calendar.png" alt="icon" className="nav-icon" /> <span>日程日历</span>
            </button>
            <button className={`nav-item ${activeTab === 'health' ? 'active' : ''}`} onClick={() => setActiveTab('health')}>
              <img src="/data/Clock.png" alt="icon" className="nav-icon" /> <span>健康监控</span>
            </button>
            <button className={`nav-item ${activeTab === 'diary' ? 'active' : ''}`} onClick={() => setActiveTab('diary')}>
              <img src="/data/Doc.png" alt="icon" className="nav-icon" /> <span>日记生成</span>
            </button>
            <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              <img src="/data/Setting.png" alt="icon" className="nav-icon" /> <span>个人中心</span>
            </button>
          </nav>
          <div style={{ marginTop: 'auto', padding: '1rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
            v1.0.0
          </div>
        </aside>

        <main className="app-main">
          {confirmModal && confirmModal.isOpen && (
            <Modal 
              isOpen={true} 
              onClose={() => setConfirmModal(null)} 
              title={confirmModal.title}
              style={confirmModal.isDanger ? { border: '2px solid var(--accent-red)' } : {}}
            >
              {confirmModal.isDanger && (
                <div style={{
                  height: '4px', 
                  background: 'repeating-linear-gradient(45deg, #FFC107, #FFC107 10px, #000 10px, #000 20px)',
                  margin: '-2rem -2rem 2rem -2rem'
                }} />
              )}
              <p className="mono-text" style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>
                {confirmModal.message}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <Button variant="secondary" onClick={() => setConfirmModal(null)}>取消</Button>
                <Button 
                  variant="primary" 
                  onClick={confirmModal.onConfirm}
                  style={confirmModal.isDanger ? { backgroundColor: 'var(--accent-red)', color: 'white' } : {}}
                >
                  确认
                </Button>
              </div>
            </Modal>
          )}

          {activeTab === 'schedules' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
                <div>
                  <h2 className="tech-heading" style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>今日日程</h2>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ fontFamily: 'var(--font-mono)' }} />
                  </div>
                </div>
                <Button variant="primary" onClick={() => openScheduleModal()}>[+] 添加记录</Button>
              </div>

              <Card>
                <div className="schedule-grid">
                  {schedules.length === 0 ? <p className="mono-text" style={{color: 'var(--text-dim)'}}>暂无记录</p> : schedules.map(s => (
                    <div key={s.id} className="schedule-item-tech">
                      <div className="schedule-time-block">{s.time}</div>
                      <div className="schedule-content">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <strong style={{ textDecoration: s.is_completed ? 'line-through' : 'none', color: s.is_completed ? 'var(--text-dim)' : 'var(--text-main)' }}>{s.title}</strong>
                          {s.type && (
                            <span style={{ fontSize: '0.75rem', background: '#E9ECEF', color: '#495057', padding: '2px 8px', borderRadius: '12px' }}>
                              {s.type}
                            </span>
                          )}
                          {s.isGenerated && (
                            <span style={{ fontSize: '0.75rem', background: 'var(--accent-yellow)', color: 'black', padding: '2px 6px', fontWeight: 'bold' }}>
                              自动生成
                            </span>
                          )}
                        </div>
                        <p style={{ margin: '0.5rem 0 0', color: 'var(--text-dim)' }}>{s.description}</p>
                      </div>
                      <div className="schedule-actions">
                        <button onClick={() => openScheduleModal(s)} title="编辑">
                          <img src="/data/Edit.png" alt="编辑" />
                        </button>
                        {!s.is_completed && (
                          <button onClick={() => handleCompleteSchedule(s)} title="完成">
                            <img src="/data/Complete.png" alt="完成" />
                          </button>
                        )}
                        <button className="del-btn" onClick={() => handleDeleteSchedule(s.id!)} title="删除">
                          <img src="/data/Delete.png" alt="删除" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'templates' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
                <div>
                  <h2 className="tech-heading" style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>固定规则</h2>
                  <p className="mono-text" style={{ color: 'var(--text-dim)' }}>定期自动生成日常任务</p>
                </div>
                <Button variant="primary" onClick={() => openTemplateModal()}>[+] 新建规则</Button>
              </div>
              <Card>
                <div className="schedule-grid">
                  {templates.length === 0 ? <p className="mono-text" style={{color: 'var(--text-dim)'}}>暂无规则</p> : templates.map(t => (
                    <div key={t.id} className="schedule-item-tech">
                      <div className="schedule-time-block">{t.time}</div>
                      <div className="schedule-content">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <strong>{t.title}</strong>
                          <span style={{ fontSize: '0.75rem', border: '1px solid var(--border-color)', padding: '2px 6px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                            {renderRuleLabel(t)}
                          </span>
                        </div>
                        <p style={{ margin: '0.5rem 0 0', color: 'var(--text-dim)' }}>{t.description}</p>
                      </div>
                      <div className="schedule-actions">
                        <button onClick={() => openTemplateModal(t)} title="编辑">
                          <img src="/data/Edit.png" alt="编辑" />
                        </button>
                        <button className="del-btn" onClick={() => handleDeleteTemplate(t.id!)} title="删除">
                          <img src="/data/Delete.png" alt="删除" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'diary' && <DiaryPanel date={date} schedules={schedules} />}
          {activeTab === 'calendar' && <CalendarView />}
          {activeTab === 'settings' && <SettingsView />}
          
          {activeTab === 'health' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <h2 className="tech-heading" style={{ fontSize: '3rem', marginBottom: '3rem', textAlign: 'center' }}>健康监控</h2>
              
              {!healthStatus ? (
                <p className="mono-text" style={{ textAlign: 'center', marginTop: '2rem' }}>后端监控服务未启动或连接失败</p>
              ) : (
                <div style={{ display: 'flex', gap: '3rem', justifyContent: 'center', transform: 'scale(1.5)', transformOrigin: 'top center' }}>
                  <Card title={healthStatus.sedentary.phase === 'sedentary' ? "久坐计时" : "运动计时"} style={{ width: '250px' }}>
                    <div style={{ textAlign: 'center', margin: '2rem 0' }}>
                      <div className="mono-text" style={{ fontSize: '3rem', fontWeight: 'bold', color: healthStatus.sedentary.time_left <= 0 ? 'var(--accent-red)' : 'var(--text-main)' }}>
                        {formatTime(healthStatus.sedentary.time_left)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                      <button onClick={() => handleHealthControl('sedentary', 'refresh')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0' }} title="重新计时">
                        <img src="/data/Refresh.png" alt="Refresh" style={{ width: '24px', height: '24px' }} />
                      </button>
                      <button onClick={() => handleHealthControl('sedentary', 'next_phase')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0' }} title="下一阶段">
                        <img src="/data/Next.png" alt="Next Phase" style={{ width: '24px', height: '24px' }} />
                      </button>
                    </div>
                  </Card>

                  <Card title="用眼提醒" style={{ width: '250px' }}>
                    <div style={{ textAlign: 'center', margin: '2rem 0' }}>
                      <div className="mono-text" style={{ fontSize: '3rem', fontWeight: 'bold', color: healthStatus.eye_care.time_left <= 0 ? 'var(--accent-red)' : 'var(--text-main)' }}>
                        {formatTime(healthStatus.eye_care.time_left)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <button onClick={() => handleHealthControl('eye_care', 'refresh')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0' }} title="重新计时">
                        <img src="/data/Refresh.png" alt="Refresh" style={{ width: '24px', height: '24px' }} />
                      </button>
                    </div>
                  </Card>
                </div>
              )}
              {healthStatus?.is_suspended && (
                <p style={{ textAlign: 'center', marginTop: '10rem', color: 'var(--accent-red)' }}>已暂停：检测到电脑处于闲置状态</p>
              )}
            </div>
          )}
        </main>

        {isScheduleModalOpen && (
          <Modal isOpen={true} onClose={closeScheduleModal} title={editingSchedule ? '编辑记录' : '新建记录'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>时间</label>
                  <input type="time" value={scheduleForm.time} onChange={e => setScheduleForm({...scheduleForm, time: e.target.value})} style={{ width: '100%', marginTop: '0.25rem' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>类型</label>
                  <select value={scheduleForm.type || '工作'} onChange={e => setScheduleForm({...scheduleForm, type: e.target.value})} style={{ width: '100%', marginTop: '0.25rem' }}>
                    {SCHEDULE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>标题</label>
                <input type="text" value={scheduleForm.title} onChange={e => setScheduleForm({...scheduleForm, title: e.target.value})} style={{ width: '100%', marginTop: '0.25rem' }} placeholder="输入日程标题..." />
              </div>
              <div>
                <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>详情</label>
                <textarea value={scheduleForm.description} onChange={e => setScheduleForm({...scheduleForm, description: e.target.value})} style={{ width: '100%', marginTop: '0.25rem', height: '80px', resize: 'none' }} placeholder="输入日程详情..." />
              </div>
            </div>
            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={closeScheduleModal}>取消</Button>
              <Button variant="primary" onClick={handleSaveSchedule}>保存</Button>
            </div>
          </Modal>
        )}

        {isTemplateModalOpen && (
          <Modal isOpen={true} onClose={closeTemplateModal} title={editingTemplate ? '编辑规则' : '新建规则'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>规则类型</label>
                <select 
                  value={templateForm.ruleType} 
                  onChange={e => setTemplateForm({...templateForm, ruleType: e.target.value as any})}
                  style={{ width: '100%', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}
                >
                  <option value="daily">每天</option>
                  <option value="weekly">每周</option>
                  <option value="monthly">每月</option>
                </select>
              </div>
              
              {templateForm.ruleType === 'weekly' && (
                <div>
                  <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>目标星期 (输入数字用逗号分隔，1=一，0=日)</label>
                  <input 
                    type="text" 
                    value={templateForm.ruleValue}
                    onChange={e => setTemplateForm({...templateForm, ruleValue: e.target.value})}
                    style={{ width: '100%', marginTop: '0.25rem' }}
                    placeholder="例如：1,3,5"
                  />
                </div>
              )}
              
              {templateForm.ruleType === 'monthly' && (
                <div>
                  <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>目标日期 (输入数字用逗号分隔)</label>
                  <input 
                    type="text"
                    value={templateForm.ruleValue}
                    onChange={e => setTemplateForm({...templateForm, ruleValue: e.target.value})}
                    style={{ width: '100%', marginTop: '0.25rem' }}
                    placeholder="例如：1,15,30"
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>时间</label>
                  <input type="time" value={templateForm.time} onChange={e => setTemplateForm({...templateForm, time: e.target.value})} style={{ width: '100%', marginTop: '0.25rem' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>类型</label>
                  <select value={templateForm.type || '工作'} onChange={e => setTemplateForm({...templateForm, type: e.target.value})} style={{ width: '100%', marginTop: '0.25rem' }}>
                    {SCHEDULE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>标题</label>
                <input type="text" value={templateForm.title} onChange={e => setTemplateForm({...templateForm, title: e.target.value})} style={{ width: '100%', marginTop: '0.25rem' }} />
              </div>
              <div>
                <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>详情</label>
                <input type="text" value={templateForm.description} onChange={e => setTemplateForm({...templateForm, description: e.target.value})} style={{ width: '100%', marginTop: '0.25rem' }} />
              </div>
            </div>
            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={closeTemplateModal}>取消</Button>
              <Button variant="primary" onClick={handleSaveTemplate}>保存</Button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

// --- Calendar View ---
function CalendarView() {
  const [dates, setDates] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerDate, setDrawerDate] = useState<string>('');

  useEffect(() => {
    fetch('http://localhost:8000/diaries/dates')
      .then(res => res.json())
      .then(data => setDates(data));
  }, []);

  const handleDateClick = (d: string) => {
    if (selectedDate === d) {
      setDrawerDate(d);
      setShowDrawer(true);
    } else {
      setSelectedDate(d);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 className="tech-heading" style={{ fontSize: '3rem', marginBottom: '2rem' }}>日程日历</h2>
      <Card style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {dates.map((d: any) => (
            <div 
              key={d.date} 
              onClick={() => handleDateClick(d.date)}
              style={{ 
                width: '100px', height: '100px', 
                background: selectedDate === d.date ? 'var(--bg-panel)' : 'var(--bg-sidebar)',
                border: selectedDate === d.date ? '2px solid var(--accent-yellow)' : '1px solid var(--border-color)',
                borderRadius: '8px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative'
              }}
            >
              <div style={{ fontSize: '1.2rem', fontFamily: 'var(--font-mono)' }}>{d.date.split('-').slice(1).join('-')}</div>
              {/* Status indicators */}
              <div style={{ position: 'absolute', bottom: '10px', display: 'flex', gap: '8px' }}>
                {d.has_schedules && !d.has_diary && <div style={{ width: '20px', height: '6px', backgroundColor: 'var(--accent-red)', borderRadius: '3px' }} title="存在未生成的日程" />}
                {d.has_diary && <div style={{ width: '20px', height: '6px', backgroundColor: 'var(--accent-green)', borderRadius: '3px' }} title="已生成日记" />}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '600px', 
        backgroundColor: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border-color)',
        boxShadow: '-5px 0 15px rgba(0,0,0,0.5)',
        transform: showDrawer ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 1000,
        display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ padding: '2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
          <h3 className="tech-heading">{drawerDate} 的记录</h3>
          <button onClick={() => setShowDrawer(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '2rem', flex: 1, overflowY: 'auto' }}>
          {showDrawer && <DiaryPanel date={drawerDate} schedules={[]} />}
        </div>
      </div>
    </div>
  );
}

// --- Settings View ---
function SettingsView() {
  const [runningApps, setRunningApps] = useState<string[]>([]);
  const [selectedApp, setSelectedApp] = useState('');

  useEffect(() => {
    fetch('http://localhost:8000/running-apps')
      .then(res => res.json())
      .then(data => {
        setRunningApps(data.apps || []);
        if (data.apps && data.apps.length > 0) setSelectedApp(data.apps[0]);
      })
      .catch(() => {});
  }, []);

  const handleAddWhitelist = async () => {
    if (selectedApp) {
      await fetch('http://localhost:8000/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_name: selectedApp })
      });
      window.dispatchEvent(new Event('reload_whitelist'));
    }
  };

  return (
    <div>
      <h2 className="tech-heading" style={{ fontSize: '3rem', marginBottom: '2rem' }}>个人中心</h2>
      
      <Card title="应用白名单管理" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <select value={selectedApp} onChange={e => setSelectedApp(e.target.value)} style={{ flex: 1, padding: '0.5rem' }}>
            {runningApps.map(app => <option key={app} value={app}>{app}</option>)}
          </select>
          <Button variant="primary" onClick={handleAddWhitelist}>添加</Button>
        </div>
        <div className="schedule-grid" id="whitelist-container">
          <WhitelistRenderer />
        </div>
      </Card>

      <Card title="自动化设置">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ flex: 1 }}>
            <strong>自动上传与日记生成</strong>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-dim)', fontSize: '0.9rem' }}>到达指定时间后，后台将静默打包数据并让大模型生成日记定稿。</p>
          </div>
          <div>
            <AutoUploadToggle />
          </div>
        </div>
      </Card>
    </div>
  );
}

function WhitelistRenderer() {
  const [list, setList] = useState<string[]>([]);
  const load = async () => {
    try {
      const res = await fetch('http://localhost:8000/whitelist');
      const data = await res.json();
      setList(data);
    } catch(e) {}
  };
  useEffect(() => { load(); window.addEventListener('reload_whitelist', load); return () => window.removeEventListener('reload_whitelist', load); }, []);
  
  return (
    <>
      {list.length === 0 ? <p className="mono-text" style={{color: 'var(--text-dim)'}}>暂无应用</p> : list.map(app => (
        <div key={app} className="schedule-item-tech" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between' }}>
          <span>{app}</span>
          <button style={{ background: 'transparent', border: 'none', color: 'var(--accent-pink)', cursor: 'pointer' }} onClick={async () => {
            await fetch(`http://localhost:8000/whitelist/${encodeURIComponent(app)}`, { method: 'DELETE' });
            load();
          }}>删除</button>
        </div>
      ))}
    </>
  );
}

function AutoUploadToggle() {
  const [enabled, setEnabled] = useState(localStorage.getItem('auto_upload_enabled') === 'true');
  const [time, setTime] = useState(localStorage.getItem('auto_upload_time') || '23:30');
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <input type="time" value={time} onChange={e => {
        setTime(e.target.value);
        localStorage.setItem('auto_upload_time', e.target.value);
      }} />
      <button 
        onClick={() => {
          const newV = !enabled;
          setEnabled(newV);
          localStorage.setItem('auto_upload_enabled', String(newV));
        }}
        style={{ padding: '0.5rem 1rem', background: enabled ? 'var(--accent-green)' : 'var(--bg-panel)', color: enabled ? '#000' : 'var(--text-main)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
      >
        {enabled ? '已开启' : '已关闭'}
      </button>
    </div>
  );
}
