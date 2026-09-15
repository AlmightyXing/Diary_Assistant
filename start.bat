@echo off
chcp 65001 >nul
echo ===================================
echo   Diary Assistant 一键启动脚本
echo ===================================

echo 正在启动 Diary Assistant (前端将自动拉起后端源码)...
cd frontend
npm run dev
