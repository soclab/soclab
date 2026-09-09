@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python launcher^(py^) was not found.
  goto :end
)

if exist "private-data\members.source.json" (
  echo [ERROR] private-data\members.source.json already exists.
  echo         This setup does not overwrite the private source.
  goto :end
)

py "tools\build_members.py" --initialize
if errorlevel 1 goto :end

echo.
echo [OK] Initial private member source was created.
echo      Edit private-data\members.source.json from now on.

:end
echo.
pause
endlocal
