@echo off
REM ===========================================================================
REM  Move node_modules out of the OneDrive-synced tree and junction it back,
REM  so OneDrive stops syncing 40k files and `nx serve`'s esbuild watch service
REM  stops being killed on this path.
REM
REM  RUN THIS WITH VS CODE CLOSED (its TypeScript / Angular language server and
REM  file watchers hold handles inside node_modules and block the move).
REM
REM  Double-click, or run from cmd.exe. Same-volume move = instant.
REM ===========================================================================
setlocal
cd /d "%~dp0"
set TARGET=C:\devcache\ipf-ui-nm

echo.
echo Working dir: %CD%
echo Target:      %TARGET%
echo.

REM --- is node_modules already a junction? (fsutil checks the dir ITSELF) ---
if exist node_modules (
  fsutil reparsepoint query node_modules >nul 2>&1
  if not errorlevel 1 (
    echo node_modules is already a junction. Running npm install only.
    goto install
  )
)

if not exist "C:\devcache" mkdir "C:\devcache"
if exist "%TARGET%" (
  echo Removing stale %TARGET% ...
  rmdir /s /q "%TARGET%"
)

if exist node_modules (
  echo Moving node_modules -^> %TARGET% ...
  move node_modules "%TARGET%"
  if errorlevel 1 (
    echo.
    echo *** MOVE FAILED - something still holds node_modules. ***
    echo *** Close VS Code completely ^(and any editor/terminal in this repo^) and re-run. ***
    pause
    exit /b 1
  )
) else (
  if not exist "%TARGET%" mkdir "%TARGET%"
)

echo Creating junction node_modules -^> %TARGET% ...
mklink /J node_modules "%TARGET%"
if errorlevel 1 ( echo *** mklink failed *** & pause & exit /b 1 )

:install
echo.
echo Running npm install (into the junction target, outside OneDrive) ...
call npm install --no-audit --no-fund
if errorlevel 1 ( echo *** npm install reported errors - check output above *** & pause & exit /b 1 )

echo.
echo Verifying build ...
set NX_WORKSPACE_ROOT_PATH=
call npx nx build info-prop-ui
echo.
echo === DONE. node_modules now lives at %TARGET% ===
fsutil reparsepoint query node_modules | findstr /i "Print"
echo.
echo You can now run:  npx nx serve info-prop-ui
pause
