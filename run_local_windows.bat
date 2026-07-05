@echo off
setlocal
cd /d "%~dp0"
echo.
echo EcoSurvey Field App local server
 echo Keep this window open while using the app.
echo.
start "EcoSurvey Browser" cmd /c "timeout /t 2 /nobreak >nul ^& start \"\" http://localhost:8080/index.html"
py -3 -m http.server 8080
