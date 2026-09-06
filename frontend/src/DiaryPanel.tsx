import { useState, useEffect } from 'react';
import { Card } from './components/Card';
import { Button } from './components/Button';
import { API_BASE_URL } from './config';
import UploadIcon from './assets/icons/DataUpload.png'
import Diary from './assets/icons/DIARY.svg';

export default function DiaryPanel({ date, schedules }: { date: string, schedules: any[] }) {
  const [appStats, setAppStats] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedDiary, setSavedDiary] = useState('');

  useEffect(() => {
    fetch(API_BASE_URL + '/stats')
      .then(r => r.json())
      .then(data => setAppStats(data))
      .catch(e => console.error(e));

    fetch(API_BASE_URL + '/diary/' + date)
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

  const scheduleText = schedules.map(s => s.title + ' (' + s.importance + ')').join('\n');
  const appStatsText = appStats.map(s => s.app_name + ': ' + (s.active_time_seconds || 0) + 's').join('\n');

  const generateDraft = async () => {
    setIsGenerating(true);
    setIsConfirmOpen(false);
    try {
      const res = await fetch(API_BASE_URL + '/generate-diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule_text: scheduleText, app_stats_text: appStatsText, api_key: localStorage.getItem('deepseek_api_key') || null })
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
      await fetch(API_BASE_URL + '/save-diary', {
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
      <img src={Diary} alt="今日日程" style={{ width: 'auto', height: '100px', marginBottom: '1rem' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <Card title="当日日程">
          <pre className="mono-text" style={{ whiteSpace: 'pre-wrap', color: 'var(--text-dim)', margin: 0, minHeight: '100px' }}>
            {scheduleText || '// 暂无数据'}
          </pre>
        </Card>
        <Card title="当日记录">
          <pre className="mono-text" style={{ whiteSpace: 'pre-wrap', color: 'var(--text-dim)', margin: 0, minHeight: '100px' }}>
            {appStatsText || '// 暂无数据'}
          </pre>
        </Card>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <Button variant="primary" onClick={() => setIsConfirmOpen(true)} disabled={isGenerating} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isGenerating ? '[ 处理中... ]' : (
            <>
              {savedDiary ? '重新生成' : '生成草稿'}
              <img src={UploadIcon} alt="Upload" style={{ width: '20px', height: '20px' }} />
            </>
          )}
        </Button>
        {isConfirmOpen && (
          <div className="modal-overlay">
            <div className="modal-content" style={{
              border: '4px solid #FF0000',
              background: '#000000',
              color: '#FFFFFF',
              boxShadow: '0 0 20px rgba(255, 0, 0, 0.5)',
              position: 'relative'
            }}>
              {/* Warning Tape Decoration */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '8px',
                background: 'repeating-linear-gradient(45deg, #FFD700, #FFD700 10px, #000000 10px, #000000 20px)'
              }}></div>
              <h3 className="tech-heading" style={{ color: '#FF0000', marginTop: '1rem', marginBottom: '1rem', textShadow: '0 0 5px #FF0000' }}>// 危险操作确认</h3>
              <p className="mono-text" style={{ marginBottom: '2rem', lineHeight: '1.5', color: '#FFD700' }}>
                WARNING: 数据传输至外部 LLM 接口。<br />
                您的隐私日程和应用使用数据将被发送。<br />
                是否确认执行？
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <Button variant="secondary" onClick={() => setIsConfirmOpen(false)} style={{ flex: 1, backgroundColor: '#333', color: '#FFF' }}>中止</Button>
                <Button variant="danger" onClick={generateDraft} style={{ flex: 1, backgroundColor: '#FF0000', color: '#FFF' }}>强制执行</Button>
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
