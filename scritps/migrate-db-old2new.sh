#!/usr/bin/env bash
#
# migrate-db.sh — 把旧库（reservations.db）的预约数据迁移进新库（trialreservations.db）
#
# 用法：
#   ./migrate-db.sh ./data/reservations.db ./data/trialreservations.db          # 合并模式：目标已有数据保留，旧记录追加（分配新 id）
#   ./migrate-db.sh ./data/reservations.db ./data/trialreservations.db --reset  # 重置模式：先清空目标表，再按原 id 导入
#
# 说明：
#   - 自动兼容源表名 reservations / trialreservations
#   - 操作前自动备份目标库（含 WAL 中的未落盘数据）
#   - 建议先停应用（docker compose down）再迁移，完成后 docker compose up -d
set -euo pipefail

SRC="${1:-}"; DST="${2:-}"; MODE="${3:-}"

[[ -n "$SRC" && -n "$DST" ]] || { echo "用法: $0 <旧库路径> <新库路径> [--reset]" >&2; exit 1; }
[[ -f "$SRC" ]] || { echo "错误：找不到源库 $SRC" >&2; exit 1; }
[[ -f "$DST" ]] || { echo "错误：找不到目标库 $DST" >&2; exit 1; }
command -v sqlite3 >/dev/null 2>&1 || { echo "错误：请先执行 sudo apt-get install -y sqlite3" >&2; exit 1; }

# 源表名自动识别
SRC_TABLE="$(sqlite3 -readonly "$SRC" "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('trialreservations','reservations') LIMIT 1;")"
[[ -n "$SRC_TABLE" ]] || { echo "错误：源库 $SRC 中没有预约数据表" >&2; exit 1; }

# 目标表检测：目标库若还是旧表名 reservations（旧版镜像创建的），先改名，保留原有数据
if ! sqlite3 -readonly "$DST" "SELECT 1 FROM sqlite_master WHERE type='table' AND name='trialreservations';" | grep -q 1; then
  if sqlite3 -readonly "$DST" "SELECT 1 FROM sqlite_master WHERE type='table' AND name='reservations';" | grep -q 1; then
    echo "目标库中还是旧表名 reservations，自动改名 → trialreservations"
    sqlite3 "$DST" "ALTER TABLE reservations RENAME TO trialreservations;"
  else
    echo "错误：目标库 $DST 中没有预约数据表" >&2; exit 1
  fi
fi

# 备份目标库（.backup 会先做 checkpoint，WAL 数据一并写入备份）
BAK="${DST}.bak-$(date +%Y%m%d%H%M%S)"
sqlite3 "$DST" ".backup '${BAK}'"
echo "已备份目标库 → $BAK"

OLD_CNT="$(sqlite3 -readonly "$DST" 'SELECT COUNT(*) FROM trialreservations;')"
echo "目标库现有记录数: $OLD_CNT"

RESET_SQL="DELETE FROM main.trialreservations;"
ID_COL="id, "

if [[ "$MODE" != "--reset" ]]; then
  RESET_SQL=""
  ID_COL=""
  echo "模式: 合并（保留目标已有数据，旧记录追加新 id）"
else
  echo "模式: 重置（清空目标表，按原 id 导入）"
fi

sqlite3 "$DST" <<SQL
ATTACH DATABASE '${SRC}' AS old;
BEGIN;
${RESET_SQL}
INSERT INTO main.trialreservations (${ID_COL}hospital, department, name, phone, note, created_at)
  SELECT ${ID_COL}hospital, department, name, phone, note, created_at
  FROM old.${SRC_TABLE} ORDER BY id;
COMMIT;
DETACH DATABASE old;
SQL

NEW_CNT="$(sqlite3 -readonly "$DST" 'SELECT COUNT(*) FROM trialreservations;')"
echo "迁移完成：目标库现有记录数 $OLD_CNT → $NEW_CNT"
echo "确认无误后可归档旧库：mv $SRC ${SRC}.migrated"
