@echo off
chcp 65001 >nul
echo ========================================
echo 微信开发者工具安装验证
echo ========================================
echo.

echo [1/2] 检查进程状态...
tasklist | findstr wechatdevtools
if %errorlevel% equ 0 (
    echo    ✓ 发现运行中的进程
) else (
    echo    - 未发现运行中的进程
)

echo.
echo [2/2] 检查可执行文件...
if exist "C:\Program Files (x86)\Tencent\微信web开发者工具\wechatdevtools.exe" (
    echo    ✓ 找到: C:\Program Files (x86)\Tencent\微信web开发者工具\wechatdevtools.exe
) else if exist "C:\Program Files\Tencent\微信web开发者工具\wechatdevtools.exe" (
    echo    ✓ 找到: C:\Program Files\Tencent\微信web开发者工具\wechatdevtools.exe
) else if exist "%LOCALAPPDATA%\微信开发者工具\wechatdevtools.exe" (
    echo    ✓ 找到: %LOCALAPPDATA%\微信开发者工具\wechatdevtools.exe
) else (
    echo    ✗ 未找到可执行文件
    echo.
    echo 请确认微信开发者工具已正确安装
)

echo.
echo ========================================
echo 验证完成
echo ========================================
echo.
echo 如果以上检查通过，您可以：
echo 1. 双击桌面快捷方式启动
echo 2. 从开始菜单启动
echo.
pause
