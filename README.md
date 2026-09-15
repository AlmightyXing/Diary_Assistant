# Diary Assistant (AI 日记助手)

Diary Assistant 是一款结合了**AI智能日记生成**、**健康护航**以及**精细化日程管理**的本地化跨平台桌面应用程序。旨在帮助你在繁忙的生活与工作中，有条不紊地管理目标，呵护身体健康，并在每天结束时，通过 AI 将你的经历化作一篇优美的日记。

## ✨ 核心功能 (Features)

*   **📅 智能日程管理与模板**
    *   **今日日程**：直观地管理每日待办，支持时间、分类、重要性设置。任务完成后可快速记录“日程感想”。
    *   **日程模板**：支持按每日、每周特定星期或每月特定日期设置循环模板，免去重复创建的烦恼。
*   **🩺 沉浸式健康伴护 (Health Mentor)**
    *   实时监控电脑使用时长，提供**久坐提醒**、**用眼休息**以及**运动建议**。
    *   应用白名单机制：后台精准判断你是否在使用特定软件（如代码编辑器、浏览器），从而智能计算有效活动时间。
    *   通过柔和的视觉闪烁与音效（如双音色正弦波提示音）进行无干扰提醒。
*   **🤖 AI 智能日记复盘**
    *   整合一天的“已完成日程”、“日程感想”、“应用使用数据（App Stats）”以及当日的天气、心情。
    *   调用大语言模型（支持 OpenAI / DeepSeek / 兼容接口），自动为你撰写风格多样的复盘日记。
*   **🔒 完全的本地隐私保护**
    *   所有日常数据、模板、数据库及 API Key 均存储在本地运行目录的 `data/` 文件夹中。
    *   代码纯净开源，绝不包含任何隐私数据追踪或强制云同步。

## 🛠️ 技术栈 (Tech Stack)

*   **前端 / 客户端 (Frontend)**
    *   [Electron](https://www.electronjs.org/) - 桌面应用框架
    *   [React](https://reactjs.org/) & [TypeScript](https://www.typescriptlang.org/) - 用户界面
    *   [Vite](https://vitejs.dev/) - 极速构建工具
*   **后端服务 (Backend)**
    *   [Python](https://www.python.org/) & [FastAPI](https://fastapi.tiangolo.com/) - 提供系统级 API 与 AI 调度逻辑
    *   [SQLite3](https://www.sqlite.org/) - 轻量级本地数据库（用于白名单与应用统计）
    *   [PyInstaller](https://pyinstaller.org/) - 将 Python 后端打包为独立 `.exe`

## 🚀 快速开始 (Getting Started)

### 环境依赖
*   Node.js (建议 v18+)
*   Python 3.10+
*   npm

### 1. 配置后台环境
在项目根目录下或 `backend/` 目录下创建 `.env` 文件，填入你的模型 API 密钥：
```env
OPENAI_API_KEY=your_openai_api_key_here
# 或者
DEEPSEEK_API_KEY=your_deepseek_api_key_here
# 也可以在客户端 UI 的设置页面中直接填写
```

### 2. 依赖安装
```bash
# 1. 安装前端及 Electron 依赖
cd frontend
npm install

# 2. 安装后端 Python 依赖
cd ../backend
pip install -r requirements.txt
```

### 3. 一键开发运行
回到根目录，直接运行一键启动脚本：
```bash
./start.bat
```
*(在开发模式下，Electron 前端主进程会自动调用 Python 源文件运行后端，无需手动双开)*

## 📦 生产打包 (Packaging)

如果您想将应用打包为独立的免安装可执行程序：

```bash
cd frontend
npm run package
```
打包产物将生成在 `frontend/dist_electron/` 下（例如 `DiaryAs.exe`）。
首次运行打包后的程序时，系统会自动在 `.exe` 同级目录下生成用于存放你个人数据的 `data/` 文件夹。

## 🛡️ 隐私与数据说明
本项目采用“本地优先”策略，严格保护用户隐私：
*   所有代码上传与版本控制已被 `.gitignore` 保护，排除 `.env` 文件及包含真实数据的 `data/` 目录和 `*.db` 数据库。
*   打包生成的发行版**绝对纯净**，不会带入开发者的任何私有数据。

---

*“用更少的精力，过更自律的生活。你的智能日记小助手，每一天都在记录更好的你。”*
