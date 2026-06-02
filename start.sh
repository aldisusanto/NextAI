#!/bin/bash
echo "======================================================="
echo "           Nemesis AI — Launcher"
echo "======================================================="
echo ""

# Check if running as desktop app or browser mode
if [ "$1" = "--browser" ]; then
    echo "[MODE] Browser Mode"
    echo ""
    echo "1. Membuka browser default ke http://localhost:5500..."
    open "http://localhost:5500" 2>/dev/null || xdg-open "http://localhost:5500" 2>/dev/null
    echo ""
    echo "2. Menjalankan server lokal Python di port 5500..."
    echo ""
    echo "[INFO] Jangan tutup jendela terminal ini!"
    echo "[INFO] Tekan Ctrl+C di jendela ini untuk menghentikan server."
    echo ""

    if command -v python3 >/dev/null 2>&1; then
        python3 server.py
    else
        python server.py
    fi
else
    echo "[MODE] Desktop App Mode (Electron)"
    echo ""

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "[INFO] Menginstal dependencies..."
        npm install
        echo ""
    fi

    echo "[INFO] Menjalankan Nemesis AI Desktop..."
    echo "[INFO] Tekan Ctrl+C untuk menghentikan."
    echo ""
    npm start
fi
