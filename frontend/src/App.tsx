import React, { useState, useEffect } from 'react'

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

interface Schedule {
  id?: string;
  templateId?: string;
  date?: string;
  title: string;
  description: string;
  time: string;
  isGenerated?: boolean;
}

interface Template {
  id?: string;
  title: string;
  description: string;
  time: string;
  ruleType: 'daily' | 'weekly' | 'monthly';
  ruleValue?: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'schedules' | 'templates'>('schedules');
  
  // Schedule state
  const [date, setDate] = useState<string>(new Date().isoString().split('T')[0]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [scheduleForm, setScheduleForm] = useState<Schedule>({ title: '', description: '', time: '12:00' });

  // Template state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateForm, setTemplateForm] = useState<Template>({ title: '', description: '', time: '12:00', ruleType: 'daily', ruleValue: '1' });

  useEffect(() => {
    if (activeTab === 'schedules') {
      loadSchedules,date);
    } else {
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

  // --- Schedule Handlers ---
  const openScheduleModal = (item?: Schedule) => {
    if (item) {
      setEditingSchedule(item);
      setScheduleForm({ title: item.title, description: item.description, time: item.time });
    } else {
      setEditingSchedule(null);
      setScheduleForm({ title: '', description: '', time: '12:00' });
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
    if (confirm('硭��覑删除这个日�#吗?')) {
      await window.api.deleteSchedule(id);
      loadSchedules,date);
    }
  };

  const gotoTemplate = (templateId: string) => {
    closeScheduleModal();
    setActiveTab('templates');
    setTimeout(async () => {
      const tpls = await window.api.getTemplates();
      const target = tpls.find((t: any) => t.id === templateId);
      if (target) {
        openTemplateModal(target);
      }
    }, 100);
  };

  // --- Template Handlers ---
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

  const handleDeleteTemplate = async (id: string) => {
    if (confirm('硭��覑删除这个固定模板吗?（不影响已经修改裇的单日实侻）')) {
      await window.api.deleteTemplate(id);
      loadTemplates();
    }
  };

  const renderRuleLabel = (tpl: Template) => {
    if (tpl.ruleType === 'daily') return '每天';
    if (tpl.ruleType === 'weekly') {
      const days = ['周日','周丁','周亂','周三','周四','周五','周冭'];
      return `每${days[parseInt(tpl.ruleValue || '0')]}`;
    }
    if (tpl.ruleType === 'monthly') return `每月 ${tpl.ruleValue} 日`;
    return '洪矧规刖';
  };


  // --- Health Tracker Logic ---
  const [healthStatus, setHealthStatus] = useState<any>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('http://localhost:8000/health/status');
        const data = await res.json();
        setHealthStatus(data);
      } catch (e) {
        // Backend not running
      }
    };
    fetchHealth();
    const timer = setInterval(fetchHealth, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleHealthReset = async () => {
    try {
      await fetch('http://localhost:8000/health/reset', { method: 'POST' });
    } catch(e) {}
  };

  const handleHealthNextStage = async () => {
    try {
      await fetch('http://localhost:8000/health/next_stage', { method: 'POST' });
    } catch(e) {}
  };
  // ----------------------------

  return (

    <div className="container">
      <nav style={{ marginBottom: '1rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>
        <button 
          style={{ marginRight: '1rem', fontWeight: activeTab === 'schedules' ? 'bold' : 'normal' }}
          onClick={() => setActiveTab('schedules')}
        >日常日�#</button>
        <button 
          style={{ fontWeight: activeTab === 'templates' ? 'bold' : 'normal' }}
          onClick={() => setActiveTab('templates')}
        >固定日�#(模板)</button>
      </nav>

      {activeTab === 'schedules' && (
        <>
          <header>
            <h2>日�#管理 ({date})</h2>
            <div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
              <button onClick={() => openScheduleModal()}>添加日�#</button>
            </div>
          </header>
          
          <ul className="schedule-list">
            {schedules.length === 0 ? <p>暢无日�#</p> : schedules.map(s => (
              <li key={s.id} className="schedule-item">
                <div>
                  <strong>{s.time}</strong> - {s.title}
                  {s.isGenerated && <span style={{fontSize: '0.8em', marginLeft: '0.5rem', background: '#eee', padding: '2px 4px', borderRadius: '4px'}}>自动生</span>}
                  <p style={{ margin: '0.5rem 0 0', color: '#666' }}>{s.description}</p>
                </div>
                <div>
                  <button onClick={() => openScheduleModal(s)}>编辑</button>
                  <button className="delete" onClick={() => handleDeleteSchedule(s.id!)}>删除</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {activeTab === 'templates' && (
        <>
          <header>
            <h2>固定日�#模板</h2>
            <div>
              <button onClick={() => openTemplateModal()}>添加模板</button>
            </div>
          </header>
          
          <ul className="schedule-list">
            {templates.length === 0 ? <p>暢无固定模板</p> : templates.map(t => (
              <li key={t.id} className="schedule-item">
                <div>
                  <strong>{t.time}</strong> - {t.title} 
                  <span style={{color: '#007bff', marginLeft: '0.5rem'}}>[{renderRuleLabel(t)}]</span>
                  <p style={{ margin: '0.5rem 0 0', color: '#666' }}>{t.description}</p>
                </div>
                <div>
                  <button onClick={() => openTemplateModal(t)}>编辑</button>
                  <button className="delete" onClick={() => handleDeleteTemplate(t.id!)}>删除</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Schedule Edit Modal */}
      {isScheduleModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3>{editingSchedule ? '编辑日�#' : '添加日�#'}</h3>
            {editingSchedule && editingSchedule.templateId && (
              <div style={{marginBottom: '1rem', padding: '0.5rem', background: '#e9f5ff', borderRadius: '4px'}}>
                <span style={{fontSize: '0.9em'}}>此日稣由固定模板生成。</span>
                <button 
                  style={{marginLeft: '1rem', fontSize: '0.8em'}}
                  onClick={() => gotoTemplate(editingSchedule.templateId!)}
                >前往修改模板</button>
              </div>
            )}
            <div className="form-group">
              <label>时间</label>
              <input type="time" value={scheduleForm.time} onChange={e => setScheduleForm({...scheduleForm, time: e.target.value})} />
            </div>
            <div className="form-group">
              <label>标题</label>
              <input type="text" value={scheduleForm.title} onChange={e => setScheduleForm({...scheduleForm, title: e.target.value})} placeholder="输入标题..." />
            </div>
            <div className="form-group">
              <label>�#述</label>
              <input type="text" value={scheduleForm.description} onChange={e => setScheduleForm({...scheduleForm, description: e.target.value})} placeholder="输入述..." />
            </div>
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <button onClick={closeScheduleModal} style={{ backgroundColor: '#ccc', color: '#333' }}>取消</button>
              <button onClick={handleSaveSchedule}>保孚</button>
            </div>
          </div>
        </div>
      )}

      {/* Template Edit Modal */}
      {isTemplateModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3>{editingTemplate ? '编辑&��板' : '添加模板'}</h3>
            <div className="form-group">
              <label>重 哇䧄则</label>
              <select 
                value={templateForm.ruleType} 
                onChange={e => setTemplateForm({...templateForm, ruleType: e.target.value as any})}
                style={{marginBottom: '0.5rem', width: '100%', padding: '0.5rem'}}
              >
                <option value="daily">悏天</option>
                <option value="weekly">每周</option>
                <option value="monthly">悏月</option>
              </select>
              
              {templateForm.ruleType === 'weekly' && (
                <select 
                  value={templateForm.ruleValue}
                  onChange={e => setTemplateForm({...templateForm, ruleValue: e.target.value})}
                  style={width: '100%', padding: '0.5rem'}}
                >
                  <option value="1">星期一</option>
                  <option value="2">星期二</option>
                  <option value="3">星期三</option>
                  <option value="4">星期四</option>
                  <option value="5">星期五</option>
                  <option value="6">星期冭</option>
                  <option value="0">星期日</option>
                </select>
              )}
              
              {templateForm.ruleType === 'monthly' && (
                <input 
                  type="number" min="1" max="31" 
                  value={templateForm.ruleValue}
                  onChange={e => setTemplateForm({...templateForm, ruleValue: e.target.value})}
                  placeholder="每月几号 (1-31)"
                  style={{width: '100%', padding: '0.5rem', boxSizing: 'border-box'}}
                />
              )}
            </div>

            <div className="form-group">
              <label>时间</label>
              <input type="time" value={templateForm.time} onChange={e => setTemplateForm({...templateForm, time: e.target.value})} />
            </div>
            <div className="form-group">
              <label>�题</label>
              <input type="text" value={templateForm.title} onChange={e => setTemplateForm({...templateForm, title: e.target.value})} placeholder="输入标题..." />
            </div>
            <div className="form-group">
              <label>�#述</label>
              <input type="text" value={templateForm.description} onChange={e => setTemplateForm({...templateForm, description: e.target.value})} placeholder="输入述..." />
            </div>
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <button onClick={closeTemplateModal} style={{ backgroundColor: '#ccc', color: '#333' }}>取消</button>
              <button onClick={handleSaveTemplate}>保孚</button>
            </div>
          </div>
        </div>
      )}


      {/* Health Reminder Modal */}
      {healthStatus && healthStatus.trigger_reminder && (
        <div className="modal" style={{ zIndex: 9999, backgroundColor: 'rgba(255, 0, 0, 0.8)' }}>
          <div className="modal-content" style={{ textAlign: 'center', padding: '2rem' }}>
            <h1 style={{ color: 'red' }}>健康提醒</h1>
            <p>您已经持续活跃了 {Math.floor(healthStatus.active_time / 60)} 分钟，请休息一下！</p>
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button onClick={handleHealthReset} style={{ fontSize: '1.2rem', padding: '0.5rem 1rem' }}>重置计时</button>
              <button onClick={handleHealthNextStage} style={{ fontSize: '1.2rem', padding: '0.5rem 1rem', backgroundColor: '#28a745', color: '#fff' }}>??重置计时</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
