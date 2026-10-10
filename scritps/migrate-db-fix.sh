docker compose down

# 1. Rename the old-named table inside the NEW db (keeps your 测试1 record)
sqlite3 ./data/trialreservations.db <<'SQL'
ALTER TABLE reservations RENAME TO trialreservations;
SQL

# 2. Migrate the 4 old records in
sqlite3 ./data/trialreservations.db <<'SQL'
ATTACH DATABASE './data/reservations.db' AS old;
BEGIN;
INSERT INTO trialreservations (hospital, department, name, phone, note, created_at)
  SELECT hospital, department, name, phone, note, created_at FROM old.reservations ORDER BY id;
COMMIT;
DETACH DATABASE old;
SQL

# 3. CRITICAL: rebuild the image so the container runs the renamed code
docker compose up -d --build

bash scritps/dump-db.sh ./data/trialreservations.db   # verify: expect 5 records
