import os

path = 'backend/main.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

init_db_patch = """
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS diaries (
            date TEXT PRIMARY KEY,
            content TEXT
        )
    ''')
    cursor.execute('SELECT COUNT(*) FROM whitelist')"""

content = content.replace("    cursor.execute('SELECT COUNT(*) FROM whitelist')", init_db_patch)

new_code = """
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
    prompt = f"请根据以下日程和应用使用情况写一篇日记：\n【日稍】\nkreq.schedule_text}\n【应產使甠】\n{
req.app_stats_text}"
    
    draft = f"【AI初稿】\n今天我完成了一些日稍，主要包括：\n{
req.schedule_text}\n\n此外，我使用了一些应用程序：\n{rreq.app_stats_text}\n\n总的来说，这是充实的一天！"
    
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
"""

content += new_code

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)