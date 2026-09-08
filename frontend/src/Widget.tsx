import { useState, useEffect, useRef } from 'react';
import './index.css';
import { API_BASE_URL } from './config';

const formatTime = (seconds: number) => {
  if (seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function Widget() {
  const [health, setHealth] = useState<any>(null);
  const prevPhase = useRef<string | null>(null);

  useEffect(() => {
    let timer: any;
    const fetchHealth = async () => {
      try {
        const res = await fetch(API_BASE_URL + '/health/status');
        const data = await res.json();
        setHealth(data);
        prevPhase.current = data.sedentary.phase;
      } catch (e) {
        // ignore
      }
      timer = setTimeout(fetchHealth, 1000);
    };
    fetchHealth();
    return () => clearTimeout(timer);
  }, []);

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
    <>
      <div style={{
        width: '80vw',
        height: '100vh',
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
          HEALTH MONITOR
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: '12px', flex: 1,
          justifyContent: 'flex-start', paddingTop: '8px', padding: '16px',
          backgroundColor: 'rgba(0, 0, 0, 0.4)'
        }}>
          {health && (
            <>
              <div
                onClick={() => wakeUp('health')}
                style={{ WebkitAppRegion: 'no-drag', cursor: 'pointer', display: 'flex', flexDirection: 'column', position: 'relative' } as any}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#ffffffff', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {health.sedentary.phase === 'sedentary' ? 'Sedentary' : 'Exercise'}
                    {health.is_paused && <span style={{ color: 'var(--accent-yellow)', fontSize: '10px' }}>(PAUSED)</span>}
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
    </>
  );
}
