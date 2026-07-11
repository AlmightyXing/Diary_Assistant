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
  const [activeTab, setActiveTab] = useState<'schedules' | 'templates' | 'diary'>('schedules');
  
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
    if (confirm('纭鈹瑕戝垹闄よ繖涓棩绋#鍚?')) {
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
    if (confirm('纭鈹瑕戝垹闄よ繖涓浐瀹氭ā鏉垮悧?锛堜笉褰卞搷宸茬粡淇敼瑁囩殑鍗曟棩瀹炰净锛?)) {
      await window.api.deleteTemplate(id);
      loadTemplates();
    }
  };

  const renderRuleLabel = (tpl: Template) => {
    if (tpl.ruleType === 'daily') return '姣忓ぉ';
    if (tpl.ruleType === 'weekly') {
      const days = ['鍛ㄦ棩','鍛ㄤ竵','鍛ㄤ簜','鍛ㄤ笁','鍛ㄥ洓','鍛ㄤ簲','鍛ㄥ啳'];
      return `姣?{days[parseInt(tpl.ruleValue || '0')]}`;
    }
    if (tpl.ruleType === 'monthly') return `姣忔湀 ${tpl.ruleValue} 鏃;
    return '娲煣瑙勫垨';
  };

  return (
    <div className="container">
      <nav style={{ marginBottom: '1rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>
        <button 
          style={{ marginRight: '1rem', fontWeight: activeTab === 'schedules' ? 'bold' : 'normal' }}
          onClick={() => setActiveTab('schedules')}
        >鏃ュ父鏃ョ?</button>
        <button 
          style={{ fontWeight: activeTab === 'templates' ? 'bold' : 'normal' }}
          onClick={() => setActiveTab('templates')}
        >鍥哄畾鏃ョ?(妯℃澘)</button>
        <button style={{ fontWeight: activeTab === 'diary' ? 'bold' : 'normal', marginLeft: '1rem' }} onClick={() => setActiveTab('diary')}>鏃ヨ鐢熸垚</button>
      </nav>

      {activeTab === 'schedules' && (
        <>
          <header>
            <h2>鏃ョ?绠＄悊 ({date})</h2>
            <div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
              <button onClick={() => openScheduleModal()}>娣诲姞鏃ョ?</button>
            </div>
          </header>
          
          <ul className="schedule-list">
            {schedules.length === 0 ? <p>鏆㈡棤鏃ョ?</p> : schedules.map(s => (
              <li key={s.id} className="schedule-item">
                <div>
                  <strong>{s.time}</strong> - {s.title}
                  {s.isGenerated && <span style={{fontSize: '0.8em', marginLeft: '0.5rem', background: '#eee', padding: '2px 4px', borderRadius: '4px'}}>鑷姩鐢?/span>}
                  <p style={{ margin: '0.5rem 0 0', color: '#666' }}>{s.description}</p>
                </div>
                <div>
                  <button onClick={() => openScheduleModal(s)}>缂栬緫</button>
                  <button className="delete" onClick={() => handleDeleteSchedule(s.id!)}>鍒犻櫎</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {activeTab === 'templates' && (
        <>
          <header>
            <h2>鍥哄畾鏃ョ?妯℃澘</h2>
            <div>
              <button onClick={() => openTemplateModal()}>娣诲姞妯℃澘</button>
            </div>
          </header>
          
          <ul className="schedule-list">
            {templates.length === 0 ? <p>鏆㈡棤鍥哄畾妯℃澘</p> : templates.map(t => (
              <li key={t.id} className="schedule-item">
                <div>
                  <strong>{t.time}</strong> - {t.title} 
                  <span style={{color: '#007bff', marginLeft: '0.5rem'}}>[{renderRuleLabel(t)}]</span>
                  <p style={{ margin: '0.5rem 0 0', color: '#666' }}>{t.description}</p>
                </div>
                <div>
                  <button onClick={() => openTemplateModal(t)}>缂栬緫</button>
                  <button className="delete" onClick={() => handleDeleteTemplate(t.id!)}>鍒犻櫎</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {activeTab === 'diary' && <DiaryPanel date={date} schedules={schedules} />}
      {/* Schedule Edit Modal */}
      {isScheduleModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3>{editingSchedule ? '缂栬緫鏃ョ?' : '娣诲姞鏃ョ?'}</h3>
            {editingSchedule && editingSchedule.templateId && (
              <div style={{marginBottom: '1rem', padding: '0.5rem', background: '#e9f5ff', borderRadius: '4px'}}>
                <span style={{fontSize: '0.9em'}}>姝ゆ棩绋ｇ敱鍥哄畾妯℃澘鐢熸垚銆?/span>
                <button 
                  style={{marginLeft: '1rem', fontSize: '0.8em'}}
                  onClick={() => gotoTemplate(editingSchedule.templateId!)}
                >鍓嶅線淇敼妯℃澘</button>
              </div>
            )}
            <div className="form-group">
              <label>鏃堕棿</label>
              <input type="time" value={scheduleForm.time} onChange={e => setScheduleForm({...scheduleForm, time: e.target.value})} />
            </div>
            <div className="form-group">
              <label>鏍囬</label>
              <input type="text" value={scheduleForm.title} onChange={e => setScheduleForm({...scheduleForm, title: e.target.value})} placeholder="杈撳叆鏍囬..." />
            </div>
            <div className="form-group">
              <label>?杩?/label>
              <input type="text" value={scheduleForm.description} onChange={e => setScheduleForm({...scheduleForm, description: e.target.value})} placeholder="杈撳叆杩?.." />
            </div>
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <button onClick={closeScheduleModal} style={{ backgroundColor: '#ccc', color: '#333' }}>鍙栨秷</button>
              <button onClick={handleSaveSchedule}>淇濆瓪</button>
            </div>
          </div>
        </div>
      )}

      {/* Template Edit Modal */}
      {isTemplateModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3>{editingTemplate ? '缂栬緫&ā鏉? : '娣诲姞妯℃澘'}</h3>
            <div className="form-group">
              <label>閲?鍝囦鍒?/label>
              <select 
                value={templateForm.ruleType} 
                onChange={e => setTemplateForm({...templateForm, ruleType: e.target.value as any})}
                style={{marginBottom: '0.5rem', width: '100%', padding: '0.5rem'}}
              >
                <option value="daily">鎮忓ぉ</option>
                <option value="weekly">姣忓懆</option>
                <option value="monthly">鎮忔湀</option>
              </select>
              
              {templateForm.ruleType === 'weekly' && (
                <select 
                  value={templateForm.ruleValue}
                  onChange={e => setTemplateForm({...templateForm, ruleValue: e.target.value})}
                  style={width: '100%', padding: '0.5rem'}}
                >
                  <option value="1">鏄熸湡涓€</option>
                  <option value="2">鏄熸湡浜?/option>
                  <option value="3">鏄熸湡涓?/option>
                  <option value="4">鏄熸湡鍥?/option>
                  <option value="5">鏄熸湡浜?/option>
                  <option value="6">鏄熸湡鍐?/option>
                  <option value="0">鏄熸湡鏃?/option>
                </select>
              )}
              
              {templateForm.ruleType === 'monthly' && (
                <input 
                  type="number" min="1" max="31" 
                  value={templateForm.ruleValue}
                  onChange={e => setTemplateForm({...templateForm, ruleValue: e.target.value})}
                  placeholder="姣忔湀鍑犲彿 (1-31)"
                  style={{width: '100%', padding: '0.5rem', boxSizing: 'border-box'}}
                />
              )}
            </div>

            <div className="form-group">
              <label>鏃堕棿</label>
              <input type="time" value={templateForm.time} onChange={e => setTemplateForm({...templateForm, time: e.target.value})} />
            </div>
            <div className="form-group">
              <label>鎳棰?/label>
              <input type="text" value={templateForm.title} onChange={e => setTemplateForm({...templateForm, title: e.target.value})} placeholder="杈撳叆鏍囬..." />
            </div>
            <div className="form-group">
              <label>?杩?/label>
              <input type="text" value={templateForm.description} onChange={e => setTemplateForm({...templateForm, description: e.target.value})} placeholder="杈撳叆杩?.." />
            </div>
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <button onClick={closeTemplateModal} style={{ backgroundColor: '#ccc', color: '#333' }}>鍙栨秷</button>
              <button onClick={handleSaveTemplate}>淇濆瓪</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


function DiaryPanel({ date, schedules }: { date: string, schedules: any[] }) {
  const [appStats, setAppStats] = React.useState<any[]>([]);
  const [draft, setDraft] = React.useState('');
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [savedDiary, setSavedDiary] = React.useState('');

  React.useEffect(() => {
    fetch('http://localhost:8000/stats')
      .then(r => r.json())
      .then(data => setAppStats(data))
      .catch(e => console.error(e));
      
    fetch('http://localhost:8000/diary/' + date)
      .then(r => r.json())
      .then(data => {
        if (data && data.content) {
          setSavedDiary(data.content);
          setDraft(data.content);
        } else {
          setSavedDiary('');
          setDraft('');
        }
      })
      .catch(e => console.error(e));
  }, [date]);

  const scheduleText = schedules.map(s => s.time + ' ' + s.title).join('\n');
  const appStatsText = appStats.map(s => s.app_name + ': ' + (s.active_time_seconds || 0) + 's').join('\n');

  const generateDraft = async () => {
    setIsGenerating(true);
    setIsConfirmOpen(false);
    try {
      const res = await fetch('http://localhost:8000/generate-diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule_text: scheduleText, app_stats_text: appStatsText })
      });
      const data = await res.json();
      setDraft(data.draft);
    } catch (e) {
      console.error(e);
      alert('鐢熸垚澶辫触');
    }
    setIsGenerating(false);
  };

  const saveDiary = async () => {
    try {
      await fetch('http://localhost:8000/save-diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, content: draft })
      });
      setSavedDiary(draft);
      alert('淇濆瓨鎴愬姛');
    } catch (e) {
      console.error(e);
      alert('淇濆瓨澶辫触');
    }
  };

  return (
    <div>
      <header>
        <h2>鐢熸垚鏃ヨ ({date})</h2>
      </header>
      
      <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', marginTop: '1rem' }}>
        <div style={{ flex: 1, padding: '1rem', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h4 style={{marginTop: 0}}>浠婃棩鏃ョ▼</h4>
          <pre style={{whiteSpace: 'pre-wrap', fontFamily: 'inherit'}}>{scheduleText || '鏃?}</pre>
        </div>
        <div style={{ flex: 1, padding: '1rem', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h4 style={{marginTop: 0}}>搴旂敤浣跨敤璁板綍</h4>
          <pre style={{whiteSpace: 'pre-wrap', fontFamily: 'inherit'}}>{appStatsText || '鏃?}</pre>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <button onClick={() => setIsConfirmOpen(true)} disabled={isGenerating}>
          {isGenerating ? '鐢熸垚涓?..' : (savedDiary ? '閲嶆柊鐢熸垚' : '鐢熸垚鏃ヨ鍒濈')}
        </button>
        {isConfirmOpen && (
          <div className="modal">
            <div className="modal-content">
              <h3>椋庨櫓鎻愮ず</h3>
              <p>鍗冲皢鎶婃偍鐨勬棩绋嬪拰搴旂敤浣跨敤璁板綍鍙戦€佽嚦澶ц瑷€妯″瀷API锛岃繖鍙兘瀛樺湪闅愮椋庨櫓锛屾槸鍚︾户缁紵</p>
              <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                <button onClick={() => setIsConfirmOpen(false)} style={{ background: '#ccc', color: '#333', marginRight: '1rem' }}>鍙栨秷</button>
                <button onClick={generateDraft} style={{ background: '#ff4d4f', color: '#fff' }}>纭涓婁紶骞剁敓鎴?/button>
              </div>
            </div>
          </div>
        )}
      </div>

      {draft && (
        <div style={{ marginTop: '1rem' }}>
          <h4>缂栬緫鏃ヨ</h4>
          <textarea 
            style={{ width: '100%', height: '300px', padding: '1rem', fontFamily: 'inherit', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
            value={draft}
            onChange={e => setDraft(e.target.value)}
          />
          <div style={{ marginTop: '1rem', textAlign: 'right' }}>
            <button onClick={saveDiary}>淇濆瓨瀹氱</button>
          </div>
        </div>
      )}
    </div>
  );
}
