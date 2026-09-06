import { useState, useEffect } from 'react';
import './index.css';
import { API_BASE_URL } from './config';

export default function CalendarWidget() {
  const [schedules, setSchedules] = useState<any[]>([]);

  useEffect(() => {
    let timer: any;
    const fetchSchedule = async () => {
      try {
        // @ts-ignore
        if (!window.api) return;
        const today = new Date().toISOString().split('T')[0];
        // @ts-ignore
        const scheds = await window.api.getSchedules(today);
        setSchedules(scheds || []);
      } catch (e) { }
      timer = setTimeout(fetchSchedule, 10000);
    };
    fetchSchedule();
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      color: '#e0e0e0',
      fontFamily: 'var(--font-sans)',
      WebkitAppRegion: 'drag',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    } as any}>
      <div style={{
        textAlign: 'center', fontSize: '14px', fontWeight: 'bold',
        padding: '8px', letterSpacing: '1px', color: '#ccc',
        backgroundColor: 'rgba(0, 0, 0, 0.7)'
      }}>
        TODAY SCHEDULE
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: '8px', flex: 1,
        padding: '16px', overflowY: 'hidden'
      }}>
        {schedules.map((s, idx) => (
          <div key={idx} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: s.is_completed ? 0.5 : 1,
            textDecoration: s.is_completed ? 'line-through' : 'none'
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{
                fontSize: '10px',
                padding: '2px 4px',
                borderRadius: '4px',
                backgroundColor: s.importance === '必要' ? '#FF6B6B' : s.importance === '重要' ? '#e5d73eff' : '#ADB5BD',
                color: s.importance === '次要' ? '#fff' : '#000'
              }}>{s.importance}</span>
              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{s.title}</span>
            </div>
            {s.is_completed && <span style={{ color: '#44FF44' }}>✓</span>}
          </div>
        ))}
        {schedules.length === 0 && <div style={{ fontSize: '12px', color: '#888', textAlign: 'center' }}>暂无日程</div>}
      </div>
    </div>
  );
}
