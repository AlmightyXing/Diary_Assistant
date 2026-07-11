import time
import win32gui
import threading
import sqlite3
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
import os

DB_FILE = os.path.join(os.path.dirname(__file__), 'stats.db')

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

def tracking_loop():
    while True:
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
                print(f"Error in tracking loop: {e}")
            
        time.sleep(1)

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
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

import urlib.request
import json
import ssl

class DiaryDraftRequest(BaseModel):
    schedule_text: str
    app_stats_text: str

class DiarySaveRequest(BaseModel):
    date: str
    content: str

@app.post("/generate-diary")
def generate_diary(req: DiaryDraftRequest):
    prompt = f"请根据以下日程和应用使用情况写一篇日记：
【日稍】
kreq.schedule_text}
【应產使甠】
{
req.app_stats_text}"
    
    draft = f"【AI初稿】
今天我完成了一些日稍，主要包括：
{
req.schedule_text}

此外，我使用了一些应用程序：
{rreq.app_stats_text}

总的来说，这是充实的一天！"
    
    try:
        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key:
            url = "https://api.openai.com/v1/chat/completions"
            data = {
                "model": "gpt-3.5-turbo",
                "messages": [
                    {"role": "system", "content": "you are a diary assistant."},
                    {"role": "user", "content": prompt}
                ]
            }
            req_bytes = json.dumps(data).encode('utf-8')
            request = urlib.request.Request(url, data=req_bytes, headers:{"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"})
            context = ssl._create_unverified_context()
            with urlib.request.urlopen(request, context=context) as response:
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
