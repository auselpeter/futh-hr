@echo off
REM ============================================================
REM  FUTH LAFIA HR - XAMPP MySQL Setup (Windows)
REM ============================================================
REM  Run this on your Windows machine to configure the project
REM  to use XAMPP MySQL instead of SQLite.
REM
REM  Prerequisites:
REM    - XAMPP installed (MySQL running on port 3306)
REM    - Node.js installed (npm available)
REM    - npm install already completed
REM
REM  Usage:
REM    setup-xampp.bat
REM ============================================================

echo ==========================================
echo   FUTH LAFIA HR - XAMPP MySQL Setup
echo ==========================================
echo.

REM Check if XAMPP MySQL is running
echo [1/7] Checking XAMPP MySQL...
echo.

REM Try to find the XAMPP mysql command
set MYSQL_CMD=
if exist "C:\xampp\mysql\bin\mysql.exe" (
    set MYSQL_CMD=C:\xampp\mysql\bin\mysql.exe
) else if exist "C:\xampp\mysql\bin\mariadb.exe" (
    set MYSQL_CMD=C:\xampp\mysql\bin\mariadb.exe
) else (
    echo   ! Could not find XAMPP MySQL at C:\xampp\mysql\bin\
    echo   Trying system mysql...
    where mysql >nul 2>&1
    if %errorlevel% equ 0 (
        set MYSQL_CMD=mysql
    ) else (
        echo   ! Could not find mysql command.
        echo.
        echo   Please do manually:
        echo   1. Open XAMPP Control Panel
        echo   2. Start MySQL
        echo   3. Open http://localhost/phpmyadmin
        echo   4. Click "New" ^> Create database named "futh_hr"
        echo   5. Set collation to "utf8mb4_unicode_ci"
        echo.
        pause
        goto :end
    )
)

echo   Found MySQL at: %MYSQL_CMD%
echo.

REM Create the database
echo [2/7] Creating MySQL database 'futh_hr'...
"%MYSQL_CMD%" -u root -e "CREATE DATABASE IF NOT EXISTS futh_hr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>nul
if %errorlevel% equ 0 (
    echo   v Database 'futh_hr' created (or already exists)
) else (
    echo   ! Could not create database. Please create it manually via phpMyAdmin.
    echo   1. Open http://localhost/phpmyadmin
    echo   2. Click "New" ^> Create database named "futh_hr"
    echo   3. Set collation to "utf8mb4_unicode_ci"
    pause
)
echo.

REM Import the data
echo [3/7] Importing data from MySQL dump...
set DUMP_FILE=
if exist "futh_hr_mysql_dump.sql" (
    set DUMP_FILE=futh_hr_mysql_dump.sql
) else if exist "download\futh_hr_mysql_dump.sql" (
    set DUMP_FILE=download\futh_hr_mysql_dump.sql
) else (
    echo   ! MySQL dump file not found in this folder.
    echo   Please download futh_hr_mysql_dump.sql and place it in:
    echo   C:\xampp\htdocs\futh-nextjs\
    echo.
    echo   You can import it manually via phpMyAdmin:
    echo   1. Open http://localhost/phpmyadmin
    echo   2. Select 'futh_hr' database
    echo   3. Click 'Import' tab
    echo   4. Choose futh_hr_mysql_dump.sql
    echo   5. Click 'Go'
    echo.
    pause
    goto :step4
)

echo   Importing from: %DUMP_FILE%
echo   This may take a few minutes...
"%MYSQL_CMD%" -u root futh_hr < "%DUMP_FILE%" 2>nul
if %errorlevel% equ 0 (
    echo   v Data imported successfully
) else (
    echo   ! Import had some warnings (usually OK - duplicates may be skipped)
    echo   If login fails, try importing via phpMyAdmin instead.
)
echo.

:step4
REM Update .env for MySQL
echo [4/7] Updating .env for MySQL...
(
    echo DATABASE_URL=mysql://root@localhost:3306/futh_hr
    echo DEFAULT_PASSWORD=admin123
) > .env
echo   v .env updated: DATABASE_URL=mysql://root@localhost:3306/futh_hr
echo.
echo   If your MySQL has a password, edit .env and change to:
echo   DATABASE_URL=mysql://root:YOUR_PASSWORD@localhost:3306/futh_hr
echo.

REM Switch schema to MySQL
echo [5/7] Switching Prisma schema to MySQL...
if exist "prisma\schema.mysql.prisma" (
    copy /Y "prisma\schema.mysql.prisma" "prisma\schema.prisma" >nul
    echo   v Copied prisma\schema.mysql.prisma to prisma\schema.prisma
) else (
    REM Edit the schema directly
    powershell -Command "(Get-Content prisma\schema.prisma) -replace 'provider = ""sqlite""', 'provider = ""mysql""' | Set-Content prisma\schema.prisma"
    echo   v Changed provider to mysql in prisma\schema.prisma
)
echo.

REM Generate Prisma client
echo [6/7] Generating Prisma client...
call npx prisma generate 2>nul
if %errorlevel% equ 0 (
    echo   v Prisma client generated
) else (
    echo   ! Prisma generate failed. Try running: npx prisma generate
    echo   Make sure your .env has the correct DATABASE_URL
)
echo.

REM Done
echo [7/7] Setup complete!
echo.
echo ==========================================
echo   Next steps:
echo ==========================================
echo.
echo   To start in DEVELOPMENT mode:
echo     npm run dev
echo.
echo   To start in PRODUCTION mode:
echo     npm run build
echo     npm run start
echo.
echo   Then visit: http://localhost:3000
echo.
echo   Login: admin / admin123
echo   Or by IPPIS: 603704 / admin123
echo.
echo ==========================================
echo   Setup complete! v
echo ==========================================
echo.
pause

:end
