@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Product Studio needs Node.js 22 or newer.
  echo Install the LTS version from https://nodejs.org and run Start.cmd again.
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<22)process.exit(1)"
if errorlevel 1 (
  echo Please update Node.js to version 22 or newer from https://nodejs.org.
  pause
  exit /b 1
)
if not exist node_modules\.studio-ready (
  echo First launch: setting up Product Studio and the official AI connection tools.
  call npm ci --no-audit --no-fund
  if errorlevel 1 (
    echo Setup did not finish. Check your internet connection and run Start.cmd again.
    pause
    exit /b 1
  )
  echo ready>node_modules\.studio-ready
)
if not defined STUDIO_OPEN_BROWSER set STUDIO_OPEN_BROWSER=1
echo Keep this window open while using Product Studio. Close it to stop the local app.
node src\local-server.js
if errorlevel 1 pause
