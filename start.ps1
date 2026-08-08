param()
$root = $PSScriptRoot
Write-Host ""
Write-Host "  InterviewAI - Starting..." -ForegroundColor Cyan
Write-Host "  Backend  -> http://localhost:5000" -ForegroundColor Gray
Write-Host "  Frontend -> http://localhost:5173" -ForegroundColor Gray
Write-Host "  Press Ctrl+C to stop both" -ForegroundColor Gray
Write-Host ""

# Start Backend
$backendJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location "$root\backend"
    if (Test-Path ".\venv\Scripts\python.exe") {
        & ".\venv\Scripts\python.exe" run.py
    } else {
        python run.py
    }
} -ArgumentList $root

# Give backend time to start
Start-Sleep -Seconds 3

# Start Frontend
$frontendJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location "$root\frontend"
    npm run dev
} -ArgumentList $root

Write-Host "  Both servers starting..." -ForegroundColor Green
Write-Host "  Open http://localhost:5173 in your browser" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Demo Accounts:" -ForegroundColor Yellow
Write-Host "  Admin:     admin@interviewai.com / admin123" -ForegroundColor Gray
Write-Host "  Company:   company@demo.com / demo123" -ForegroundColor Gray
Write-Host "  Candidate: candidate@demo.com / demo123" -ForegroundColor Gray
Write-Host ""

try {
    while ($true) {
        $backendOut  = Receive-Job $backendJob  2>&1
        $frontendOut = Receive-Job $frontendJob 2>&1
        if ($backendOut)  { Write-Host "[Backend]  $backendOut"  -ForegroundColor DarkGray }
        if ($frontendOut) { Write-Host "[Frontend] $frontendOut" -ForegroundColor DarkGray }
        Start-Sleep -Milliseconds 500
    }
} finally {
    Stop-Job  $backendJob, $frontendJob
    Remove-Job $backendJob, $frontendJob
    Write-Host "Servers stopped." -ForegroundColor Red
}