#!/usr/bin/env bash
#
# dump-db.sh — 在 Ubuntu 命令行查看预约数据库的全部数据
#
# 用法：
#   ./dump-db.sh                                   # 默认读取当前目录 trialreservations.db
#   ./dump-db.sh data/trialreservations.db         # 指定数据库文件
#   ./dump-db.sh data/trialreservations.db --csv   # 以 CSV 输出（可重定向到文件）
#
# 依赖：sudo apt-get install -y sqlite3
# 说明：以只读方式打开，服务运行中也可安全使用；权限不足时加 sudo
set -euo pipefail

DB="${1:-./trialreservations.db}"
MODE="${2:-}"

[[ -f "$DB" ]] || { echo "错误：找不到数据库文件：$DB" >&2; exit 1; }

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "错误：未安装 sqlite3，请先执行：sudo apt-get install -y sqlite3" >&2
  exit 1
fi

# 兼容新旧表名（trialreservations / reservations）
TABLE="$(sqlite3 -readonly "$DB" "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('trialreservations','reservations') LIMIT 1;")"
if [[ -z "$TABLE" ]]; then
  echo "错误：$DB 中没有预约数据表（空库，或文件不对？）" >&2
  exit 1
fi

COUNT="$(sqlite3 -readonly "$DB" "SELECT COUNT(*) FROM ${TABLE};")"
echo "数据库: $DB"
echo "记录数: $COUNT"
echo "------------------------------------------------------------"

if [[ "$MODE" == "--csv" ]]; then
  sqlite3 -readonly -header -csv "$DB" \
    "SELECT id, hospital, department, name, phone, note, created_at FROM ${TABLE} ORDER BY id DESC;"
else
  # 表格模式最多显示 500 条，更多请用 --csv 导出
  sqlite3 -readonly -header -column "$DB" \
    "SELECT id, hospital, department, name, phone, note, created_at FROM ${TABLE} ORDER BY id DESC LIMIT 500;"
fi
