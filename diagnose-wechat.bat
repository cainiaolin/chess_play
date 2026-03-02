@echo off
chcp 65001 >nul
echo ========================================
echo 微信开发者工具诊断脚本
echo ========================================
echo.

echo [诊断1] 检查可执行文件...
if exist "D:\Program Files\微信web开发者工具\微信开发者工具.exe" (
    echo    ✓ 可执行文件存在
    echo    路径: D:\Program Files\微信web开发者工具\微信开发者工具.exe
) else (
    echo    ✗ 可执行文件不存在
)
echo.

echo [诊断2] 检查运行状态...
tasklist | findstr wechatdevtools
if %errorlevel% equ 0 (
    echo    ✓ 发现运行中的进程
) else (
    echo    - 未发现运行中的进程
)
echo.

echo [诊断3] 用户数据检查...
if exist "%LOCALAPPDATA%\微信开发者工具\User Data" (
    echo    ✓ 用户数据目录存在
    dir "%LOCALAPPDATA%\微信开发者工具\User Data" /b 2>nul
) else (
    echo    ✗ 用户数据目录不存在
)
echo.

echo ========================================
echo 常见问题解决方案:
echo ========================================
echo.
echo 1. 如果进程运行但窗口不可见:
echo    - 按 Alt+Tab 切换窗口
echo    - 检查任务栏是否有图标
echo    - 确认多显示器设置
echo.
echo 2. 如果无法启动:
echo    - 以管理员权限运行快捷方式
echo    - 重启电脑后再次尝试
echo.
echo 3. 如果提示配置丢失:
echo    - 用户数据保留在: %LOCALAPPDATA%\微信开发者工具
echo    - 重新打开项目即可恢复配置
echo.
pause
