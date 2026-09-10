# Postgres — Absensi LT

Mac: brew install postgresql@15; brew services start postgresql@15; psql --version
Linux: sudo apt install postgresql; systemctl enable postgresql
Windows: https://www.postgresql.org/download/

Test:
psql -U postgres → \l → \q
cd /Users/anm/Desktop/absensi-lt-mtsn1; npm run setup-db  # buat 7 tabel + 56 guru

User: postgres (pass di .env DB_PASSWORD)
Troubleshoot: psql not found → export PATH="/usr/local/opt/postgresql@15/bin:$PATH" >> ~/.zshrc
Connection refused → brew services restart postgresql@15 / systemctl restart postgresql
Alter pass: sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'xxx';"
Pindah laptop: pg_dump -U postgres absensi_mtsn1 > backup.sql ; psql newDB < backup.sql
