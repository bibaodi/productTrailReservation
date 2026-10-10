# 1. env file (compose now points to the new name)
git mv src/reservation.env src/trialreservation.env

# 2. your local dev data — rename all three files or the app
#    will silently start a fresh empty DB
mv reservations.db trialreservations.db
mv reservations.db-shm trialreservations.db-shm
mv reservations.db-wal trialreservations.db-wal
# (same renames inside data/ if you already copied them there)

# 3. rebuild and restart
docker compose down && docker compose up -d --build
