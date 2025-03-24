# DETOCS Usage Guide

## Basics



## Service Integrations

### OBS Studio

In order to use the [Recording](#Recording-Tab) and [Clips](#Clips-Tab) tabs, you'll need to be using OBS Studio for your streams.
In OBS Studio, go to Tools > WebSockets Server Settings and add the port and password being used to your [configuration file](#detocs-configjson).

### start.gg

To pull match data from start.gg, you'll need to [generate a start.gg authentication token][startgg-api].
Once you have a token, add it to your [`decocs-credentials.json`](#detocscredentialsjson) file.

[startgg-api]: http://developer.start.gg/docs/authentication

### Challonge

To pull match data from Challonge, you'll need to create an account and then generate an API key on [your Challonge developer settings page][challonge-api].
Once you have an API key, add it to your [`decocs-credentials.json`](#detocscredentialsjson) file.

[challonge-api]: https://challonge.com/settings/developer

### Twitter

To use DETOCS's Twitter features, you'll need to [create a Twitter developer app][twitter-api].
Once you've created your API app, add its API key and API secret to your [`decocs-credentials.json`](#detocscredentialsjson) file.

[twitter-api]: https://developer.twitter.com/en/docs/twitter-api/getting-started/getting-access-to-the-twitter-api

### YouTube

To use DETOCS's automated VOD upload features, you'll need to [create a Google API app][google-api].
Once you've created your API app, add its API key and API secret to your [`decocs-credentials.json`](#detocscredentialsjson) file.
Note that by default, Google API apps are limited to 6 video uploads a day, unless you [request a quota increase][youtube-quota].

[google-api]: https://developers.google.com/youtube/v3/getting-started
[youtube-quota]: https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits

## Configuration

DETOCS's configuration files are written in JSON, a format that's easy to read for both humans and computers.
If you aren't already familiar with it, you can [learn the basics of JSON in this article][json-tutorial].

[json-tutorial]: https://www.digitalocean.com/community/tutorials/an-introduction-to-json

### detocs-config.json

`detocs-config.json` is the main configuration file for DETOCS, used to control various aspects of the input and output.

This file can be provided in two ways:
- Automatic: When started, DETOCS will search in the folder with the program, and each parent folder, until it finds a file named `detocs-config.json`.
- The location of the config file can also be given via the [command-line interface](#command-line-interface).
  - When provided this way, the file can be given any name you want; this is useful if you want to be able to switch between different configurations.

Minimal example file:
```json
{
}
```

Full example file:
```json
{
  "clipDirectory": "./clips",
  "credentialsFile": "./detocs-credentials.json",
  "databaseDirectory": string,
  "ffmpeg": { transcodeVideoInputArgs: string[], transcodeVideoOutputArgs: string[], },
  "gameDatabaseFile": string,
  "logDirectory": string | null,
  "obs": { address: string, password: string, binPath: string, },
  "outputs": [
    {
      "type": "file",
      "path": "./my-overlays/",
      "templates": [
        "./templates/scoreboard.json.hbs",
        {
          "template": "./templates/commentary_new.json.hbs",
          "outputName": "commentary.json"
        },
      ]
    }
  ],
  "peopleDatabaseFile": string,
  "ports": { web: number, },
  "tempFileExpirationDays": number,
  "vodKeyframeIntervalSeconds": number,
  "vodPerSetTemplate": string,
  "vodSingleVideoTemplate": string,
}
```

| Property Name | Type | Description |
| --- | --- | --- |
| `clipDirectory` | `string` | The directory in which to store rendered [video clips](#clipstab). Relative file paths are considered relative to the config file location. Defaults to a temporary folder. |
| `credentialsFile` | `string` | File from which to load [credentials](#detocs-credentialsjson). Relative file paths are considered relative to the config file location. By default, DETOCS will search parent directories for the nearest `detocs-credentials.json` file. |
| `databaseDirectory` | `string` | Folder where various database files for DETOCS are stored. Relative file paths are considered relative to the config file location. |
| `ffmpeg` | `{ transcodeVideoInputArgs: string[]; transcodeVideoOutputArgs: string[]; }` | Advanced use. [FFmpeg parameters][ffmpeg-cli] used for transcoding clips for upload to Twitter. This does not affect vods, which are always losslessly cut. |
| `ffmpeg.transcodeVideoInputArgs` | `string[]` | FFmpeg CLI options to pass **before** the input file (`-i`). |
| `ffmpeg.transcodeVideoOutputArgs` | `string[]` | FFmpeg CLI options to pass **after** the input file (`-i`). |
| `gameDatabaseFile` | `string` | Relative file paths are considered relative to `databaseDirectory`. |
| `logDirectory` | `string` | Folder in which to store DETOCS log files. Relative file paths are considered relative to the config file location. Defaults to `"./detocs-logs"`. |
| `obs` | `{ address: string; password: string; webSocketVersion: number; binPath: string; }` | OBS Studio configuration. |
| `obs.address` | `string` | Address to use for [OBS websocket][obs-websocket] connections. If you're running OBS on the same computer as DETOCS, this should be in the form `"localhost:[websocket port]"`. Defaults to `"localhost:4456"`. |
| `obs.password` | `string` | If your OBS websocket server is password protected, set the password here. |
| `obs.webSocket` | `string` | Which version of the OBS websocket protocol to use. Defaults to `5`, but if you are using the legacy version of obs-websocket you should set this to `4`. |
| `obs.binPath` | `string` | Advanced use. If you are using a relative path for your recording folder in OBS Studio *and* run OBS Studio as administrator, set this path to point to your OBS Studio .exe file.  |
| `outputs` | (FileOutputConfig | WebSocketOutputConfig)[] | See [Output Configuration](#Output-Configuration) |
| `peopleDatabaseFile` | `string` | Relative file paths are considered relative to `databaseDirectory`. |
| `ports` | `{ web: number; }` | Ports to use for different DETOCS components.  |
| `ports.web` | `number` | Port to use for the main web interface (accessed at `http://localhost:[port]`). |
| `tempFileExpirationDays` | `number` | Temporary files that are older than this many days are deleted on startup. Defaults to 5. |
| `vodKeyframeIntervalSeconds` | `number` | Advanced use. Speed up video editing by assuming a fixed keyframe interval instead of reading keyframes from the video file. Note: having a keyframe interval set in OBS does not guarantee that recordings will follow that interval precisely. |
| `vodPerSetTemplate` | `string` | See [Templates](#Templates). |
| `vodSingleVideoTemplate` | `string` | See [Templates](#Templates). |

[ffmpeg-cli]: https://ffmpeg.org/ffmpeg.html
[obs-websocket]: https://obsproject.com/kb/remote-control-guide

### Output Configuration

The `outputs` field in [detocs-config.json](#detocs-configjson) is used to control how DETOCS makes data available for overlays.
Each object in this array represents an output of one of two types: File Output or WebSocket Output.

#### File Output

Example:
```json
{
  "type": "file",
  "path": "./my-overlays/",
  "templates": [
    "./templates/scoreboard.json.hbs",
    {
      "template": "./templates/commentary_new.json.hbs",
      "outputName": "commentary.json"
    },
  ]
}
```

### detocs-credentials.json

`detocs-credentials.json` is used to store credential for accessing various services.
These are kept in a separate file for security reasons: while there's no harm in sharing your configuration file with someone else, anyone with access to credentials in this file will be able

Example file:
```json
{
  "startggKey": "[...]",
  "challongeKey": "[...]",
  "twitterKey": "[...]",
  "twitterSecret": "[...]",
  "twitterToken": { ... },
  "googleKey": "[...]",
  "googleSecret": "[...]",
  "youtubeToken": "[...]"
}
```

| Property Name | Type | Description |
| --- | --- | --- |
| `startggKey` | `string` | start.gg API authentication token. See [start.gg](#start.gg). |
| `challongeKey` | `string` | Challonge API key. See [Challonge](#Challonge). |
| `twitterKey` | `string` | Twitter API key. See [Twitter](#Twitter). |
| `twitterSecret` | `string` | Twitter API secret. See [Twitter](#Twitter). |
| `twitterToken` | `Object` | Twitter authentication token. Generated automatically when signing in to an account. |
| `googleKey` | `string` | Google API key. See [YouTube](#YouTube). |
| `googleSecret` | `string` | Google API key. See [YouTube](#YouTube). |
| `youtubeToken` | `Object` | YouTube authentication token. Generated automatically when signing in to an account. Remove this field if you'd like to log in to a different account. |

### Game Database

Example file:
```json
{
  "id" string,
  "name" string,
  "shortNames" string[],
  "hashtags" string[],
  "additionalTags": string[],
  "serviceInfo" {
    ["serviceName" string]: {
      "id" string;
    } | undefined;
  }
}
```

| Property Name | Type | Description |
| --- | --- | --- |

If you'd like to see an example, you can check out [Lunar Phase's game database](https://github.com/lunar-phase/game-database).

### Player Database

### Templates

## User interface

Once DETOCS is running, you can access the user interface via your web browser by navigating to [localhost:8080](http://localhost:8080).
If something on your system is already making use of port 8080, you can change it to something else in your [detocs-config.json](#detocs-configjson) configuration file.

### Scoreboard Tab

![The DETOCS scoreboard tab](images/tab_scoreboard.png)

The scoreboard tab allows you to enter details for the current tournament match, for displaying in an in-game scoreboard.

#### Player fields

The Handle and Prefix fields are used to enter the player's name and sponsor.
Typing in the Handle field will automatically search the player database for matching players, which can then be selected from the dropdown.
Note that player details are stored in a database; you should favor selecting existing database entries from the dropdown over re-entering player details, as doing the latter will result in duplicate entries in the [player database](#player-database).
Entering a new name in the Handle field creates a new database entry, but if you would like to instead update the name for a player, you can edit the Handle field in the [additional fields](#additional-fields) section.

For a double-elimination tournament, the \[L\] checkbox can be used to mark which player is in the losers bracket during grand finals.

The Comment field can be used to add extra details about a player that are specific to the current match.
For example: if two players are playing the same character, the Comment field can be used to make a note of which player is using which color.

Lastly, each player has a number field for storing their current score in the set.

#### Additional fields

![The DETOCS scoreboard tab's additional fields section](images/tab_scoreboard_addl-fields.png)

Clicking the ellipsis will reveal a few extra fields.
The Handle field lets you edit the handle for a player.
The main distinction between this and the primary Handle field is that changing this field will edit the handle on an existing player entry rather than creating a new player entry.
The Alias field can be used to give a player an alternative handle without changing their main one, useful in scenarios where someone enters a tournament using a joke handle.
This field gets used automatically if a player changes their handle on start.gg, etc.
When using an alias, the primary Handle field changes to show both the player's handle and alias.
The Pronouns field lets you enter pronouns for a player, and the Twitter field lets you set a player's Twitter handle.
Note that you do not need to include the `@` when entering Twitter handles.

#### Match

The Match field represents what stage of the tournament the current set is for.

#### Game

The Game field represents which video game is currently being played.
Autocomplete options can be added here by configuring [a game database](#game-database).

#### Bracket Set

The Bracket Set field can be used to pre-populate fields in the scoreboard from a bracket service.
After loading tournament sets in [the Bracket tab][Bracket Tab], selecting one from this dropdown and pressing the Fill button will populate the scoreboard fields accordingly.

#### Controls

At the bottom of the tab are a few controls.
Reset Players will reset all player-related fields, Reset Scores will reset only the score for each player, Swap will swap data between player 1 and player 2 side, and the Update button saves changes made to fields.
Changes can also be saved by hitting the enter key in any field.

### Commentary Tab

![The DETOCS commentary tab](images/tab_commentary.png)

The commentary tab is similar to [the Scoreboard tab](#scoreboard-tab), but for commentators.
The fields here are the same as the scoreboard field, though the Handle, Prefix, and Twitter fields are shown by default.

#### Tournament and Event

Going by [start.gg's terminology][startgg-glossary], the Tournament field has the name of the overall competition and the Event field has the name of the current bracket or exhibition.

[startgg-glossary]: https://developer.start.gg/docs/glossary/

### Recording Tab

![The DETOCS recording tab](images/tab_recording.png)

The recording tab makes it easy to record the start and end times for matches, primarily to make it easy to cut and upload videos.
In order to use the functions in this tab, you will need to [configure the OBS Studio integration](#OBS-Studio) first.
Note that the controls in this tab will not work unless you have an active recording file in OBS.

The primary controls are the Start and Stop buttons, which set the start and end timestamps for a set.
When cutting individual videos for each set these will be the start and end of the video, and if uploading a single video for the event the start times will be used to compute timestamps for the video description.
Pressing the Start button again before pressing the stop button will update the start timestamp for the set.
This means you never need to worry about hitting Start too early, since you can just hit it again later.
Similarly, hitting the Stop button will mark the end of the current set, and hitting the Stop button again before starting another set will update that end timestamp.
So like with the Start button, you don't need to worry too much about hitting the Stop button too early.
When the Stop button is pressed, the current scoreboard information will be saved and associated with the set.
This is important to remember; you should make sure to hit Stop to end the current set before updating the names in the scoreboard for the next match.

Once you have recorded a timestamp, it can easily be adjusted as well.
The text field with the timestamp in it can be freely edited, and pressing enter in the field or pressing the Update button will update the timestamp and grab a new thumbnail.
Below the field are shortcut buttons for moving the timestamp forward or backwards by small amounts.
Note that these will also round the timestamp to the nearest second.

An important thing to note is how thumbnails are generated.
Generating a thumbnail for a given timestamp from the recording file can take a long time, especially if the recording file is very large or on a slow drive (e.g. an HDD instead of an SSD).
In order to speed this up, DETOCS is able to create thumbnails from saved replay buffers instead, and will save the replay buffer whenever the Start or Stop buttons are pressed.
In practice, this means that if you hit the Start button late and move the timestamp back a few seconds thumbnails will be generated quickly, but will take significantly longer once you move the timestamp past the range covered by the replay.

### Twitter Tab

![The DETOCS Twitter tab. "DETOCS correctly calculates tweet character usage, so even long URLs like this still consume a fixed number of characters."](images/tab_twitter.png)

The Twitter tab lets you post on social media, including images and video.
This tab cannot be used unless you first configure the [Twitter integration](#Twitter).
Once that has been done, you should see a Log In link that will take you to the Twitter sign in page.
Once you've logged in, you should see the name of the current account at the top of the tab, as well as a mode toggle to switch between Individual Tweets and Threads.

In threads mode, the Tweet button is replaced with with three button: One-off, Start Thread, and Continue Thread.
The Start Thread button will start a new tweet thread, and the Continue Thread button will add a tweet to the most recent thread.
The One-off button can be used to create a tweet outside of the current thread *without* starting a new one.
An example of typical usage would be to start a new thread for each bracket being streamed, and post clips and highlights as one-off tweets.

**Note:** If you tag someone in a tweet it is currently not possible to untag them from subsequent tweets in the thread, due to limitations in the basic tier for the Twitter API.

Below the mode toggle is a text box for entering the content of your tweet.
The counter below will accurately show you how many characters you have remaining until you hit the 280 character limit.

Next to the text area are controls for selecting media.
These will require [integration with OBS](#OBS-Studio) to be configured in order to use.
The Take Screenshot button will grab a screenshot of the currently active scene in OBS.
Once DETOCS has connected to OBS, the dropdown menu next to the Take Screenshot will be populated with a list of scenes from OBS.
Choosing one of these scenes will take a screenshot of that scene instead; this can be very useful for things like taking photos before going live.
The Select Media button will let you a [previously taken screenshot or rendered clip](#Clips-Tab).

### Clips Tab

![The DETOCS clips tab](images/tab_clips_video.png)

The Clips tab lets you save highlight videos and screenshots, mainly for use with [social media](#twitter-tab).
The functionality requires [integration with OBS](#OBS-Studio) to be configured in order to use, and video clips require OBS's replay buffer to be enabled.
The Take Screenshot button will grab a screenshot of the currently active scene in OBS.
Once DETOCS has connected to OBS, the dropdown menu next to the Take Screenshot will be populated with a list of scenes from OBS; choosing one of these scenes will take a screenshot of that scene instead.
The other buttons will create video clips of the length indicated.
Note that clips are always created with a length that matches the size of your replay buffer; the clip length simply controls how much of the full length is selected by default in the video editor.

Once a video clip has been created, you can can adjust the start and end times for the highlight using the controls below the preview.
An underlay of the clip's audio waveform is shown behind the controls, which makes it easy to adjust the star and end times so that they don't interrupt important audio (like commentary).
Pressing the Update button will save the current start/end timestamps and the description, and sync them to any other users connected to the DETOCS server.
Pressing Cut will render the video into a form that is suitable for uploading to social media.
Un-rendered videos cannot be used in tweets.

By default, rendered video clips are stored in a temporary directory.
If you would like to store them somewhere more permanent, you should set the `clipDirectory` property in your [configuration file](#detocs-configjson).

### Bracket Tab

![The DETOCS bracket tab](images/tab_bracket.png)

The Bracket tab lets you load data from online bracket services.
Many of the bracket services supported by DETOCS require API access to use; see [the Configuration section](#Configuration) for instructions on how to set this up.

Tournament URL field.
For start.gg brackets, instead of entering an entire URL you can instead enter the tournament slug by itself (this is the part that comes after `start.gg/tournament/`) or the short code for the tournament.
Once you've loaded a tournament, you'll then be able to narrow your selection to a specific game and then phase.
Once you've loaded some sets, these will be available for selection in the [Scoreboard tab](#Scoreboard-Tab).
DETOCS will update the set list every couple of minutes.

**Note:** DETOCS currently does not queue start.gg requests to account for their API rate limits, meaning that very large queries will result in errors (instead of being spread out over several minutes).
It should be able to handle major tournaments but probably not pools at super-majors, unless you have an API token with an increased rate limit.
See [this relevant roadmap item](https://github.com/data-enabler/detocs/projects/1#card-50089528).

### Break Tab

![The DETOCS break tab](images/tab_break.png)

The Break tab lets you set messages to display on break scenes.
Use the Add and Remove buttons to change the number of message fields available.

### Settings Tab

![The DETOCS settings tab](images/tab_settings.png)

This tab is currently just used to control a couple of client-side settings. These settings only apply in the current browser, so feel free to adjust them to your personal preference.

* **Reverse player order**/**Reverse commentator order**: Reverse the order of the player or commentator fields in the UI. Set this to whatever feels more intuitive.
* **Enable video thumbnails**: Causes video clips to play when you hover over the thumbnail. This has the potential to cause frame drops if you're viewing DETOCS on the same computer where OBS is running, so it's disabled by default.

### Tips

* You can zoom the UI in and out to whatever size you want! Just use `CTRL` `+` or `CTRL` `-` like any other web page. The default size is a little on the large side for accessibility reasons; personally I usually use DETOCS at 90% scale.

## API Control

DETOCS does not have an official API yet, but all of the changes and actions performed in the app UI are communicated via simple HTTP requests.
Using [browser developer tools][devtools], more technically inclined users can easily see what requests are being made and send those same requests using other tools such as the [Stream Deck Web Requests plugin][sd-webrequests].

Some sample requests that you might find useful:
- `POST http://localhost:58589/screenshots` takes a screenshot
- `POST http://localhost:58589/clip?seconds=15` creates a clip that that has the last 15 seconds pre-selected.

[devtools]: https://developer.chrome.com/docs/devtools/network/
[sd-webrequests]: https://apps.elgato.com/plugins/gg.datagram.web-requests

## Command-Line Interface

The default action when running the DETOCS application is to start the server, but there are additional commands that can be used via command-line for VOD upload, data import, and data export.

Run `detocs --help` or `detocs [command] --help` in your terminal for more info.

### `detocs vod`

The `detocs vod` command is used to upload match videos to video hosting sites (currently just YouTube), based on log files generated by DETOCS.
Before using this command, be sure to [configure your YouTube API access](#YouTube).
All subcommands require a log file, and will either generate a single video for the whole file (default), or generate separate videos for each set when used with the `--per-set` argument.
When generating per-set videos, you may also specify a specific set rather than the entire list by using the `--n` argument.

#### `detocs vod [log] metadata`

This is the default command, and will generate titles, descriptions, and tags for videos based on your [vod templates](#Templates).

#### `detocs vod [log] cut`

This command will generate metadata, then attempt to cut corresponding sections from your recording file based on the `start` and `end` timestamps in your log file.
DETOCS cuts vods on keyframes in order to avoid costly re-encoding; keyframes will either be calculated for the video, or assumed if you use [the `vodKeyframeIntervalSeconds` configuration option](#detocs-configjson).

#### `detocs vod [log] upload`

This command will generate metadata and cut videos, then attempt to upload them via YouTube's API.
Once the videos have been uploaded, the log file will be updated to contain the YouTube video IDs.
Please note that the default YouTube API quota limits you to 6 video uploads a day; if you need to upload more than this, check out the `update` command below.

#### `detocs vod [log] update`

This command will generate metadata, and then attempt to update already-uploaded videos via the YouTube API.
This command is also useful for when you have a large number of videos to upload; you can cut your videos with the `cut` command, upload the videos manually via YouTube Studio to save on API quota, and then use this command to apply the correct metadata.
