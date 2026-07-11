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
