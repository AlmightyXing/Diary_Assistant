import sys, re

with open('frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Schedule interface
content = re.sub(
    r'(isGenerated\?: boolean;\n})',
    r'\1\n  is_completed?: boolean;',
    content,
    flags=re.MULTILINE
)
content = content.replace('isGenerated?: boolean;\n\n  is_completed?: boolean;', 'isGenerated?: boolean;\n  is_completed?: boolean;\n')

# 2. Template interface
content = re.sub(
    r'(ruleValue: string; // For weekly: \'0\'-\'6\', For monthly: \'1\'-\'31\'\n})',
    r'ruleValue: string; // For weekly: \'0\'-\'6\', For monthly: \'1\'-\'31\'\n  type?: string;\n}',
    content
)

# 3. confirmModal state
if 'setConfirmModal' not in content:
    content = content.replace(
        "const [scheduleForm, setScheduleForm] = useState<Schedule>({ title: '', description: '', time: '12:00', type: '工作' });",
        "const [scheduleForm, setScheduleForm] = useState<Schedule>({ title: '', description: '', time: '12:00', type: '工作' });\n  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, isDanger?: boolean } | null>(null);"
    )

# 4. Global health polling
polling_code = """
  // --- Health Polling & Notification ---
  const [globalHealthStatus, setGlobalHealthStatus] = useState<any>(null);
  const notifiedRef = React.useRef({ sedentary: false, eye_care: false });

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('http://localhost:8000/health/status');
        const data = await res.json();
        setGlobalHealthStatus(data);

        if (!data.is_suspended) {
          if (data.sedentary.time_left <= 0 && !notifiedRef.current.sedentary) {
            new Notification('健康提醒', { body: data.sedentary.phase === 'sedentary' ? '您已持续坐立，请站起来运动一下吧！' : '运动时间结束，可以坐下啦！' });
            notifiedRef.current.sedentary = true;
          } else if (data.sedentary.time_left > 0) {
            notifiedRef.current.sedentary = false;
          }

          if (data.eye_care.time_left <= 0 && !notifiedRef.current.eye_care) {
            new Notification('用眼提醒', { body: '您已持续看屏幕20分钟，请眺望远方休息20秒！' });
            notifiedRef.current.eye_care = true;
          } else if (data.eye_care.time_left > 0) {
            notifiedRef.current.eye_care = false;
          }
        }
      } catch (e) {}
    };
    if (Notification.permission === 'default') Notification.requestPermission();
    fetchHealth();
    const timer = setInterval(fetchHealth, 1000);
    return () => clearInterval(timer);
  }, []);
"""
if 'setGlobalHealthStatus' not in content:
    content = content.replace(
        '  // --- Auto Upload & Downgrade Mechanism ---',
        polling_code + '\n  // --- Auto Upload & Downgrade Mechanism ---'
    )

# 5. handleDeleteSchedule
old_del_sch = """  const handleDeleteSchedule = async (id: string) => {
    if (confirm('确认删除该日程记录？ [ Y/N ]')) {
      await window.api.deleteSchedule(id);
      loadSchedules(date);
    }
  };"""
new_del_sch = """  const handleDeleteSchedule = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: '删除日程',
      message: '确认删除该日程记录吗？此操作不可撤销。',
      onConfirm: async () => {
        await window.api.deleteSchedule(id);
        loadSchedules(date);
        setConfirmModal(null);
      }
    });
  };

  const handleCompleteSchedule = async (s: Schedule) => {
    if (!s.id) return;
    await window.api.updateSchedule({ ...s, is_completed: true });
    loadSchedules(date);
  };"""
content = content.replace(old_del_sch, new_del_sch)

# 6. handleDeleteTemplate
old_del_tpl = """  const handleDeleteTemplate = async (id: string) => {
    if (confirm('确认删除该固定规则？（不影响已生成的日程） [ Y/N ]')) {
      await window.api.deleteTemplate(id);
      loadTemplates();
    }
  };"""
new_del_tpl = """  const handleDeleteTemplate = async (id: string) => {
    setConfirmModal({
        isOpen: true,
        title: '删除规则',
        message: '确认删除该固定规则？（不影响已生成的日程）',
        isDanger: true,
        onConfirm: async () => {
          await window.api.deleteTemplate(id);
          loadTemplates();
          setConfirmModal(null);
        }
      });
  };"""
content = content.replace(old_del_tpl, new_del_tpl)

# 7. Schedule title
content = content.replace(
    '<strong>{s.title}</strong>',
    '<strong style={{ textDecoration: s.is_completed ? \'line-through\' : \'none\', color: s.is_completed ? \'var(--text-dim)\' : \'var(--text-main)\' }}>{s.title}</strong>'
)

# 8. Schedule actions
old_actions = """                    <div className="schedule-actions">
                      <button onClick={() => openScheduleModal(s)}>编辑</button>
                      <button className="del-btn" onClick={() => handleDeleteSchedule(s.id!)}>删除</button>
                    </div>"""
new_actions = """                    <div className="schedule-actions">
                      <button onClick={() => openScheduleModal(s)} title="编辑">
                        <img src="/data/Edit.png" alt="编辑" />
                      </button>
                      {!s.is_completed && (
                        <button onClick={() => handleCompleteSchedule(s)} title="完成">
                          <img src="/data/Complete.png" alt="完成" />
                        </button>
                      )}
                      <button className="del-btn" onClick={() => handleDeleteSchedule(s.id!)} title="删除">
                        <img src="/data/Delete.png" alt="删除" />
                      </button>
                    </div>"""
content = content.replace(old_actions, new_actions)

# 9. Health string
content = content.replace('健康监控核心', '健康监控')

# 10. Inject confirmModal UI
modal_ui = """
      {/* 自定义确认模态框 */}
      {confirmModal && confirmModal.isOpen && (
        <Modal 
          isOpen={true} 
          onClose={() => setConfirmModal(null)} 
          title={confirmModal.title}
          style={confirmModal.isDanger ? { border: '2px solid var(--accent-red)' } : {}}
        >
          {confirmModal.isDanger && (
            <div style={{
              height: '4px', 
              background: 'repeating-linear-gradient(45deg, #FFC107, #FFC107 10px, #000 10px, #000 20px)',
              margin: '-2rem -2rem 2rem -2rem'
            }} />
          )}
          <p className="mono-text" style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>
            {confirmModal.message}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <Button variant="secondary" onClick={() => setConfirmModal(null)}>取消</Button>
            <Button 
              variant="primary" 
              onClick={confirmModal.onConfirm}
              style={confirmModal.isDanger ? { backgroundColor: 'var(--accent-red)', color: 'white' } : {}}
            >
              确认
            </Button>
          </div>
        </Modal>
      )}
"""
if '自定义确认模态框' not in content:
    content = content.replace(
        '<main className="app-main">',
        '<main className="app-main">' + modal_ui
    )

with open('frontend/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
