param()
$modelsDir = Join-Path $PSScriptRoot "frontend\public\models"
New-Item -ItemType Directory -Path $modelsDir -Force | Out-Null

Write-Host "Downloading face-api.js models..." -ForegroundColor Cyan

$base = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"

$files = @(
    "tiny_face_detector_model-weights_manifest.json",
    "tiny_face_detector_model-shard1"
)

foreach ($file in $files) {
    $url  = "$base/$file"
    $dest = Join-Path $modelsDir $file
    if (Test-Path $dest) {
        Write-Host "  Already exists: $file" -ForegroundColor Gray
    } else {
        try {
            Write-Host "  Downloading: $file" -ForegroundColor Yellow
            Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -TimeoutSec 60
            Write-Host "  Downloaded: $file" -ForegroundColor Green
        } catch {
            Write-Host "  FAILED: $file - $_" -ForegroundColor Red
            Write-Host "  Manual download from: $url" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "Models saved to: frontend/public/models/" -ForegroundColor Green
Write-Host "If download failed, manually copy model files there." -ForegroundColor Yellow