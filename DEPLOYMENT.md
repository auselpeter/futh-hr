# FUTH LAFIA HR — Deployment Guide

## Option 1: Local Development (SQLite — default)

```bash
# 1. Install dependencies
bun install

# 2. Copy the SQLite database (or let Prisma create a new one)
# If you have the database file:
cp futh_hr_sqlite_database.db db/custom.db

# OR start fresh:
mkdir -p db
bunx prisma db push
bunx prisma generate
# Then seed: bun run scripts/seed.ts

# 3. Start the dev server
bun run dev
# Visit http://localhost:3000
# Login: admin / admin123
```

## Option 2: Cloud Hosting (MySQL)

```bash
# 1. Install dependencies
bun install

# 2. Create a MySQL database
mysql -u root -p -e "CREATE DATABASE futh_hr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 3. Import the data
mysql -u root -p futh_hr < futh_hr_mysql_dump.sql

# 4. Update .env for MySQL
# Edit .env:
#   DATABASE_URL="mysql://username:password@localhost:3306/futh_hr"

# 5. Update the Prisma schema for MySQL
# Edit prisma/schema.prisma:
#   Change "provider = sqlite" to "provider = "mysql""
# OR use the pre-made MySQL schema:
cp prisma/schema.mysql.prisma prisma/schema.prisma

# 6. Generate Prisma client
bunx prisma generate

# 7. Build for production
bun run build

# 8. Start the production server
bun run start
# Visit http://localhost:3000
```

## Option 3: Cloud Hosting (PostgreSQL)

```bash
# 1. Install dependencies
bun install

# 2. Create a PostgreSQL database
createdb futh_hr

# 3. Update .env for PostgreSQL
# Edit .env:
#   DATABASE_URL="postgresql://username:password@localhost:5432/futh_hr"

# 4. Update the Prisma schema for PostgreSQL
# Edit prisma/schema.prisma:
#   Change "provider = sqlite" to "provider = "postgresql""

# 5. Push schema + generate
bunx prisma db push
bunx prisma generate

# 6. Build + start
bun run build
bun run start
```

## Environment Variables (.env)

```env
# SQLite (local)
DATABASE_URL="file:./db/custom.db"

# MySQL (cloud)
DATABASE_URL="mysql://username:password@host:3306/futh_hr"

# PostgreSQL (cloud)
DATABASE_URL="postgresql://username:password@host:5432/futh_hr"
```

## Switching from SQLite to MySQL

If you already have data in SQLite and want to move to MySQL:

```bash
# 1. Export from SQLite to MySQL dump
bun run scripts/export-mysql-dump.ts

# 2. Import into MySQL
mysql -u root -p < download/futh_hr_mysql_dump.sql

# 3. Update .env
# Change DATABASE_URL to the MySQL connection string

# 4. Update prisma/schema.prisma
# Change provider = "sqlite" to provider = "mysql"

# 5. Regenerate Prisma client
bunx prisma generate
```

## Common Errors & Fixes

### Error: "Database connection error" or "Cannot connect to database"
- Check that your DATABASE_URL is correct in .env
- For MySQL: ensure the database exists and user has permissions
- For SQLite: ensure the db/ folder exists and is writable

### Error: "Prisma Client not generated"
- Run: `bunx prisma generate`
- This regenerates the Prisma client from the schema

### Error: "Schema migration error"
- Run: `bunx prisma db push` (creates/updates tables to match schema)
- This is safe to run multiple times — it only adds missing tables/columns

### Error: "Provider mismatch"
- If using MySQL: ensure `provider = "mysql"` in schema.prisma
- If using SQLite: ensure `provider = "sqlite"` in schema.prisma
- The provider must match the DATABASE_URL protocol

### Error: "Table already exists" when importing MySQL dump
- The dump uses `DROP TABLE IF EXISTS` before each `CREATE TABLE`
- If you still get this error, drop the database and re-import:
  ```sql
  DROP DATABASE futh_hr;
  CREATE DATABASE futh_hr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  ```

## Demo Logins (all password: admin123)

- admin / admin123
- superadmin / admin123
- 603704 / admin123 (login by IPPIS number)
- staff1 / admin123
- registry / admin123
