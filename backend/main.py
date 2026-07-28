import time
import win32gui
import win32api
import threading
import sqlite3
import os
import json
import ssl
import urllib.request
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()


# Removed win10toast as notifications are now handled by frontend


import pygetwindow as gw

APP_DIR = os.path.expanduser('~/.diary_assistant')
if not os.path.exists(APP_DIR):
    os.makedirs(APP_DIR)
DB_FILE = os.path.join(APP_DIR, 'stats.db')

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS whitelist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_name TEXT UNIQUE NOT NULL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS app_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_name TEXT UNIQUE NOT NULL,
            active_time_seconds INTEGER DEFAULT 0
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS diaries (
            date TEXT PRIMARY KEY,
            content TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    cursor.execute('SELECT COUNT(*) FROM whitelist')
    if cursor.fetchone()[0] == 0:
        default_apps = ['Code', 'Chrome', 'Notepad']
        for app_name in default_apps:
            cursor.execute('INSERT OR IGNORE INTO whitelist (app_name) VALUES (?)', (app_name,))
    conn.commit()
    conn.close()

def get_active_window_title():
    try:
        hwnd = win32gui.GetForegroundWindow()
        if hwnd:
            return win32gui.GetWindowText(hwnd)
    except Exception:
        pass
    return ""

class HealthTracker:
    def __init__(self):
        self.idle_threshold = 5 * 60 * 1000  # 5 minutes in ms
        self.sedentary_duration = 45 * 60
        self.exercise_duration = 5 * 60
        self.eye_care_total = 20 * 60
        
        self.load_settings()
        
        self.phase = 'sedentary' # 'sedentary' or 'exercise'
        self.sedentary_left = self.sedentary_duration
        self.eye_care_left = self.eye_care_total
        self.is_suspended = False

    def load_settings(self):
        try:
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            for key, default_val in [
                ('sedentary_duration', 45 * 60),
                ('exercise_duration', 5 * 60),
                ('eye_care_total', 20 * 60)
            ]:
                cursor.execute('SELECT value FROM settings WHERE key = ?', (key,))
                row = cursor.fetchone()
                if row:
                    setattr(self, key, int(row[0]))
                else:
                    setattr(self, key, default_val)
            conn.close()
        except Exception as e:
            print(f"Error loading settings: {e}")

    def update_settings(self, sedentary_minutes, exercise_minutes, eye_care_minutes):
        self.sedentary_duration = sedentary_minutes * 60
        self.exercise_duration = exercise_minutes * 60
        self.eye_care_total = eye_care_minutes * 60
        
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute('REPLACE INTO settings (key, value) VALUES (?, ?)', ('sedentary_duration', str(self.sedentary_duration)))
        cursor.execute('REPLACE INTO settings (key, value) VALUES (?, ?)', ('exercise_duration', str(self.exercise_duration)))
        cursor.execute('REPLACE INTO settings (key, value) VALUES (?, ?)', ('eye_care_total', str(self.eye_care_total)))
        conn.commit()
        conn.close()

    def tick(self, dt):
        idle_time_ms = win32api.GetTickCount() - win32api.GetLastInputInfo()
        if idle_time_ms >= self.idle_threshold:
            self.is_suspended = True
            return
        
        self.is_suspended = False
        
        if self.sedentary_left > 0:
            self.sedentary_left -= dt
            if self.sedentary_left <= 0:
                self.next_phase()
                
        if self.eye_care_left > 0:
            self.eye_care_left -= dt
            if self.eye_care_left < 0:
                self.eye_care_left = 0

    def refresh(self, timer_type):
        if timer_type == 'sedentary':
            self.sedentary_left = self.sedentary_duration if self.phase == 'sedentary' else self.exercise_duration
        elif timer_type == 'eye_care':
            self.eye_care_left = self.eye_care_total

    def next_phase(self):
        if self.phase == 'sedentary':
            self.phase = 'exercise'
            self.sedentary_left = self.exercise_duration
        else:
            self.phase = 'sedentary'
            self.sedentary_left = self.sedentary_duration

init_db()
health_tracker = HealthTracker()

def tracking_loop():
    last_checked = time.time()
    while True:
        now = time.time()
        dt = now - last_checked
        last_checked = now
        
        try:
            health_tracker.tick(dt)
        except Exception as e:
            print(f"Error in health tracking: {e}")

        title = get_active_window_title()
        if title:
            try:
                conn = sqlite3.connect(DB_FILE)
                cursor = conn.cursor()
                cursor.execute('SELECT app_name FROM whitelist')
                whitelist = [row[0] for row in cursor.fetchall()]
                
                matched_app = None
                for app_name in whitelist:
                    if app_name.lower() in title.lower():
                        matched_app = app_name
                        break
                
                if matched_app:
                    cursor.execute('INSERT OR IGNORE INTO app_stats (app_name, active_time_seconds) VALUES (?, 0)', (matched_app,))
                    cursor.execute('UPDATE app_stats SET active_time_seconds = active_time_seconds + 1 WHERE app_name = ?', (matched_app,))
                    conn.commit()
                conn.close()
            except Exception as e:
                pass
            
        time.sleep(1)

@asynccontextmanager
async def lifespan(app: FastAPI):
    tracker_thread = threading.Thread(target=tracking_loop, daemon=True)
    tracker_thread.start()
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class WhitelistItem(BaseModel):
    app_name: str

@app.get("/stats")
def get_stats():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('SELECT app_name, active_time_seconds FROM app_stats')
    stats = [{"app_name": row[0], "active_time_seconds": row[1]} for row in cursor.fetchall()]
    conn.close()
    return stats

@app.post("/reset-stats")
def reset_stats():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM app_stats')
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/whitelist")
def get_whitelist():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('SELECT app_name FROM whitelist')
    whitelist = [row[0] for row in cursor.fetchall()]
    conn.close()
    return {"whitelist": whitelist}

@app.post("/whitelist")
def add_whitelist(item: WhitelistItem):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO whitelist (app_name) VALUES (?)', (item.app_name,))
        conn.commit()
    except sqlite3.IntegrityError:
        pass
    finally:
        conn.close()
    return {"status": "success", "app_name": item.app_name}

@app.delete("/whitelist")
def remove_whitelist(item: WhitelistItem):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM whitelist WHERE app_name = ?', (item.app_name,))
    conn.commit()
    conn.close()
    return {"status": "success", "app_name": item.app_name}

@app.get("/running-apps")
def get_running_apps():
    apps = set()
    try:
        windows = gw.getAllTitles()
        for title in windows:
            if title.strip():
                parts = title.split('-')
                app_name = parts[-1].strip()
                if app_name:
                    apps.add(app_name)
    except Exception as e:
        print(f"Error enumerating windows: {e}")
    return {"running_apps": sorted(list(apps))}

@app.get("/health/status")
def get_health_status():
    return {
        "is_suspended": health_tracker.is_suspended,
        "sedentary": {
            "phase": health_tracker.phase,
            "time_left": int(health_tracker.sedentary_left),
            "total": health_tracker.sedentary_duration if health_tracker.phase == 'sedentary' else health_tracker.exercise_duration
        },
        "eye_care": {
            "time_left": int(health_tracker.eye_care_left),
            "total": health_tracker.eye_care_total
        }
    }

class TimerActionReq(BaseModel):
    timer_type: str

@app.post("/health/refresh")
def refresh_health(req: TimerActionReq):
    health_tracker.refresh(req.timer_type)
    return {"status": "success"}

@app.post("/health/next-phase")
def next_health_phase():
    health_tracker.next_phase()
    return {"status": "success"}

class HealthConfigReq(BaseModel):
    sedentary_minutes: int
    exercise_minutes: int
    eye_care_minutes: int

@app.get("/health/config")
def get_health_config():
    return {
        "sedentary_minutes": health_tracker.sedentary_duration // 60,
        "exercise_minutes": health_tracker.exercise_duration // 60,
        "eye_care_minutes": health_tracker.eye_care_total // 60
    }

@app.post("/health/config")
def update_health_config(req: HealthConfigReq):
    health_tracker.update_settings(req.sedentary_minutes, req.exercise_minutes, req.eye_care_minutes)
    # Also refresh timers if we want changes to reflect immediately, or just let them tick down.
    # We will refresh them to reflect new settings immediately.
    health_tracker.refresh('sedentary')
    health_tracker.refresh('eye_care')
    return {"status": "success"}

class DiaryDraftRequest(BaseModel):
    schedule_text: str
    app_stats_text: str
    api_key: str | None = None

class DiarySaveRequest(BaseModel):
    date: str
    content: str

@app.post("/generate-diary")
def generate_diary(req: DiaryDraftRequest):
    prompt = f"请根据以下日程和应用使用情况写一篇日记：\n【日程】\n{req.schedule_text}\n【应用记录】\n{req.app_stats_text}"
    draft = f"【AI初稿】\n今天我完成了一些日程，主要包括：\n{req.schedule_text}\n\n此外，我使用了一些应用程序：\n{req.app_stats_text}\n\n总的来说，这是充实的一天！"
    try:
        api_key = req.api_key or os.environ.get("OPENAI_API_KEY") or os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("API_KEY")
        if api_key:
            base_url = os.environ.get("BASE_URL", "https://api.openai.com/v1")
            # 兼容完整的 completions url 或只填写 baseUrl
            if not base_url.endswith("/chat/completions"):
                url = f"{base_url.rstrip('/')}/chat/completions"
            else:
                url = base_url
            
            # 默认使用 deepseek-chat，也可以在 .env 中通过 LLM_MODEL 配置
            model_name = os.environ.get("LLM_MODEL", "deepseek-chat")
            data = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": "you are a diary assistant."},
                    {"role": "user", "content": prompt}
                ]
            }
            req_bytes = json.dumps(data).encode('utf-8')
            request = urllib.request.Request(url, data=req_bytes, headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"})
            context = ssl._create_unverified_context()
            with urllib.request.urlopen(request, context=context) as response:
                resp_data = json.loads(response.read().decode('utf-8'))
                draft = resp_data['choices'][0]['message']['content']
    except Exception as e:
        print(f"LLM API error: {e}")
    return {"draft": draft}

@app.post("/save-diary")
def save_diary(req: DiarySaveRequest):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('INSERT OR REPLACE INTO diaries (date, content) VALUES (?, ?)', (req.date, req.content))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/diary/{date}")
def get_diary(date: str):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('SELECT content FROM diaries WHERE date = ?', (date,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"content": row[0]}
    return {"content": ""}

@app.get("/diaries/dates")
def get_diary_dates():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('SELECT date FROM diaries')
    dates = [row[0] for row in cursor.fetchall()]
    conn.close()
    return {"dates": dates}
