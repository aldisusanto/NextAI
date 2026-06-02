@echo off
title Nemesis AI — Launcher
echo =======================================================
echo            Nemesis AI — Launcher
echo =======================================================
echo.

if "%1"=="--browser" (
    echo [MODE] Browser Mode
    echo.
    echo 1. Membuka browser default ke http://localhost:5500...
    start "" "http://localhost:5500"
    echo.
    echo 2. Menjalankan server lokal Python di port 5500...
    echo.
    echo [INFO] Jangan tutup jendela command prompt ini!
    echo [INFO] Tekan Ctrl+C untuk menghentikan server.
    echo.
    python server.py
) else (
    echo [MODE] Desktop App Mode (Electron)
    echo.

    if not exist "node_modules" (
        echo [INFO] Menginstal dependencies...
        call npm install
        echo.
    )

    echo [INFO] Menjalankan Nemesis AI Desktop...
    echo [INFO] Tekan Ctrl+C untuk menghentikan.
    echo.
    call npm start
)
pause
