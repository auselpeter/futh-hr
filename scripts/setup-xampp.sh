#!/bin/bash
# ============================================================
# FUTH LAFIA HR — XAMPP MySQL Setup Script
# ============================================================
# Run this script on your XAMPP machine to configure the
# Next.js project to use MySQL instead of SQLite.
#
# Prerequisites:
#   - XAMPP installed (MySQL running on port 3306)
#   - Node.js 18+ or Bun installed
#   - This project extracted to a folder
#
# Usage:
#   bash setup-xampp.sh
# ============================================================

set -e

echo "=========================================="
echo "  FUTH LAFIA HR — XAMPP MySQL Setup"
echo "=========================================="
echo ""

# 1. Create the database
echo "[1/6] Creating MySQL database 'futh_hr'..."
echo ""
echo "  Make sure XAMPP MySQL is running (open XAMPP Control Panel → Start MySQL)"
echo ""

# Try to create the database via mysql command
if command -v mysql &> /dev/null; then
    mysql -u root -e "CREATE DATABASE IF NOT EXISTS futh_hr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    echo "  ✓ Database 'futh_hr' created (or already exists)"
elif [ -f "/c/xampp/mysql/bin/mysql.exe" ]; then
    # Windows XAMPP
    /c/xampp/mysql/bin/mysql.exe -u root -e "CREATE DATABASE IF NOT EXISTS futh_hr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    echo "  ✓ Database 'futh_hr' created via XAMPP MySQL"
elif [ -f "/opt/lampp/bin/mysql" ]; then
    # Linux XAMPP
    /opt/lampp/bin/mysql -u root -e "CREATE DATABASE IF NOT EXISTS futh_hr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    echo "  ✓ Database 'futh_hr' created via XAMPP MySQL"
else
    echo "  ! Could not find mysql command."
    echo "  Please create the database manually:"
    echo "    1. Open phpMyAdmin (http://localhost/phpmyadmin)"
    echo "    2. Click 'New' → Create database named 'futh_hr'"
    echo "    3. Set collation to 'utf8mb4_unicode_ci'"
    echo "    4. Press Enter to continue..."
    read
fi

# 2. Import the data
echo ""
echo "[2/6] Importing data from MySQL dump..."
if [ -f "download/futh_hr_mysql_dump.sql" ]; then
    DUMP_FILE="download/futh_hr_mysql_dump.sql"
elif [ -f "futh_hr_mysql_dump.sql" ]; then
    DUMP_FILE="futh_hr_mysql_dump.sql"
else
    echo "  ! MySQL dump file not found."
    echo "  Please download futh_hr_mysql_dump.sql and place it in this folder."
    echo "  Press Enter to continue without importing..."
    read
    DUMP_FILE=""
fi

if [ -n "$DUMP_FILE" ]; then
    if command -v mysql &> /dev/null; then
        mysql -u root futh_hr < "$DUMP_FILE" 2>/dev/null && echo "  ✓ Data imported" || echo "  ! Import had warnings (usually OK)"
    elif [ -f "/c/xampp/mysql/bin/mysql.exe" ]; then
        /c/xampp/mysql/bin/mysql.exe -u root futh_hr < "$DUMP_FILE" 2>/dev/null && echo "  ✓ Data imported" || echo "  ! Import had warnings (usually OK)"
    elif [ -f "/opt/lampp/bin/mysql" ]; then
        /opt/lampp/bin/mysql -u root futh_hr < "$DUMP_FILE" 2>/dev/null && echo "  ✓ Data imported" || echo "  ! Import had warnings (usually OK)"
    else
        echo "  ! Could not import automatically."
        echo "  Import manually via phpMyAdmin:"
        echo "    1. Open http://localhost/phpmyadmin"
        echo "    2. Select 'futh_hr' database"
        echo "    3. Click 'Import' tab"
        echo "    4. Choose $DUMP_FILE"
        echo "    5. Click 'Go'"
    fi
fi

# 3. Update .env for MySQL
echo ""
echo "[3/6] Updating .env for MySQL..."
cat > .env << 'ENVFILE'
DATABASE_URL=mysql://root@localhost:3306/futh_hr
DEFAULT_PASSWORD=admin123
ENVFILE
echo "  ✓ .env updated: DATABASE_URL=mysql://root@localhost:3306/futh_hr"
echo ""
echo "  If your MySQL has a password, edit .env and change to:"
echo "  DATABASE_URL=mysql://root:YOUR_PASSWORD@localhost:3306/futh_hr"

# 4. Switch schema to MySQL
echo ""
echo "[4/6] Switching Prisma schema to MySQL..."
if [ -f "prisma/schema.mysql.prisma" ]; then
    cp prisma/schema.mysql.prisma prisma/schema.prisma
    echo "  ✓ Copied prisma/schema.mysql.prisma → prisma/schema.prisma"
else
    # Edit the schema directly
    sed -i 's/provider = "sqlite"/provider = "mysql"/' prisma/schema.prisma 2>/dev/null || \
    sed -i '' 's/provider = "sqlite"/provider = "mysql"/' prisma/schema.prisma
    echo "  ✓ Changed provider to mysql in prisma/schema.prisma"
fi

# 5. Generate Prisma client
echo ""
echo "[5/6] Generating Prisma client..."
bunx prisma generate 2>&1 | tail -3
echo "  ✓ Prisma client generated"

# 6. Build + start
echo ""
echo "[6/6] Building for production..."
echo ""
echo "  To start in DEVELOPMENT mode:"
echo "    bun run dev"
echo ""
echo "  To start in PRODUCTION mode:"
echo "    bun run build"
echo "    bun run start"
echo ""
echo "  Then visit: http://localhost:3000"
echo "  Login: admin / admin123"
echo "  Or login by IPPIS: 603704 / admin123"
echo ""
echo "=========================================="
echo "  Setup complete! ✓"
echo "=========================================="
