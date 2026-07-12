import React, { useState, useEffect } from 'react';
import { Card } from './components/Card';
import { Button } from './components/Button';

export default function DiaryPanel({ date, schedules }: { date: string, schedules: any[] }) {
  const [appStats, setAppStats] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedDiary, setSavedDiary] = useState('');

  useEffect(() => {
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
      alert('生成失败');
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
      alert('保存成功');
    } catch (e) {
      console.error(e);
      alert('保存失败');
    }
  };

  return (
    <div>
      <h2 className="tech-heading" style={{ fontSize: '3rem', marginBottom: '2rem' }}>日志生成</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <Card title="原始日程">
          <pre className="mono-text" style={{ whiteSpace: 'pre-wrap', color: 'var(--text-dim)', margin: 0, minHeight: '100px' }}>
            {scheduleText || '// 暂无数据'}
          </pre>
        </Card>
        <Card title="原始应用使用记录">
          <pre className="mono-text" style={{ whiteSpace: 'pre-wrap', color: 'var(--text-dim)', margin: 0, minHeight: '100px' }}>
            {appStatsText || '// 暂无数据'}
          </pre>
        </Card>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <Button variant="primary" onClick={() => setIsConfirmOpen(true)} disabled={isGenerating}>
          {isGenerating ? '[ 处理中... ]' : (savedDiary ? '[ 重新生成 ]' : '[ 生成草稿 ]')}
        </Button>
        {isConfirmOpen && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ borderColor: 'var(--accent-red)', boxShadow: '8px 8px 0px var(--accent-red)' }}>
              <h3 className="tech-heading" style={{ color: 'var(--accent-red)', marginBottom: '1rem' }}>隐私警告</h3>
              <p className="mono-text" style={{ marginBottom: '2rem', lineHeight: '1.5' }}>
                您的日程和应用使用数据将被发送到 LLM API。<br/>
                是否继续？
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <Button variant="secondary" onClick={() => setIsConfirmOpen(false)} style={{ flex: 1 }}>中止</Button>
                <Button variant="danger" onClick={generateDraft} style={{ flex: 1 }}>确认</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {draft && (
        <Card title="编辑终端">
          <textarea 
            className="mono-text"
            style={{ 
              width: '100%', 
              height: '300px', 
              resize: 'vertical',
              backgroundColor: 'var(--bg-panel)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-color)',
              padding: '1rem',
              boxSizing: 'border-box'
            }}
            value={draft}
            onChange={e => setDraft(e.target.value)}
          />
          <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
            <Button variant="primary" onClick={saveDiary}>[ 保存最终版 ]</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
