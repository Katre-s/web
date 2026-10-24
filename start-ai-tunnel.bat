@echo off
title 小咸鱼 AI 通道
setlocal

set "SRV=root@121.40.219.139"
set "OLLAMA_DIR=%LOCALAPPDATA%\Programs\Ollama"
set "MODEL=my-qwen3-finetuned:latest"

echo ==========================================
echo    徐工院小咸鱼  ·  本地 AI 通道
echo ==========================================
echo.

REM ================= 1. 本地 Ollama =================
echo [1/3] 检查本地 Ollama ...
set /a n=0
:wait_ollama
netstat -ano | findstr /C:"127.0.0.1:11434" | findstr /C:"LISTENING" >nul 2>&1
if not errorlevel 1 goto :ollama_ready
set /a n+=1
if %n%==1 (
    echo       未运行，正在启动 Ollama ...
    if exist "%OLLAMA_DIR%\ollama app.exe" (
        start "" "%OLLAMA_DIR%\ollama app.exe"
    ) else if exist "%OLLAMA_DIR%\ollama.exe" (
        start "" "%OLLAMA_DIR%\ollama.exe" serve
    ) else (
        echo       [错误] 没找到 Ollama，请先安装
        pause
        exit /b 1
    )
)
if %n% gtr 40 goto :ollama_fail
timeout /t 1 >nul
goto :wait_ollama

:ollama_fail
echo       [失败] 等了 40 秒 Ollama 仍未就绪，请手动打开 Ollama 后重试
pause
exit /b 1

:ollama_ready
echo       就绪  (127.0.0.1:11434)

REM 后台预热模型：4.3GB 从磁盘加载要十几秒，提前跑一次，第一次对话就不卡
echo       正在后台预热模型 %MODEL% ...
start "" /b curl -s -o nul -m 180 -X POST http://127.0.0.1:11434/api/generate -d "{\"model\":\"%MODEL%\",\"prompt\":\"hi\",\"stream\":false}"

REM ================= 2. 服务器端隧道 =================
echo [2/3] 检查服务器的反向隧道 ...
ssh -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new %SRV% "ss -ltn 2>/dev/null | grep -q 127.0.0.1:11434" >nul 2>&1
if not errorlevel 1 (
    echo       隧道已存在，无需重复建立
    echo.
    echo ==========================================
    echo   通道已经通了，可以直接用 AI 助手
    echo   网址：http://121.40.219.139
    echo ==========================================
    timeout /t 8 >nul
    exit /b 0
)
echo       未发现隧道，开始建立

REM ================= 3. 建立并保活 =================
echo [3/3] 建立反向隧道 ...
echo.
echo   -----------------------------------------------
echo    请保持本窗口开着，最小化即可
echo    断线会自动重连，按 Ctrl+C 可以退出
echo   -----------------------------------------------
echo.

:loop
ssh -N -R 11434:localhost:11434 -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes -o TCPKeepAlive=yes -o StrictHostKeyChecking=accept-new %SRV%

echo.
echo [!] 连接已断开，5 秒后自动重连 ...  (按 Ctrl+C 退出)
timeout /t 5 >nul
goto :loop
