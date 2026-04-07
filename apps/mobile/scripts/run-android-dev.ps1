$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Split-Path -Parent $scriptDir
$repoRoot = Split-Path -Parent (Split-Path -Parent $appDir)
$packageName = "com.samhill.mobilemechanicsoftware"
$prefName = "$packageName`_preferences.xml"
$prefRemoteTmp = "/data/local/tmp/$prefName"
$prefRemoteDir = "/data/user/0/$packageName/shared_prefs"
$prefRemotePath = "$prefRemoteDir/$prefName"
$prefLocalPath = Join-Path $env:TEMP $prefName
$prefScriptLocalPath = Join-Path $env:TEMP "prime-android-dev-host.sh"
$prefScriptRemotePath = "/data/local/tmp/prime-android-dev-host.sh"

function Invoke-Adb {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  & adb @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "adb $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
  }
}

function Set-DebugHostPreference {
  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText(
    $prefLocalPath,
    "<?xml version='1.0' encoding='utf-8' standalone='yes' ?>`n<map>`n    <string name=""debug_http_host"">127.0.0.1:8081</string>`n</map>`n",
    $utf8NoBom
  )
  [System.IO.File]::WriteAllText(
    $prefScriptLocalPath,
    "mkdir -p '$prefRemoteDir'`ncp '$prefRemoteTmp' '$prefRemotePath'`nchmod 600 '$prefRemotePath'`n",
    $utf8NoBom
  )

  Invoke-Adb push $prefLocalPath $prefRemoteTmp | Out-Null
  Invoke-Adb push $prefScriptLocalPath $prefScriptRemotePath | Out-Null
  Invoke-Adb shell run-as $packageName sh $prefScriptRemotePath | Out-Null
}

Write-Host "Installing Android debug build..."
Push-Location $appDir
try {
  $metroReady = $false
  try {
    $probe = Invoke-WebRequest -Uri "http://127.0.0.1:8081/status" -UseBasicParsing -TimeoutSec 2
    if ($probe.Content -match "packager-status:running") {
      $metroReady = $true
    }
  } catch {
    $metroReady = $false
  }

  if ($metroReady) {
    & npx expo run:android --no-bundler
  } else {
    & npx expo run:android
  }
  if ($LASTEXITCODE -ne 0) {
    throw "expo run:android failed with exit code $LASTEXITCODE."
  }
} finally {
  Pop-Location
}

Write-Host "Priming Android emulator dev host..."
Invoke-Adb reverse tcp:8081 tcp:8081 | Out-Null
Invoke-Adb reverse tcp:3000 tcp:3000 | Out-Null
Invoke-Adb reverse tcp:54321 tcp:54321 | Out-Null
Set-DebugHostPreference
Invoke-Adb shell am force-stop $packageName | Out-Null
Invoke-Adb @("shell", "monkey", "-p", $packageName, "-c", "android.intent.category.LAUNCHER", "1") | Out-Null

Write-Host "Android debug build installed and pointed at 127.0.0.1:8081."
