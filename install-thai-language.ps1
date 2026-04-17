# PowerShell Script: ติดตั้งภาษาไทยใน Windows
# ⚠️ ต้อง Run as Administrator

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  ติดตั้งภาษาไทยใน Windows" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# ตรวจสอบว่ารัน as Admin หรือไม่
$isAdmin = ([System.Security.Principal.WindowsIdentity]::GetCurrent()).Groups -contains [System.Security.Principal.SecurityIdentifier]"S-1-5-32-544"

if (-not $isAdmin) {
    Write-Host "❌ ต้องรัน PowerShell เป็น Administrator!" -ForegroundColor Red
    Write-Host ""
    Write-Host "วิธีแก้:" -ForegroundColor Yellow
    Write-Host "1. ปิด PowerShell นี้"
    Write-Host "2. ค้นหา PowerShell"
    Write-Host "3. คลิกขวา > 'Run as administrator'"
    Write-Host "4. รัน script อีกครั้ง"
    Read-Host "กด Enter เพื่อปิด"
    exit 1
}

Write-Host "✅ รัน as Administrator:  SUCCESS" -ForegroundColor Green
Write-Host ""

# ติดตั้งภาษาไทย
Write-Host "⏳ กำลังติดตั้งภาษาไทย..." -ForegroundColor Cyan
Write-Host "   (อาจใช้เวลา 2-5 นาที)" -ForegroundColor Gray
Write-Host ""

try {
    # ใช้ PowerShell ติดตั้งภาษา
    $LangTag = "th-TH"
    
    # วิธี 1: ใช้ dism command
    Write-Host "📦 ขั้นตอนที่ 1: โหลด Language Pack..." -ForegroundColor Yellow
    
    # ตรวจสอบว่ามีภาษาไทยติดตั้งแล้วหรือไม่
    $installedLanguages = Get-WinUserLanguageList
    $thaiExists = $installedLanguages | Where-Object { $_.LanguageTag -eq $LangTag }
    
    if ($thaiExists) {
        Write-Host "✅ ภาษาไทยติดตั้งแล้ว!" -ForegroundColor Green
    } else {
        Write-Host "📥 เพิ่มภาษาไทยในระบบ..." -ForegroundColor Cyan
        
        # เพิ่มภาษาไทย
        $LangList = Get-WinUserLanguageList
        $LangList.Add($LangTag)
        Set-WinUserLanguageList $LangList -Force
        
        Write-Host "✅ ภาษาไทยถูกเพิ่มเรียบร้อย!" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "✅ การติดตั้งเสร็จสิ้น! " -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 ขั้นตอนต่อไป:" -ForegroundColor Yellow
    Write-Host "1. ปิด PowerShell นี้"
    Write-Host "2. เปิด Windows Settings (Windows + I)"
    Write-Host "3. ไปที่ Time & Language > Language & region"
    Write-Host "4. ดูว่า 'Thai' ปรากฏในรายชื่อหรือไม่"
    Write-Host "5. (เลือก Thai เป็น Preferred language ถ้าต้องการ)"
    Write-Host ""
    
} catch {
    Write-Host "❌ เกิดข้อผิดพลาด: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "⚠️ แนะนำ: ลองติดตั้งแบบแผ่นอะไรหรือ Windows Update" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "กด Enter เพื่อปิด" -ForegroundColor Gray
Read-Host
