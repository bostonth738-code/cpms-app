@echo off
REM Batch File: ติดตั้งภาษาไทย - Run as Administrator
REM ⚠️ ต้องรัน as Admin

REM ตรวจสอบ Admin privilege
REM https://stackoverflow.com/questions/11134031/batch-script-to-check-for-admin-privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ================================
    echo  ERROR: ต้อง Run as Administrator
    echo ================================
    echo.
    echo วิธีแก้:
    echo 1. ปิด Command Prompt นี้
    echo 2. คลิกขวาไฟล์ install-thai-language.bat
    echo 3. เลือก "Run as administrator"
    echo.
    pause
    exit /b 1
)

cls
echo ================================
echo   ติดตั้งภาษาไทยใน Windows
echo ================================
echo.
echo ⏳ กำลังติดตั้ง...
echo.

REM รัน PowerShell script
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-thai-language.ps1"

echo.
echo ================================
if %errorLevel% equ 0 (
    echo ✅ สำเร็จ!
) else (
    echo ❌ มีข้อผิดพลาด
)
echo ================================
echo.
pause
