import sys
import time

with open('backend/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add HealthTracker
health_tracker_code = '''def get_active_window_title():
    try:
        hwnd = win32gui.GetForegroundWindow()
        if hwnd:
            return win32gui.GetWindowText(hwnd)
    except Exception:
        pass
    return ""

class HealthTracker:
    def __init__(self):
        self.active_time = 0.0
        self.limit = 45 * 60  # 45 minutes of focus
        self.idle_threshold = 5 * 60 * 1000  # 5 minutes in ms
        self.stage = "focus"
        self.trigger_reminder = False
        
    def reset(self):
        self.active_time = 0.0
        self.trigger_reminder = False
        
    def next_stage(self):
        if self.stage == "focus":
            self.stage = "rest"
            self.active_time = 0.0
            self.limit = 5 * 60  # 5 minutes rest
            self.trigger_reminder = False
        else:
            self.stage = "focus"
            self.active_time = 0.0
            self.limit = 45 * 60  # 45 minutes focus
            self.trigger_reminder = False

health_tracker = HealthTracker()'''

content = content.replace('''def get_active_window_title():
    try:
        hwnd = win32gui.GetForegroundWindow()
        if hwnd:
            return win32gui.GetWindowText(hwnd)
    except Exception:
        pass
    return ""''', health_tracker_code)

# 2. Add logic to tracking_loop
tracking_loop_new = '''def tracking_loop():
    last_checked = time.time()
    while True:
        now = time.time()
        dt = now - last_checked
        last_checked = now
        
        # Health tracking logic
        try:
            idle_time_ms = win32api.GetTickCount() - win32api.GetLastInputInfo()
            if idle_time_ms < health_tracker.idle_threshold:
                if not health_tracker.trigger_reminder:
                    health_tracker.active_time += dt
                    if health_tracker.active_time >= health_tracker.limit:
                        health_tracker.trigger_reminder = True
        except Exception as e:
            print(f"Error in health tracking: {e}")

        title = get_active_window_title()'''
content = content.replace('''def tracking_loop():
    while True:
        title = get_active_window_title()''', tracking_loop_new)


# 3. Add Endpoints
endpoints = '''@app.delete("/whitelist")
def remove_whitelist(item: WhitelistItem):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM whitelist WHERE app_name = ?', (item.app_name,))
    conn.commit()
    conn.close()
    return {"status": "success", "app_name": item.app_name}

@app.get("/health/status")
def get_health_status():
    return {
        "stage": health_tracker.stage,
        "active_time": health_tracker.active_time,
        "limit": health_tracker.limit,
        "trigger_reminder": health_tracker.trigger_reminder,
        "is_suspended": (win32api.GetTickCount() - win32api.GetLastInputInfo()) >= health_tracker.idle_threshold
    }

@app.post("/health/reset")
def reset_health():
    health_tracker.reset()
    return {"status": "success"}

@app.post("/health/next_stage")
def next_health_stage():
    health_tracker.next_stage()
    return {"status": "success"}'''

content = content.replace('''@app.delete("/whitelist")
def remove_whitelist(item: WhitelistItem):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM whitelist WHERE app_name = ?', (item.app_name,))
    conn.commit()
    conn.close()
    return {"status": "success", "app_name": item.app_name}''', endpoints)

with open('backend/main.py', 'w', encoding='utf-8') as f:
    f.write(content)
