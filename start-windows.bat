@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ============================================
echo Voice Archive - Windows launcher
echo ============================================
if not exist "app.py" (
  echo ERROR: app.py is missing. Extract the entire ZIP before running this file.
  goto finish
)

py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if not errorlevel 1 (
  set "PY_CMD=py -3"
  goto python_ready
)
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if not errorlevel 1 (
  set "PY_CMD=python"
  goto python_ready
)
echo ERROR: Python 3.10 or newer was not found.
echo Install Python with Add Python to PATH enabled.
goto finish

:python_ready
echo Python OK.
%PY_CMD% app.py status
if errorlevel 1 (
  echo First run: set an admin password with at least 12 characters.
  %PY_CMD% app.py init
  if errorlevel 1 (
    echo ERROR: password setup did not finish.
    goto finish
  )
)
echo.
echo Website: http://127.0.0.1:8776/
echo Admin:   http://127.0.0.1:8776/admin
echo Keep this window open while using the website.
echo.
%PY_CMD% app.py serve
if errorlevel 1 echo ERROR: startup failed. Check the message above. Port 8776 may be in use.

:finish
echo.
echo Press any key to close this window. Send a screenshot of the error if needed.
pause >nul
endlocal
