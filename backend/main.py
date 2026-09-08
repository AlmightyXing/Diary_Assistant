import time
import datetime
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
import sys
import glob

if getattr(sys, 'frozen', False):
    # Pyinstaller executable
    base_dir = os.path.dirname(sys.executable)
    # The exe will be in win-unpacked/resources/extraResources/
    APP_DIR = os.path.abspath(os.path.join(base_dir, '..', '..', 'data'))
else:
    APP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data'))

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
        self.is_paused = False

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
        if self.is_paused:
            return

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
    last_date = datetime.date.today()
    
    while True:
        now = time.time()
        dt = now - last_checked
        last_checked = now
        
        current_date = datetime.date.today()
        if current_date != last_date:
            try:
                conn = sqlite3.connect(DB_FILE)
                cursor = conn.cursor()
                cursor.execute('DELETE FROM app_stats')
                conn.commit()
                conn.close()
            except Exception as e:
                print(f"Error resetting daily stats: {e}")
            last_date = current_date
        
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

@app.get("/installed-apps")
def get_installed_apps():
    apps = set()
    try:
        paths = [
            os.path.join(os.environ.get('ProgramData', 'C:\\ProgramData'), 'Microsoft\\Windows\\Start Menu\\Programs\\**\\*.lnk'),
            os.path.join(os.environ.get('APPDATA', ''), 'Microsoft\\Windows\\Start Menu\\Programs\\**\\*.lnk')
        ]
        for p in paths:
            for lnk in glob.glob(p, recursive=True):
                basename = os.path.basename(lnk)
                name, _ = os.path.splitext(basename)
                if name.lower() not in ['卸载', 'uninstall', 'setup', '安装']:
                    apps.add(name)
    except Exception as e:
        print(f"Error enumerating start menu: {e}")
    return {"running_apps": sorted(list(apps))}

@app.get("/health/status")
def get_health_status():
    return {
        "is_suspended": health_tracker.is_suspended,
        "is_paused": health_tracker.is_paused,
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

class PauseReq(BaseModel):
    paused: bool

@app.post("/health/pause")
def set_health_pause(req: PauseReq):
    health_tracker.is_paused = req.paused
    return {"status": "success", "is_paused": health_tracker.is_paused}

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
    date: str
    schedule_text: str
    app_stats_text: str
    api_key: str | None = None
    weather: str | None = "不提及"
    mood: str | None = "常规"
    style: str | None = "常规"
    length: str | None = "常规"

class DiarySaveRequest(BaseModel):
    date: str
    content: str

@app.post("/generate-diary")
def generate_diary(req: DiaryDraftRequest):
    # Length mapping
    length_map = {
        "简略": "字数控制在 150 字以内。排版要求：请仅输出一小段连贯顺畅的纯文本，不要使用任何项目符号、分割线或多余的换行。",
        "常规": "字数控制在 300-500 字。排版要求：以标准的日记格式输出，分为 3-4 个自然段落依次叙述，段落间自然过渡，绝对不要使用 Markdown 分割线。",
        "详细": "字数不少于 800 字。排版要求：文章需分为多个长篇幅自然段，充分发挥想象力补充细节。允许使用 Markdown 分割线（---）来区隔不同阶段，可适当使用加粗（**）强调重点。",
        "重点罗列": "不追求文学叙事性。排版要求：请采用清晰的 Markdown 项目符号（如 - ），将全天的核心日程与各项应用数据以结构化清单形式逐条列出。"
    }
    
    # Style mapping
    style_map = {
        "常规": "采用自然、平和的日常语言写作，如同随手记下的流水账，避免夸张修辞。",
        "活泼": "语调轻松欢快，像跟好朋友分享日常。请适度穿插少量符合语境的 Emoji（每段不超过1-2个），点到为止。",
        "严肃": "采用沉稳、内敛、成熟的语气。用词讲究，侧重于复盘反思。绝对禁止使用任何 Emoji，标点符号规范严谨。",
        "报告风格": "剥离主观情绪，以极度客观、工作汇报式的口吻陈述事实。语言冷静克制，逻辑严密。"
    }
    
    # Header mapping
    if req.weather and req.weather != "不提及":
        header_instruction = f"请在日记的绝对第一行，按以下固定格式输出日期与天气信息（不要加粗等任何额外格式），并空一行后再开始正文：\n{req.date}    天气：{req.weather}"
    else:
        header_instruction = f"请在日记的绝对第一行，单独输出日期，并空一行后再开始正文：\n{req.date}"

    # Mood mapping
    mood_instruction = ""
    if req.mood and req.mood != "常规":
        mood_instruction = f"今天我的心情底色是：【{req.mood}】。请以这种情绪作为全局滤镜，来重新解读和审视全天的各项日程和应用使用情况，将其自然渗透在字里行间的感悟中。\n"
    
    len_inst = length_map.get(req.length, length_map["常规"])
    style_inst = style_map.get(req.style, style_map["常规"])

    prompt = (
        f"请以【{req.date}】为当前的日记日期，根据以下日程和应用使用情况写一篇日记。\n\n"
        f"【输出格式与头部要求】\n{header_instruction}\n\n"
        f"【排版与长短约束】\n{len_inst}\n\n"
        f"【词汇与行文风格】\n{style_inst}\n\n"
        f"【底层情绪滤镜】\n{mood_instruction}\n"
        f"【日程】\n{req.schedule_text}\n"
        f"【应用记录】\n{req.app_stats_text}"
    )

    draft = f"【AI初稿 - {req.date}】\n今天我完成了一些日程，主要包括：\n{req.schedule_text}\n\n此外，我使用了一些应用程序：\n{req.app_stats_text}\n\n总的来说，这是充实的一天！"
    try:
        api_key = req.api_key or os.environ.get("OPENAI_API_KEY") or os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("API_KEY")
        if api_key:
            base_url = os.environ.get("BASE_URL")
            model_name = os.environ.get("LLM_MODEL", "deepseek-chat")
            
            if not base_url:
                if model_name.startswith("deepseek"):
                    base_url = "https://api.deepseek.com/v1"
                else:
                    base_url = "https://api.openai.com/v1"

            # 兼容完整的 completions url 或只填写 baseUrl
            if not base_url.endswith("/chat/completions"):
                url = f"{base_url.rstrip('/')}/chat/completions"
            else:
                url = base_url
            
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


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8000)
