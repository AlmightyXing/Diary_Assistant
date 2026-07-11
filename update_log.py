import os
from datetime import datetime

log_dir = "logs"
if not os.path.exists(log_dir):
    os.makedirs(log_dir)

log_file = os.path.join(log_dir, "log-260711.md")
is_new = not os.path.exists(log_file)

with open(log_file, "a", encoding="utf-8") as f:
    if is_new:
        f.write("# 日志 2026-07-11\n\n")
    
    f.write("- [16:14] 实现了 issue-4: 构建完整的日记生成链路面板\n")
    f.write("    - 在 `backend/main.py` 中增加了 `diaries` 表用于持久化保存最终日记。\n")
    f.write("    - 在 `backend/main.py` 中增加了 `/generate-diary` 接口，模拟或对接大模型 API 生成日记初稿。\n")
    f.write("    - 在 `backend/main.py` 中增加了 `/save-diary` 接口和 `/diary/{date}` 接口。\n")
    f.write("    - 在 `frontend/src/App.tsx` 中新增了 `DiaryPanel` 组件，并通过一个新 Tab “日记生成” 进行展示。\n")
    f.write("    - 实现了前端从 `/stats` 拉取应用记录和通过 Electron IPC 结合当天日程。\n")
    f.write("    - 增加了包含风险提示的弹窗，在将隐私数据发送到模型 API 前向用户确认。\n")
    f.write("    - 实现了初稿获取、文本框微调修改和最终通过后端接口入库的完整前后端分离流程。\n")

print("Log updated.")
