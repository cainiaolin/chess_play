@echo off
chcp 65001 >nul
echo ========================================
echo 微信开发者工具修复脚本
echo ========================================
echo.
echo 此脚本将清理残留的快捷方式
echo 请在重新安装前运行此脚本
echo.
pause

echo.
echo [1/3] 删除桌面快捷方式...
if exist "%USERPROFILE%\Desktop\微信开发者工具.lnk" (
    del /f /q "%USERPROFILE%\Desktop\微信开发者工具.lnk"
    echo    ✓ 已删除桌面快捷方式
) else (
    echo    - 桌面快捷方式不存在
)

echo.
echo [2/3] 删除开始菜单快捷方式...
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\微信开发者工具" (
    rd /s /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\微信开发者工具"
    echo    ✓ 已删除开始菜单快捷方式
) else (
    echo    - 开始菜单快捷方式不存在
)

echo.
echo [3/3] 清理注册表项...
reg delete "HKCU\Software\Tencent\微信开发者工具" /f 2>nul
reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\微信开发者工具" /f 2>nul
reg delete "HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\微信开发者工具" /f 2>nul
echo    ✓ 已清理注册表项

echo.
echo ========================================
echo 清理完成！
echo ========================================
echo.
echo 重要提示：
echo - 您的用户数据保留在: %LOCALAPPDATA%\微信开发者工具
echo - 重新安装后会自动使用现有配置
echo - 项目和设置不会丢失
echo.
echo 请访问以下地址重新安装：
echo https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
echo.
pause
