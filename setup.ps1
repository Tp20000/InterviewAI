param()
$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  InterviewAI - Full Setup Script" -ForegroundColor Cyan  
Write-Host "============================================" -ForegroundColor Cyan

# Check Python
try {
    $pyVer = python --version 2>&1
    Write-Host "[OK] $pyVer" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python not found! Install Python 3.10+" -ForegroundColor Red
    exit 1
}

# Check Node
try {
    $nodeVer = node --version 2>&1
    Write-Host "[OK] Node.js $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js not found! Install Node.js 18+" -ForegroundColor Red
    exit 1
}

# Create directories
Write-Host "`nCreating directories..." -ForegroundColor Yellow
$dirs = @(
    "backend\uploads\videos",
    "backend\uploads\audio", 
    "backend\uploads\recordings",
    "backend\instance",
    "frontend\public\models"
)
foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Path "$root\$dir" -Force | Out-Null
}
Write-Host "[OK] Directories created" -ForegroundColor Green

# Backend setup
Write-Host "`nSetting up Python backend..." -ForegroundColor Yellow
Set-Location "$root\backend"

if (-not (Test-Path "venv")) {
    python -m venv venv
    Write-Host "[OK] Virtual environment created" -ForegroundColor Green
}

Write-Host "Activating venv and installing packages..." -ForegroundColor Yellow
& ".\venv\Scripts\pip.exe" install --upgrade pip --quiet

$packages = @(
    "flask==3.0.3",
    "flask-socketio==5.3.6",
    "flask-cors==4.0.1",
    "flask-jwt-extended==4.6.0",
    "flask-sqlalchemy==3.1.1",
    "python-dotenv==1.0.1",
    "werkzeug==3.0.3",
    "groq==0.9.0",
    "scikit-learn==1.5.1",
    "apscheduler==3.10.4",
    "SpeechRecognition==3.10.4",
    "eventlet==0.36.1",
    "Pillow==10.4.0",
    "numpy==1.26.4",
    "python-engineio==4.9.1",
    "python-socketio==5.11.3"
)

foreach ($pkg in $packages) {
    Write-Host "  Installing $pkg..." -ForegroundColor Gray
    & ".\venv\Scripts\pip.exe" install $pkg --quiet
}

Write-Host "[OK] Python packages installed" -ForegroundColor Green

# Try sentence-transformers (optional, heavy)
Write-Host "Installing sentence-transformers (optional, may take a while)..." -ForegroundColor Yellow
try {
    & ".\venv\Scripts\pip.exe" install "sentence-transformers==3.0.1" --quiet
    Write-Host "[OK] sentence-transformers installed" -ForegroundColor Green
} catch {
    Write-Host "[SKIP] sentence-transformers failed - will use TF-IDF fallback" -ForegroundColor Yellow
}

# Seed demo accounts
Write-Host "`nSeeding demo accounts..." -ForegroundColor Yellow
& ".\venv\Scripts\python.exe" seed_demo.py

# Frontend setup
Write-Host "`nSetting up React frontend..." -ForegroundColor Yellow
Set-Location "$root\frontend"

npm install --silent
Write-Host "[OK] npm packages installed" -ForegroundColor Green

# Download face-api models
Write-Host "`nDownloading face-api.js models..." -ForegroundColor Yellow
Set-Location $root
& powershell -File ".\download_models.ps1"

Set-Location $root
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Start the app:  .\start.ps1" -ForegroundColor Cyan
Write-Host "  OR manually:" -ForegroundColor Gray
Write-Host "    Backend:  cd backend && .\venv\Scripts\python.exe run.py" -ForegroundColor Gray
Write-Host "    Frontend: cd frontend && npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  Demo Accounts:" -ForegroundColor Yellow
Write-Host "    Admin:     admin@interviewai.com / admin123" -ForegroundColor Gray
Write-Host "    Company:   company@demo.com / demo123" -ForegroundColor Gray
Write-Host "    Candidate: candidate@demo.com / demo123" -ForegroundColor Gray
Write-Host ""