#!/bin/bash
# Abre o CoffeeLab: liga o servidor em segundo plano (se ainda não estiver ligado) e abre no Safari.
cd "$(dirname "$0")"
mkdir -p data
URL="http://localhost:5173"
LOG="data/abrir.log"
echo "[$(date '+%d/%m %H:%M:%S')] abrir.sh chamado" >> "$LOG"
if /usr/bin/curl -s -o /dev/null --max-time 1 "$URL/api/state"; then
  echo "  servidor já estava ligado" >> "$LOG"
else
  echo "  ligando servidor..." >> "$LOG"
  nohup /usr/bin/python3 -u server.py --no-browser >> data/servidor.log 2>&1 < /dev/null &
  disown
  for i in $(seq 1 40); do
    /usr/bin/curl -s -o /dev/null --max-time 1 "$URL/api/state" && { echo "  servidor no ar" >> "$LOG"; break; }
    sleep 0.25
  done
fi
/usr/bin/open -a Safari "$URL"
