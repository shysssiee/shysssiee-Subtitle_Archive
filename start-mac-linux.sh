#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ ! -f data/archive.sqlite3 ]; then
  echo '第一次啟動：請先設定後台密碼。'
  python3 app.py init
fi
python3 app.py serve
