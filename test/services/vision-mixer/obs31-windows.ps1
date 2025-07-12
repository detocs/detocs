$name = 'obs31'
$port = 41238
$urls =
  'https://github.com/obsproject/obs-studio/releases/download/31.1.0/OBS-Studio-31.1.0-Windows-x64.zip'
$tempDir = Join-Path -Path ([System.IO.Path]::GetTempPath()) -ChildPath "detocs-testing\$name"
mkdir $tempDir -ErrorAction SilentlyContinue | Out-Null

& "$PSScriptRoot\install-obs.ps1" `
  -Name $name `
  -Urls $urls `
  -ObsScenes @"
{
  "current_program_scene": "Scene",
  "current_scene": "Scene",
  "name": "Untitled",
  "scene_order": [
    {
      "name": "Scene"
    }
  ],
  "sources": [
    {
      "enabled": true,
      "id": "browser_source",
      "muted": false,
      "name": "Browser",
      "settings": {
        "css": "",
        "height": 1080,
        "url": "http://webglsamples.org/aquarium/aquarium.html",
        "width": 1920
      },
      "versioned_id": "browser_source"
    },
    {
      "id": "scene",
      "name": "Scene",
      "settings": {
        "custom_size": false,
        "id_counter": 1,
        "items": [
          {
            "align": 5,
            "id": 1,
            "locked": true,
            "name": "Browser",
            "pos": {
              "x": 0.0,
              "y": 0.0
            },
            "visible": true
          }
        ]
      },
      "versioned_id": "scene"
    }
  ]
}
"@ `
  -ObsProfile @"
[General]
Name=Untitled

[Video]
BaseCX=1920
BaseCY=1080
OutputCX=1280
OutputCY=720

[WebsocketAPI]
ServerEnabled=true
ServerPort=$port
LockToIPv4=false
DebugEnabled=false
AlertsEnabled=false
AuthRequired=true
AuthSecret=2Z19PaSap1xha70O7N217ZAycGDhzySNUzNkEh97kkw=
AuthSalt=w5QVXwuapwVFqIWNioM56VbIt8joxOYM64xcflVKacA=

[Output]
Mode=Advanced

[AdvOut]
TrackIndex=1
RecType=Standard
RecTracks=1
FLVTrack=1
FFOutputToFile=true
FFFormat=
FFFormatMimeType=
FFVEncoderId=0
FFVEncoder=
FFAEncoderId=0
FFAEncoder=
FFAudioMixes=1
VodTrackIndex=2
RecRB=true
RecRBTime=60
RecFilePath=$tempDir
"@ `
  -ObsGlobal @"
[OBSWebSocket]
FirstLoad=false
ServerEnabled=true
ServerPort=$port
AlertsEnabled=false
AuthRequired=true
ServerPassword=test1234
"@
