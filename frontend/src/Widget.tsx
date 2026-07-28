import { useState, useEffect } from 'react';
import './index.css';
import { API_BASE_URL } from './config';

const formatTime = (seconds: number) => {
  if (seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function Widget() {
  const [components, setComponents] = useState<string[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [nextSchedule, setNextSchedule] = useState<any>(null);

  const loadSettings = () => {
    const comps = JSON.parse(localStorage.getItem('widget_components') || '["health", "schedules"]');
    setComponents(comps);
  };

  useEffect(() => {
    loadSettings();
    const handleStorage = () => loadSettings();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    let timer: any;
    const fetchHealth = async () => {
      if (components.includes('health')) {
        try {
          const res = await fetch(API_BASE_URL + '/health/status');
          const data = await res.json();
          setHealth(data);
        } catch (e) {
          // ignore
        }
      }
      timer = setTimeout(fetchHealth, 1000);
    };
    fetchHealth();
    return () => clearTimeout(timer);
  }, [components]);

  useEffect(() => {
    let timer: any;
    const fetchSchedule = async () => {
      if (components.includes('schedules')) {
        try {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          if (!window.api) return;
          const today = new Date().toISOString().split('T')[0];
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const schedules = await window.api.getSchedules(today);
          const now = new Date();
          const nowStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
          const upcoming = schedules.find((s: any) => s.time >= nowStr && !s.is_completed);
          setNextSchedule(upcoming || null);
        } catch (e) { }
      }
      timer = setTimeout(fetchSchedule, 10000);
    };
    fetchSchedule();
    return () => clearTimeout(timer);
  }, [components]);

  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);

  const wakeUp = (tab: string) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (window.api && window.api.wakeUpMain) window.api.wakeUpMain(tab);
  };

  return (
    <div style={{
      width: '80vw',
      height: '80vh',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      backgroundColor: 'transparent',
      color: '#e0e0e0',
      fontFamily: 'var(--font-mono), monospace',
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
        HEALTHCYCLE
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: '12px', flex: 1,
        justifyContent: 'center', padding: '16px',
        backgroundColor: 'rgba(0, 0, 0, 0.4)'
      }}>
        {components.includes('schedules') && (
          <div
            onClick={() => wakeUp('schedules')}
            style={{ WebkitAppRegion: 'no-drag', cursor: 'pointer', display: 'flex', flexDirection: 'column', position: 'relative' } as any}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', color: '#ffffffff', fontWeight: 'bold' }}>NEXT SCHEDULE</div>
              <div style={{ fontSize: '12px', color: '#e0e0e0', fontWeight: 'bold' }}>
                {nextSchedule ? nextSchedule.time : '--:--'}
              </div>
            </div>
            {/* Fake progress bar track for schedule to match layout */}
            <div style={{ marginTop: '4px', height: '2px', backgroundColor: 'rgba(255,255,255,0.1)', width: '100%' }}>
              <div style={{ height: '100%', backgroundColor: 'var(--accent-yellow, #e5a910)', width: nextSchedule ? '100%' : '0%' }} />
            </div>
          </div>
        )}

        {components.includes('health') && health && (
          <>
            <div
              onClick={() => wakeUp('health')}
              style={{ WebkitAppRegion: 'no-drag', cursor: 'pointer', display: 'flex', flexDirection: 'column', position: 'relative' } as any}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', color: '#ffffffff', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  {health.sedentary.phase === 'sedentary' ? 'Sedentary' : 'Exercise'}
                </div>
                <div style={{ fontSize: '12px', color: '#e0e0e0', fontWeight: 'bold' }}>
                  {formatTime(health.sedentary.time_left)}
                </div>
              </div>
              <div style={{ marginTop: '4px', height: '2px', backgroundColor: '#333', width: '100%' }}>
                <div style={{ height: '100%', backgroundColor: 'var(--accent-yellow, #e5a910)', width: `${Math.max(0, Math.min(100, (health.sedentary.time_left / (health.sedentary.total || 1)) * 100))}%` }} />
              </div>
            </div>

            <div
              onClick={() => wakeUp('health')}
              style={{ WebkitAppRegion: 'no-drag', cursor: 'pointer', display: 'flex', flexDirection: 'column', position: 'relative' } as any}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', color: '#ffffffff', fontWeight: 'bold', textTransform: 'uppercase' }}>Eye Care</div>
                <div style={{ fontSize: '12px', color: '#e0e0e0', fontWeight: 'bold' }}>
                  {formatTime(health.eye_care.time_left)}
                </div>
              </div>
              <div style={{ marginTop: '4px', height: '2px', backgroundColor: '#333', width: '100%' }}>
                <div style={{ height: '100%', backgroundColor: 'var(--accent-yellow, #e5a910)', width: `${Math.max(0, Math.min(100, (health.eye_care.time_left / (health.eye_care.total || 1)) * 100))}%` }} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
