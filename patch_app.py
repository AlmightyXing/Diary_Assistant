with open('frontend/src/App.tsx', 'rb') as f:
    content = f.read()

health_logic = b'''
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
'''

content = content.replace(b'  return (', health_logic, 1)

modal_ui = '''
      {/* Health Reminder Modal */}
      {healthStatus && healthStatus.trigger_reminder && (
        <div className="modal" style={{ zIndex: 9999, backgroundColor: 'rgba(255, 0, 0, 0.8)' }}>
          <div className="modal-content" style={{ textAlign: 'center', padding: '2rem' }}>
            <h1 style={{ color: 'red' }}>????</h1>
            <p>???????? {Math.floor(healthStatus.active_time / 60)} ?????????</p>
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button onClick={handleHealthReset} style={{ fontSize: '1.2rem', padding: '0.5rem 1rem' }}>????</button>
              <button onClick={handleHealthNextStage} style={{ fontSize: '1.2rem', padding: '0.5rem 1rem', backgroundColor: '#28a745', color: '#fff' }}>??????</button>
            </div>
          </div>
        </div>
      )}
'''.encode('utf-8')

# Depending on line endings it could be CRLF or LF
# Let's use re in binary
import re
content = re.sub(b'    </div>\\r?\\n  \\);\\r?\\n}', modal_ui + b'    </div>\\n  );\\n}', content)

with open('frontend/src/App.tsx', 'wb') as f:
    f.write(content)
