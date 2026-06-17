param(
  [string]$TaskName = "YJS ERP Daily Data Backup",
  [string]$Time = "02:00"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$command = "Set-Location -LiteralPath '$repoRoot'; npm run backup:data"

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"$command`""

$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Creates a private local backup bundle for yjs_erp Excel source data." `
  -Force

Write-Host "Registered scheduled task: $TaskName"
Write-Host "Daily time: $Time"
Write-Host "Repository: $repoRoot"
Write-Host "Command: npm run backup:data"
