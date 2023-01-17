Param (
  [string]$Name,
  [string[]]$Urls,
  [string]$ObsScenes,
  [string]$ObsProfile,
  [string]$ObsGlobal
)

$folder = Join-Path -Path $PSScriptRoot -ChildPath $Name

function Get-Bin() {
  $bin = Get-ChildItem -Include "*obs64.exe" -Recurse
  if ($bin) {
    Write-Output $bin.FullName
    Pop-Location
    exit
  }
}

mkdir $folder -ErrorAction SilentlyContinue | Out-Null
Push-Location $folder

Get-Bin

foreach ($url in $urls) {
  $filename = Split-Path $url -Leaf
  if (!(Test-Path $filename)) {
    Write-Information -MessageData "Downloading $url to $filename..."
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $filename
    $ProgressPreference = 'Continue'
  } else {
    Write-Information -MessageData "Already downloaded $filename"
  }
}

Get-ChildItem "*.zip" | Expand-Archive -DestinationPath "." -Force

New-Item -ItemType File -Name "portable_mode.txt" -Force | Out-Null

New-Item -ItemType File -Path "config\obs-studio\basic\scenes" -Name "Untitled.json" -Force -Value $ObsScenes | Out-Null

New-Item -ItemType File -Path "config\obs-studio\basic\profiles\Untitled" -Name "basic.ini" -Force -Value $ObsProfile | Out-Null

if ($ObsGlobal) {
  New-Item -ItemType File -Path "config\obs-studio" -Name "global.ini" -Force -Value $ObsGlobal | Out-Null
}

Get-Bin

Write-Error "OBS install failed"
exit 1

