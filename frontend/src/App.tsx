import React, { useState, useEffect, useRef } from 'react';
import DiaryPanel from './DiaryPanel';
import { Sidebar, TabType } from './components/Sidebar';
import { Card } from './components/Card';
import { Button } from './components/Button';

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
      getScheduleDates: () => Promise<string[]>;
      minimize: () => void;
      close: () => void;
    }
  }
}

interface Schedule {
  id?: string;
  templateId?: string;
  date?: string;
  title: string;
  description: string;
  time: string;
  type?: string; // 工作 | 学习 | 娱乐 | 运动 | 其他
  isGenerated?: boolean;
  is_completed?: boolean;
}

interface Template {
  id?: string;
  title: string;
  description: string;
  time: string;
  ruleType: 'daily' | 'weekly' | 'monthly';
  ruleValue?: string;
  type?: string;
}

const SCHEDULE_TYPES = ['工作', '学习', '娱乐', '运动', '其他'];

function WhitelistRenderer() {
  const [whitelist, setWhitelist] = useState<string[]>([]);

  const loadWhitelist = async () => {
    try {
      const res = await fetch('http://localhost:8000/whitelist');
      const data = await res.json();
      setWhitelist(data.whitelist || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadWhitelist();
    const handleReload = () => loadWhitelist();
    window.addEventListener('reload_whitelist', handleReload);
    return () => window.removeEventListener('reload_whitelist', handleReload);
  }, []);

  const removeApp = async (appName: string) => {
    try {
      await fetch('http://localhost:8000/whitelist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_name: appName })
      });
      loadWhitelist();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      {whitelist.length === 0 ? <p className="mono-text" style={{ color: 'var(--text-dim)' }}>暂无白名单应用</p> : whitelist.map(app => (
        <div key={app} className="schedule-item-tech" style={{ padding: '0.5rem 1rem', alignItems: 'center' }}>
          <strong>{app}</strong>
          <button className="del-btn" style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => removeApp(app)}>移除</button>
        </div>
      ))}
    </>
  );
}

function AutoUploadToggle({ showConfirm }: { showConfirm: (msg: string, onConfirm: () => void, onCancel?: () => void) => void }) {
  const [enabled, setEnabled] = useState(localStorage.getItem('auto_upload_enabled') === 'true');
  const [time, setTime] = useState(localStorage.getItem('auto_upload_time') || '23:00');

  const toggle = (checked: boolean) => {
    if (checked) {
      showConfirm('隐私风险提示：开启此功能后，系统将在设定时间自动将日程和应用数据上传至大模型进行日记生成。是否确认？', () => {
        setEnabled(true);
        localStorage.setItem('auto_upload_enabled', 'true');
      });
    } else {
      setEnabled(false);
      localStorage.setItem('auto_upload_enabled', 'false');
    }
  };

  const handleTimeChange = (t: string) => {
    setTime(t);
    localStorage.setItem('auto_upload_time', t);
  };

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <input
        type="time"
        value={time}
        onChange={e => handleTimeChange(e.target.value)}
        disabled={!enabled}
        style={{ fontFamily: 'var(--font-mono)' }}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => toggle(e.target.checked)}
          style={{ width: '20px', height: '20px' }}
        />
        开启自动上传
      </label>
    </div>
  );
}

function CalendarView() {
  const [diaryDates, setDiaryDates] = useState<string[]>([]);
  const [scheduleDates, setScheduleDates] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    fetch('http://localhost:8000/diaries/dates')
      .then(r => r.json())
      .then(d => setDiaryDates(d.dates || []))
      .catch(e => console.error(e));

    window.api.getScheduleDates()
      .then(d => setScheduleDates(d))
      .catch(e => console.error(e));
  }, []);

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const handleDateClick = (dateStr: string) => {
    if (selectedDate === dateStr) {
      setIsDrawerOpen(true);
    } else {
      setSelectedDate(dateStr);
      setIsDrawerOpen(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <h2 className="tech-heading" style={{ fontSize: '3rem', marginBottom: '2rem' }}>日程日历</h2>

      <div
        style={{ flex: 1, display: 'flex' }}
        onClick={() => setIsDrawerOpen(false)}
      >
        <Card title={`${currentMonth.getFullYear()}年 ${currentMonth.getMonth() + 1}月`} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }} onClick={e => e.stopPropagation()}>
            <Button variant="secondary" onClick={prevMonth}>&lt; prev</Button>
            <Button variant="secondary" onClick={nextMonth}>next &gt;</Button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', textAlign: 'center', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', textAlign: 'center', flex: 1, gridAutoRows: '1fr' }}>
            {days.map((d, i) => {
              if (!d) return <div key={i} style={{ padding: '1rem' }}></div>;
              const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const hasDiary = diaryDates.includes(dateStr);
              const hasSchedule = scheduleDates.includes(dateStr) && !hasDiary;

              const today = new Date();
              const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
              const isToday = dateStr === todayStr;
              const isSelected = selectedDate === dateStr;

              return (
                <div
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDateClick(dateStr);
                  }}
                  style={{
                    position: 'relative',
                    padding: '1rem',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--text-main)' : (isToday ? 'var(--accent-yellow)' : 'var(--bg-sidebar)'),
                    color: isSelected ? '#FFF' : (isToday ? '#000' : 'inherit'),
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    fontWeight: isToday ? 'bold' : 'normal',
                    transition: 'background-color 0.2s'
                  }}
                >
                  {d}
                  <div style={{ position: 'absolute', bottom: '6px', left: '0', right: '0', display: 'flex', justifyContent: 'center', gap: '4px' }}>
                    {hasSchedule && <div style={{ width: '12px', height: '4px', background: '#FF4444', borderRadius: '2px' }}></div>}
                    {hasDiary && <div style={{ width: '12px', height: '4px', background: '#44FF44', borderRadius: '2px' }}></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Drawer for Details */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '600px',
            height: '100%',
            background: 'var(--bg-base)',
            boxShadow: '-4px 0 15px rgba(0,0,0,0.5)',
            transform: isDrawerOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 10,
            padding: '2rem',
            borderLeft: '1px solid var(--border-color)',
            overflowY: 'auto'
          }}
        >
          {selectedDate && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{selectedDate} 的记录</h3>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem' }}
                >
                  <img src="/data/Close.png" alt="关闭" style={{ width: '24px', height: '24px' }} />
                </button>
              </div>
              <DiaryPanel date={selectedDate} schedules={[]} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('schedules');

  // Schedule state
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [scheduleForm, setScheduleForm] = useState<Schedule>({ title: '', description: '', time: '12:00', type: '工作' });

  // Custom Confirm Modal
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, text: string, onConfirm: () => void, onCancel?: () => void }>({
    isOpen: false, text: '', onConfirm: () => { }
  });

  const showConfirm = (text: string, onConfirm: () => void, onCancel?: () => void) => {
    setConfirmModal({ isOpen: true, text, onConfirm, onCancel });
  };

  // Template state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateForm, setTemplateForm] = useState<Template>({ title: '', description: '', time: '12:00', ruleType: 'daily', ruleValue: '1' });

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
            // Downgrade: Save raw stats as diary
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
          // Reset stats for the new day
          await fetch('http://localhost:8000/reset-stats', { method: 'POST' });
        } catch (e) {
          console.error('Downgrade failed', e);
        }
        localStorage.setItem('last_handled_date', todayStr);
      }

      // 2. Auto Upload Check
      const enabled = localStorage.getItem('auto_upload_enabled') === 'true';
      if (!enabled) return;

      const targetTime = localStorage.getItem('auto_upload_time') || '23:00';
      const currentH = now.getHours();
      const currentM = now.getMinutes();
      const [targetH, targetM] = targetTime.split(':').map(Number);

      if (currentH > targetH || (currentH === targetH && currentM >= targetM)) {
        const lastUpload = localStorage.getItem('last_auto_upload_date');
        if (lastUpload !== todayStr) {
          try {
            const schedulesData = await window.api.getSchedules(todayStr);
            const scheduleText = schedulesData.map(s => s.time + ' ' + s.title).join('\n');
            const statsRes = await fetch('http://localhost:8000/stats');
            const statsData = await statsRes.json();
            const appStatsText = (statsData || []).map((s: any) => s.app_name + ': ' + (s.active_time_seconds || 0) + 's').join('\n');

            const genRes = await fetch('http://localhost:8000/generate-diary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ schedule_text: scheduleText, app_stats_text: appStatsText })
            });
            const genData = await genRes.json();

            await fetch('http://localhost:8000/save-diary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: todayStr, content: genData.draft })
            });

            localStorage.setItem('last_auto_upload_date', todayStr);
            console.log('Auto upload successful for', todayStr);
          } catch (e) {
            console.error('Auto upload failed', e);
          }
        }
      }
    };

    checkTasks();
    const interval = setInterval(checkTasks, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'schedules') {
      loadSchedules(date);
    } else if (activeTab === 'templates') {
      loadTemplates();
    }
  }, [activeTab, date]);

  const loadSchedules = async (d: string) => {
    if (window.api) {
      const data = await window.api.getSchedules(d);
      setSchedules(data);
    }
  };

  const loadTemplates = async () => {
    if (window.api) {
      const data = await window.api.getTemplates();
      setTemplates(data);
    }
  };

  // --- Handlers ---
  const openScheduleModal = (item?: Schedule) => {
    if (item) {
      setEditingSchedule(item);
      setScheduleForm({ title: item.title, description: item.description, time: item.time, type: item.type || '工作' });
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

  const handleDeleteSchedule = (id: string) => {
    showConfirm('确认删除该日程记录？', async () => {
      await window.api.deleteSchedule(id);
      loadSchedules(date);
    });
  };

  const openTemplateModal = (item?: Template) => {
    if (item) {
      setEditingTemplate(item);
      setTemplateForm({ ...item });
    } else {
      setEditingTemplate(null);
      setTemplateForm({ title: '', description: '', time: '12:00', ruleType: 'daily', ruleValue: '1' });
    }
    setIsTemplateModalOpen(true);
  };
  const closeTemplateModal = () => setIsTemplateModalOpen(false);

  const handleSaveTemplate = async () => {
    if (!templateForm.title) return;
    if (editingTemplate && editingTemplate.id) {
      await window.api.updateTemplate({ ...templateForm, id: editingTemplate.id });
    } else {
      await window.api.addTemplate(templateForm);
    }
    closeTemplateModal();
    loadTemplates();
  };

  const handleDeleteTemplate = (id: string) => {
    showConfirm('确认删除该固定规则？（不影响已生成的日程）', async () => {
      await window.api.deleteTemplate(id);
      loadTemplates();
    });
  };

  const renderRuleLabel = (tpl: Template) => {
    if (tpl.ruleType === 'daily') return '每天';
    if (tpl.ruleType === 'weekly') {
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return `每周 ${days[parseInt(tpl.ruleValue || '0')]}`;
    }
    if (tpl.ruleType === 'monthly') return `每月 ${tpl.ruleValue} 日`;
    return '未知规则';
  };

  // --- Health Tracker Logic ---
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const notifiedEye = useRef(false);
  const prevPhase = useRef<string | null>(null);
  const [isHealthConfigModalOpen, setIsHealthConfigModalOpen] = useState(false);
  const [healthConfig, setHealthConfig] = useState({ sedentary_minutes: 45, exercise_minutes: 5, eye_care_minutes: 20 });

  const loadHealthConfig = async () => {
    try {
      const res = await fetch('http://localhost:8000/health/config');
      const data = await res.json();
      setHealthConfig(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveHealthConfig = async () => {
    try {
      await fetch('http://localhost:8000/health/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(healthConfig)
      });
      setIsHealthConfigModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let checkTimer: any;

    // Request notification permission
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    const fetchHealth = async () => {
      try {
        const res = await fetch('http://localhost:8000/health/status');
        const data = await res.json();
        setHealthStatus(data);

        // Handle Notifications
        if (prevPhase.current && prevPhase.current !== data.sedentary.phase) {
          if (Notification.permission === 'granted') {
            const msg = data.sedentary.phase === 'exercise' ? '您已持续坐立很久啦，请站起来活动一下吧！' : '运动时间结束，请回到座位！';
            new Notification('阶段切换提醒', { body: msg });
          }
        }
        prevPhase.current = data.sedentary.phase;

        if (data.eye_care.time_left === 0 && !notifiedEye.current) {
          if (Notification.permission === 'granted') {
            new Notification('用眼提醒', { body: '您已持续办公很长时间了，请眺望远方休息一下！' });
          }
          notifiedEye.current = true;
          // 倒计时结束后自动刷新重置
          fetch('http://localhost:8000/health/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timer_type: 'eye_care' })
          });
        } else if (data.eye_care.time_left > 0) {
          notifiedEye.current = false;
        }

      } catch (e) {
        // Backend not running
        checkTimer = setTimeout(fetchHealth, 5000);
        return;
      }

      // Schedule next check: 1s if successful/normal, 5s if we caught an error recently to avoid spam
      checkTimer = setTimeout(fetchHealth, 1000);
    };

    fetchHealth();
    return () => clearTimeout(checkTimer);
  }, []); // Run only once on mount

  const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m} 分 ${s < 10 ? '0' + s : s} 秒`;
  };

  const handleRefreshTimer = async (timer_type: string) => {
    await fetch('http://localhost:8000/health/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timer_type })
    });
  };

  const handleNextPhase = async () => {
    await fetch('http://localhost:8000/health/next-phase', { method: 'POST' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg-base)' }}>
      {/* 纯黑机能风标题栏 */}
      <div className="title-bar">
        <div className="title-bar-brand">
          <span style={{ color: 'var(--accent-yellow)', fontStyle: 'italic' }}>//</span> DIARY ASSISTANT
        </div>
        <div className="title-bar-controls">
          <button className="title-bar-btn" onClick={() => window.api?.minimize()}>_</button>
          <button className="title-bar-btn close-btn" onClick={() => window.api?.close()}>✕</button>
        </div>
      </div>

      <div className="app-layout">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="app-main">
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
                  {schedules.length === 0 ? <p className="mono-text" style={{ color: 'var(--text-dim)' }}>暂无记录</p> : schedules.map(s => (
                    <div key={s.id} className={`schedule-item-tech ${s.is_completed ? 'completed' : ''}`}>
                      <div className="schedule-time-block">{s.time}</div>
                      <div className="schedule-content">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <strong>{s.title}</strong>
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
                        <button onClick={async () => {
                          const updated = { ...s, is_completed: !s.is_completed };
                          await window.api.updateSchedule(updated);
                          loadSchedules(date);
                        }} title="完成">
                          <img src="/data/Complete.png" alt="完成" />
                        </button>
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
                  <h2 className="tech-heading" style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>日程模板</h2>
                  <div className="mono-text" style={{ color: 'var(--text-dim)' }}>管理自动生成的日程规则</div>
                </div>
                <Button variant="primary" onClick={() => openTemplateModal()}>[+] 添加规则</Button>
              </div>

              <Card>
                <div className="schedule-grid">
                  {templates.length === 0 ? <p className="mono-text" style={{ color: 'var(--text-dim)' }}>暂无规则</p> : templates.map(t => (
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

          {activeTab === 'health' && (
            <div>
              <h2 className="tech-heading" style={{ fontSize: '3rem', marginBottom: '2rem' }}>健康监控</h2>

              {Notification.permission === 'denied' && (
                <div style={{ backgroundColor: 'rgba(255, 69, 58, 0.1)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>// WARNING: </strong>
                  当前通知权限已被禁用。请在系统设置（Windows 通知中心）或浏览器设置中手动允许本应用的通知权限，否则您将无法接收健康提醒。
                </div>
              )}

              <div style={{ display: 'flex', gap: '3rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
                {/* 久坐计时 */}
                <Card className="flex-1" style={{ flex: 1, textAlign: 'center', padding: '3rem 2rem', minWidth: '250px' }}>
                  <h3 style={{ color: 'var(--text-dim)', marginBottom: '1.5rem', fontWeight: 500 }}>
                    {healthStatus?.sedentary.phase === 'exercise' ? '运动计时' : '久坐计时'}
                  </h3>
                  <div className="mono-text" style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '2rem' }}>
                    {healthStatus ? formatTime(healthStatus.sedentary.time_left) : '-- 分 -- 秒'}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <Button variant="secondary" onClick={() => handleRefreshTimer('sedentary')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem' }}>
                      <img src="/data/Refresh.png" alt="Refresh" style={{ width: '16px', height: '16px' }} />
                      <span style={{ fontSize: '0.8rem' }}>重新计时</span>
                    </Button>
                    <Button variant="primary" onClick={handleNextPhase} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem' }}>
                      <img src="/data/Next.png" alt="Next" style={{ width: '16px', height: '16px', filter: 'invert(1)' }} />
                      <span style={{ fontSize: '0.8rem' }}>下一阶段</span>
                    </Button>
                    <Button variant="secondary" onClick={() => { loadHealthConfig(); setIsHealthConfigModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem' }}>
                      <img src="/data/TimeEdit.png" alt="Edit" style={{ width: '16px', height: '16px' }} />
                      <span style={{ fontSize: '0.8rem' }}>编辑时长</span>
                    </Button>
                  </div>
                </Card>

                {/* 用眼提醒 */}
                <Card className="flex-1" style={{ flex: 1, textAlign: 'center', padding: '3rem 2rem', minWidth: '250px' }}>
                  <h3 style={{ color: 'var(--text-dim)', marginBottom: '1.5rem', fontWeight: 500 }}>用眼提醒</h3>
                  <div className="mono-text" style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '2rem' }}>
                    {healthStatus ? formatTime(healthStatus.eye_care.time_left) : '-- 分 -- 秒'}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <Button variant="secondary" onClick={() => handleRefreshTimer('eye_care')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem' }}>
                      <img src="/data/Refresh.png" alt="Refresh" style={{ width: '16px', height: '16px' }} />
                      <span style={{ fontSize: '0.8rem' }}>重新计时</span>
                    </Button>
                    <Button variant="secondary" onClick={() => { loadHealthConfig(); setIsHealthConfigModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem' }}>
                      <img src="/data/TimeEdit.png" alt="Edit" style={{ width: '16px', height: '16px' }} />
                      <span style={{ fontSize: '0.8rem' }}>编辑时长</span>
                    </Button>
                  </div>
                </Card>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '3rem', gap: '1rem' }}>
                <div style={{ color: 'var(--text-dim)' }}>
                  当前通知权限状态: <strong style={{ color: 'var(--text-main)' }}>{Notification.permission}</strong>
                </div>
                <Button variant="secondary" onClick={() => {
                  try {
                    alert(`当前权限状态是: ${Notification.permission}`);
                    if (Notification.permission === 'granted') {
                      new Notification('系统通知测试', { body: '这是一条测试通知，如果您能看到它，说明通知权限正常。' });
                      alert('已执行 new Notification()');
                    } else {
                      Notification.requestPermission().then(perm => {
                        if (perm === 'granted') {
                          new Notification('系统通知测试', { body: '通知权限已开启！' });
                          alert('权限已允许，并已执行 new Notification()');
                        } else {
                          alert(`权限请求结果为: ${perm}。请前往系统或浏览器设置中手动开启。`);
                        }
                      }).catch(err => {
                        alert(`请求权限时出错: ${err}`);
                      });
                    }
                  } catch (e: any) {
                    alert(`执行出错: ${e.message}`);
                  }
                }}>
                  测试发送通知
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'diary' && <DiaryPanel date={date} schedules={schedules} />}
          {activeTab === 'calendar' && <CalendarView />}
          {activeTab === 'settings' && (
            <div>
              <h2 className="tech-heading" style={{ fontSize: '3rem', marginBottom: '2rem' }}>个人中心</h2>

              <Card title="应用白名单管理" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
                  <select
                    id="newAppName"
                    style={{ flex: 1, padding: '0.5rem' }}
                    onFocus={async () => {
                      try {
                        const res = await fetch('http://localhost:8000/running-apps');
                        const data = await res.json();
                        const select = document.getElementById('newAppName') as HTMLSelectElement;
                        const currentVal = select.value;
                        select.innerHTML = '<option value="">-- 选择正在运行的应用 --</option>';
                        data.running_apps.forEach((app: string) => {
                          const opt = document.createElement('option');
                          opt.value = app;
                          opt.textContent = app;
                          select.appendChild(opt);
                        });
                        if (data.running_apps.includes(currentVal)) {
                          select.value = currentVal;
                        }
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                  >
                    <option value="">-- 点击以获取当前正在运行的应用 --</option>
                  </select>
                  <Button variant="primary" onClick={async () => {
                    const select = document.getElementById('newAppName') as HTMLSelectElement;
                    if (select.value) {
                      await fetch('http://localhost:8000/whitelist', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ app_name: select.value })
                      });
                      select.value = '';
                      window.dispatchEvent(new Event('reload_whitelist'));
                    }
                  }}>添加</Button>
                </div>

                <div className="schedule-grid" id="whitelist-container">
                  {/* 动态渲染 whitelist */}
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
                    <AutoUploadToggle showConfirm={showConfirm} />
                  </div>
                </div>
              </Card>
            </div>
          )}
        </main>

        {/* Modals */}
        {isScheduleModalOpen && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3 className="tech-heading" style={{ marginBottom: '1.5rem' }}>
                {editingSchedule ? '编辑记录' : '新建记录'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>时间</label>
                    <input type="time" value={scheduleForm.time} onChange={e => setScheduleForm({ ...scheduleForm, time: e.target.value })} style={{ width: '100%', marginTop: '0.25rem' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>类型</label>
                    <select value={scheduleForm.type || '工作'} onChange={e => setScheduleForm({ ...scheduleForm, type: e.target.value })} style={{ width: '100%', marginTop: '0.25rem' }}>
                      {SCHEDULE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>标题</label>
                  <input type="text" value={scheduleForm.title} onChange={e => setScheduleForm({ ...scheduleForm, title: e.target.value })} style={{ width: '100%', marginTop: '0.25rem' }} placeholder="输入日程标题..." />
                </div>
                <div>
                  <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>详情</label>
                  <textarea value={scheduleForm.description} onChange={e => setScheduleForm({ ...scheduleForm, description: e.target.value })} style={{ width: '100%', marginTop: '0.25rem', height: '80px', resize: 'none' }} placeholder="输入日程详情..." />
                </div>
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={closeScheduleModal}>取消</Button>
                <Button variant="primary" onClick={handleSaveSchedule}>保存</Button>
              </div>
            </div>
          </div>
        )}

        {isTemplateModalOpen && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3 className="tech-heading" style={{ marginBottom: '1.5rem' }}>
                {editingTemplate ? '编辑规则' : '新建规则'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>规则类型</label>
                  <select
                    value={templateForm.ruleType}
                    onChange={e => setTemplateForm({ ...templateForm, ruleType: e.target.value as any, ruleValue: '' })}
                    style={{ width: '100%', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}
                  >
                    <option value="daily">每天</option>
                    <option value="weekly">每周</option>
                    <option value="monthly">每月</option>
                  </select>
                </div>

                {templateForm.ruleType === 'weekly' && (
                  <div>
                    <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>目标星期 (最多选择6个)</label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                      {[1, 2, 3, 4, 5, 6, 0].map(day => {
                        const days = templateForm.ruleValue ? templateForm.ruleValue.split(',').map(Number) : [];
                        const isSelected = days.includes(day);
                        return (
                          <button
                            key={day}
                            onClick={() => {
                              if (isSelected) {
                                setTemplateForm({ ...templateForm, ruleValue: days.filter(d => d !== day).join(',') });
                              } else if (days.length < 6) {
                                setTemplateForm({ ...templateForm, ruleValue: [...days, day].join(',') });
                              }
                            }}
                            style={{
                              padding: '0.5rem 1rem',
                              border: `1px solid ${isSelected ? 'var(--accent-yellow)' : 'var(--border-color)'}`,
                              background: isSelected ? 'var(--accent-yellow)' : 'transparent',
                              color: isSelected ? '#000' : 'var(--text-main)',
                              cursor: 'pointer',
                              borderRadius: '4px'
                            }}
                          >
                            {['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][day]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {templateForm.ruleType === 'monthly' && (
                  <div>
                    <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>目标日期 (以逗号分隔，如: 1,15,30)</label>
                    <input
                      type="text"
                      value={templateForm.ruleValue}
                      onChange={e => {
                        // validate up to 6 numbers
                        const val = e.target.value;
                        if (val.split(',').length <= 6) {
                          setTemplateForm({ ...templateForm, ruleValue: val });
                        }
                      }}
                      placeholder="输入日期"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>时间</label>
                    <input type="time" value={templateForm.time} onChange={e => setTemplateForm({ ...templateForm, time: e.target.value })} style={{ width: '100%', marginTop: '0.25rem' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>类型</label>
                    <select value={templateForm.type || '工作'} onChange={e => setTemplateForm({ ...templateForm, type: e.target.value })} style={{ width: '100%', marginTop: '0.25rem' }}>
                      {SCHEDULE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>标题</label>
                  <input type="text" value={templateForm.title} onChange={e => setTemplateForm({ ...templateForm, title: e.target.value })} style={{ width: '100%', marginTop: '0.25rem' }} />
                </div>
                <div>
                  <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>详情</label>
                  <input type="text" value={templateForm.description} onChange={e => setTemplateForm({ ...templateForm, description: e.target.value })} style={{ width: '100%', marginTop: '0.25rem' }} />
                </div>
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={closeTemplateModal}>取消</Button>
                <Button variant="primary" onClick={handleSaveTemplate}>保存</Button>
              </div>
            </div>
          </div>
        )}

        {/* Health Config Modal */}
        {isHealthConfigModalOpen && (
          <div className="modal-overlay" onClick={() => setIsHealthConfigModalOpen(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3 className="tech-heading" style={{ marginBottom: '1.5rem', color: 'var(--accent-pink)' }}>// 编辑健康监控时长</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>久坐计时 (分钟)</label>
                  <input type="number" value={healthConfig.sedentary_minutes} onChange={e => setHealthConfig({ ...healthConfig, sedentary_minutes: parseInt(e.target.value) || 0 })} style={{ width: '100%', marginTop: '0.25rem' }} />
                </div>
                <div>
                  <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>运动休息 (分钟)</label>
                  <input type="number" value={healthConfig.exercise_minutes} onChange={e => setHealthConfig({ ...healthConfig, exercise_minutes: parseInt(e.target.value) || 0 })} style={{ width: '100%', marginTop: '0.25rem' }} />
                </div>
                <div>
                  <label className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dim)' }}>用眼提醒 (分钟)</label>
                  <input type="number" value={healthConfig.eye_care_minutes} onChange={e => setHealthConfig({ ...healthConfig, eye_care_minutes: parseInt(e.target.value) || 0 })} style={{ width: '100%', marginTop: '0.25rem' }} />
                </div>
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setIsHealthConfigModalOpen(false)}>取消</Button>
                <Button variant="primary" onClick={handleSaveHealthConfig}>保存</Button>
              </div>
            </div>
          </div>
        )}

        {/* Global Confirm Modal */}
        {confirmModal.isOpen && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ borderColor: 'var(--accent-yellow)', boxShadow: '8px 8px 0px rgba(255, 215, 0, 0.2)' }}>
              <h3 className="tech-heading" style={{ color: 'var(--accent-yellow)', marginBottom: '1rem' }}>// 系统确认</h3>
              <p className="mono-text" style={{ marginBottom: '2rem', lineHeight: '1.5' }}>
                {confirmModal.text}
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <Button variant="secondary" onClick={() => {
                  if (confirmModal.onCancel) confirmModal.onCancel();
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }} style={{ flex: 1 }}>取消</Button>
                <Button variant="primary" onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }} style={{ flex: 1 }}>确认</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
