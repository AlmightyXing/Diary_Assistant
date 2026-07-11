const fs = require('fs');
let content = fs.readFileSync('frontend/src/App.tsx', 'utf8');

// Add diary tab state
content = content.replace(
    /const \[activeTab, setActiveTab\] = useState<'schedules' \| 'templates'>\('schedules'\);/g,
    "const [activeTab, setActiveTab] = useState<'schedules' | 'templates' | 'diary'>('schedules');"
);

// Find </nav>
const navEnd = content.indexOf('</nav>');
if (navEnd !== -1) {
    const newNav = '  <button style={{ fontWeight: activeTab === \'diary\' ? \'bold\' : \'normal\', marginLeft: \'1rem\' }} onClick={() => setActiveTab(\'diary\')}>日记生成</button>\n      </nav>';
    content = content.substring(0, navEnd) + newNav + content.substring(navEnd + 6);
}

const diaryPanelCode = `
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

  const scheduleText = schedules.map(s => s.time + ' ' + s.title).join('\\n');
  const appStatsText = appStats.map(s => s.app_name + ': ' + (s.active_time_seconds || 0) + 's').join('\\n');

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
      <header>
        <h2>生成日记 ({date})</h2>
      </header>
      
      <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', marginTop: '1rem' }}>
        <div style={{ flex: 1, padding: '1rem', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h4 style={{marginTop: 0}}>今日日程</h4>
          <pre style={{whiteSpace: 'pre-wrap', fontFamily: 'inherit'}}>{scheduleText || '无'}</pre>
        </div>
        <div style={{ flex: 1, padding: '1rem', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h4 style={{marginTop: 0}}>应用使用记录</h4>
          <pre style={{whiteSpace: 'pre-wrap', fontFamily: 'inherit'}}>{appStatsText || '无'}</pre>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <button onClick={() => setIsConfirmOpen(true)} disabled={isGenerating}>
          {isGenerating ? '生成中...' : (savedDiary ? '重新生成' : '生成日记初稿')}
        </button>
        {isConfirmOpen && (
          <div className="modal">
            <div className="modal-content">
              <h3>风险提示</h3>
              <p>即将把您的日程和应用使用记录发送至大语言模型API，这可能存在隐私风险，是否继续？</p>
              <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                <button onClick={() => setIsConfirmOpen(false)} style={{ background: '#ccc', color: '#333', marginRight: '1rem' }}>取消</button>
                <button onClick={generateDraft} style={{ background: '#ff4d4f', color: '#fff' }}>确认上传并生成</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {draft && (
        <div style={{ marginTop: '1rem' }}>
          <h4>编辑日记</h4>
          <textarea 
            style={{ width: '100%', height: '300px', padding: '1rem', fontFamily: 'inherit', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
            value={draft}
            onChange={e => setDraft(e.target.value)}
          />
          <div style={{ marginTop: '1rem', textAlign: 'right' }}>
            <button onClick={saveDiary}>保存定稿</button>
          </div>
        </div>
      )}
    </div>
  );
}
`;

content += "\n" + diaryPanelCode;

const diaryRender = "{activeTab === 'diary' && <DiaryPanel date={date} schedules={schedules} />}\n";
const modalSearch = "{/* Schedule Edit Modal */}";
if (content.includes(modalSearch)) {
    content = content.replace(modalSearch, diaryRender + "      " + modalSearch);
} else {
    const lastDiv = content.lastIndexOf("</div>");
    if (lastDiv !== -1) {
        content = content.substring(0, lastDiv) + diaryRender + content.substring(lastDiv);
    }
}

fs.writeFileSync('frontend/src/App.tsx', content, 'utf8');
