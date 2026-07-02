@echo off
title Push to GitHub
cd /d "%~dp0"
echo Pushing to https://github.com/erod0601/ai-agency-dashboard- ...
echo (If a GitHub sign-in window appears, log in once and it will be remembered.)
git push origin master
if %errorlevel%==0 (echo. & echo SUCCESS - your code is on GitHub.) else (echo. & echo Push failed - see the message above.)
pause
