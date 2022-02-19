# DETOCS
Datagram's Esports Tournament Overlay Control System (DETOCS) is a tool designed to allow a stream producer to completely manage an esports broadcast, including: updating scoreboards and overlays, pulling data from bracket services, sharing status updates and highlights on social media, and uploading VODs.
I (Datagram) created DETOCS to simplify and streamline my own workflows while broadcasting tournaments for [Lunar Phase](https://twitter.com/LunarPhaseProd); I've decided to share this tool in the hope that others find it useful as well.

![The DETOCS scoreboard tab](docs/images/tab_scoreboard.png)

Bear in mind that DETOCS is currently alpha-stage software.
There will be (hopefully minor) bugs, and there will likely be backwards-incompatible changes.
If it's any consolation, I use this program on a regular basis so I'm probably breaking my own stuff too.

## Features

### Deep Service Integrations
- Load matches and players directly from Smash.gg, Challonge, or Battlefy.
	![The DETOCS bracket tab](docs/images/tab_bracket.png)

- Pull screenshots and replays directly from OBS
	![The DETOCS clips tab](docs/images/tab_clips.png)

- Share media to Twitter on the fly
	![The DETOCS Twitter tab](docs/images/tab_twitter.png)

- Upload VODs to YouTube with automatic titles, tags, and timestamps
	![DETOCS VOD upload command line output](docs/images/vod_metadata.png)

### Clip Editor
Never ask viewers to clip things for you again!
DETOCS features a lightweight video editor to let you trim clips on the fly.
The editor includes audio waveforms so that you can pick the perfect start and end points even when you can't listen to the clip.
![The DETOCS clip editor](docs/images/tab_clips_video.png)

### Overlay Compatibility
DETOCS won't force you to rewrite all your overlays just to use it.
Its extremely flexible output system lets you use it as a drop-in replacement for pretty much any overlay that reads its data from a file or via WebSocket.
If you're using overlays authored by someone else, simply configure DETOCS to impersonate whatever format their overlays expect.

### Cross-Platform Compatibility
Since it's built on platform-agnostic technologies, DETOCS can be used not only on Windows but on MacOS and Linux as well.
DETOCS is currently only being actively tested on Windows, so consider MacOS and Linux support to be it'll-probably-work-tier.

### Responsive UI
Stream producers generally have better things to do with their screen space than dedicate a whole monitor to a single app.
DETOCS's UI is designed to easily reflow and resize, and should be usable on mobile phone screens, desktop monitors, and everything in-between.

### Network Access
DETOCS's UI is web-based, meaning any device with a web browser and network access to the machine DETOCS is running on can control the app.

### Local Executable
Event streamers constantly have to worry about having their broadcast ruined by things outside their control, and I'd rather not add "Datagram's DNS configuration" and "Datagram's web hosting" to the list of potentials.
You're welcome to host DETOCS wherever you want, but you will never be _required_ to use a cloud-hosted app.

## Getting Started

## Dependencies
- [FFmpeg](https://www.ffmpeg.org/) - Used for media editing features.
- (optional) [obs-websocket](https://github.com/Palakis/obs-websocket) version 4.7 or later - Used for integration with [OBS](https://obsproject.com/).
- (optional) [MKVToolNix](https://mkvtoolnix.download/) - Used for VOD editing.

### Installation
Head to [the releases page](https://github.com/data-enabler/detocs/releases) to grab the latest release for your platform.
DETOCS is currently available in two forms:
- A larger full-sized app that bundles its own UI.
- A smaller single-file server-only app that requires users to connect to the server via web browser.

Once you've downloaded and unzipped the program, simply run the `.exe` file.

### Usage
Refer to [the usage documentation](docs/index.md) for how to use the program.

## License
DETOCS is [licensed under the AGPL V3 license](LICENSE), meaning open access to the source code and the ability to make whatever modifications you want.
If you distribute modified copies of the program (including allowing others to use the program via a network), you must make the source code available as well.

If you're interested in purchasing DETOCS with a less-restrictive license, feel free to reach out to me directly.

## Alternatives
- [StreamControl (open source)](https://github.com/farpenoodle/StreamControl)
- [PIIO (Production Interface IO)](https://discord.gg/EegKzY4)
- [Scoreboard Assistant (legacy)](https://obsproject.com/forum/resources/scoreboard-assistant.112/)
- [Scoreboard Assistant (web)](http://8wr.io/)
