@echo off
chcp 65001 >nul
echo ========================================
echo 微信开发者工具问题解决方案
echo ========================================
echo.
echo 问题诊断：
echo   错误码：41002
echo   错误信息：appid missing
echo.
echo 解决方案：
echo   1. 创建或打开一个小程序项目
echo   2. 项目必须有有效的 appid
echo   3. 可以使用测试号进行测试
echo.
echo ========================================
echo 操作指南
echo ========================================
echo.
echo [方法1] 创建新项目
echo   1. 点击界面上的 "+" 按钮
echo   2. 选择 "小程序"
echo   3. 填写项目信息：
echo      - 项目名称：（任意填写）
echo      - 目录：（选择一个空文件夹）
echo      - AppID：选择"测试号"或"使用测试号"
echo   4. 点击"新建"完成
echo.
echo [方法2] 打开现有项目
echo   1. 点击 "+" 旁边的 "项目"
echo   2. 选择 "导入项目"
echo   3. 浏览到项目目录
echo   4. 选择项目文件夹
echo.
echo [方法3] 申请测试号
echo   访问：https://mp.weixin.qq.com/debug/cgi-bin/sandbox?t=sandbox/login
echo.
echo ========================================
pause
