import React, { useState, useEffect } from 'react'

declare global {
  interface Window {
    api: {
      getSchedules: (date: string) => Promise<any[]>;
      addSchedule: (item: any) => Promise<any>;
      updateSchedule: (item: any) => Promise<any>;
      deleteSchedule: (id: string) => Promise<boolean>;
    }
  }
}

interface Schedule {
  id?: string;
  date: string;
  title: string;
  description: string;
  time: string;
}

export default function App() {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Schedule | null>(null);

  const [form, setForm] = useState({ title: '', description: '', time: '12:00' });

  useEffect(() => {
    loadSchedules(date);
  }, [date]);

  const loadSchedules = async (d: string) => {
    if (window.api) {
      const data = await window.api.getSchedules(d);
      setSchedules(data);
    }
  };

  const openModal = (item?: Schedule) => {
    if (item) {
      setEditingItem(item);
      setForm({ title: item.title, description: item.description, time: item.time });
    } else {
      setEditingItem(null);
      setForm({ title: '', description: '', time: '12:00' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleSave = async () => {
    if (!form.title) return;
    const itemToSave = { ...form, date };
    
    if (editingItem && editingItem.id) {
      await window.api.updateSchedule({ ...itemToSave, id: editingItem.id });
    } else {
      await window.api.addSchedule(itemToSave);
    }
    
    closeModal();
    loadSchedules(date);
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除吗？')) {
      await window.api.deleteSchedule(id);
      loadSchedules(date);
    }
  };

  return (
    <div className="container">
      <header>
        <h2>日程管理 ({date})</h2>
        <div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          <button onClick={() => openModal()}>添加日程</button>
        </div>
      </header>
      
      <ul className="schedule-list">
        {schedules.length === 0 ? <p>暂无日程</p> : schedules.map(s => (
          <li key={s.id} className="schedule-item">
            <div>
              <strong>{s.time}</strong> - {s.title}
              <p style={{ margin: '0.5rem 0 0', color: '#666' }}>{s.description}</p>
            </div>
            <div>
              <button onClick={() => openModal(s)}>编辑</button>
              <button className="delete" onClick={() => handleDelete(s.id!)}>删除</button>
            </div>
          </li>
        ))}
      </ul>

      {isModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3>{editingItem ? '编辑日程' : '添加日程'}</h3>
            <div className="form-group">
              <label>时间</label>
              <input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
            </div>
            <div className="form-group">
              <label>标题</label>
              <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="输入标题..." />
            </div>
            <div className="form-group">
              <label>描述</label>
              <input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="输入描述..." />
            </div>
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <button onClick={closeModal} style={{ backgroundColor: '#ccc', color: '#333' }}>取消</button>
              <button onClick={handleSave}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
