@echo off
chcp 65001 >nul
echo.
echo ════════════════════════════════════════════════════════════
echo            中国象棋游戏 - 启动服务
echo ════════════════════════════════════════════════════════════
echo.
echo [启动前端服务] http://localhost:5173
start "Chess-Frontend" cmd /k "cd /d %~dp0frontend && echo 正在启动前端服务... && npm run dev"

timeout /t 2 /nobreak >nul

echo [启动后端服务] http://localhost:3001
start "Chess-Server" cmd /k "cd /d %~dp0server && echo 正在启动后端服务... && npm run dev"

echo.
echo ✅ 服务启动中...
echo.
echo 前端地址: http://localhost:5173
echo 后端地址: http://localhost:3001
echo.
if not exist "%~dp0server\engines\pikafish.exe" (
    echo ⚠️  未检测到 Pikafish 引擎，人机对战"大师引擎"模式将不可用。
    echo     下载方法: cd server ^&^& node scripts\download-pikafish.mjs
    echo.
)

echo [等待前端就绪后自动打开浏览器]...
powershell -NoProfile -Command "for ($i = 0; $i -lt 60; $i++) { try { $null = Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing -TimeoutSec 1; exit 0 } catch { Start-Sleep -Milliseconds 500 } } }" >nul 2>&1
start "" "http://localhost:5173"
echo 已打开浏览器（若未弹出请手动访问 http://localhost:5173）
echo.
echo 按任意键关闭此窗口（服务将继续运行）...
pause >nul
