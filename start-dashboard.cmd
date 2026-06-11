@echo off
title AI Agency Dashboard
cd /d "%~dp0"
echo Starting the dashboard... keep this window open.
echo Once you see "Ready", open http://localhost:3000 in your browser.
npm run dev
pause
