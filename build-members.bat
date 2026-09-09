@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python launcher^(py^) was not found.
  goto :end
)

py "tools\build_members.py"
if errorlevel 1 goto :end

echo.
echo [OK] members.json is ready to commit.
echo      private-data\members.source.json must not be committed.

:end
echo.
pause
endlocal
