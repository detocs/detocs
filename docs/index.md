# DETOCS Usage Guide

## Setup/Installation

### obs-websocket

### Twitter

In order to use DETOCS's Twitter features, you'll need to [create a Twitter developer app][twitter-api].
Once you've created your API app, add its API key and API secret to your [`decocs-credentials.json`](#detocscredentialsjson) file.

[twitter-api]: https://developer.twitter.com/en/docs/twitter-api/getting-started/getting-access-to-the-twitter-api

## YouTube

In order to use DETOCS's automated VOD upload features, you'll need to [create a Google API app][google-api].
Once you've created your API app, add its API key and API secret to your [`decocs-credentials.json`](#detocscredentialsjson) file.
Note that by default, Google API apps are limited to 6 video uploads a day, unless you [request a quota increase][youtube-quota].

[google-api]: https://developers.google.com/youtube/v3/getting-started
[youtube-quota]: https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits

### detocs-config.json

```
{
  clipDirectory: string;
  credentialsFile?: string;
  databaseDirectory: string;
  ffmpeg: { transcodeVideoInputArgs: string[]; transcodeVideoOutputArgs: string[]; };
  gameDatabaseFile?: string;
  logDirectory: string | null;
  obs: { address: string; password?: string; binPath?: string; };
  outputs: (WebSocketOutputConfig | FileOutputConfig)[];
  peopleDatabaseFile: string;
  ports: { web: number; };
  tempFileExpirationDays: number;
  vodKeyframeIntervalSeconds?: number;
  vodPerSetTemplate: string;
  vodSingleVideoTemplate: string;
}
```

| Config Property | Type | Description |
| --- | --- | --- |
| `clipDirectory` | `string` | Temporary folder | The directory in which to store rendered [video clips](#clipstab). Defaults to a temporary folder. |
| `credentialsFile` | `string` | File from which to load [credentials](#detocs-credentialsjson). By default, DETOCS will search parent directories for the nearest `detocs-credentials.json` file. |

### detocs-credentials.json

### Game Database

### Player Database

## User interface

### Scoreboard Tab

![The DETOCS scoreboard tab](images/tab_scoreboard.png)

#### Player fields

The scoreboard tab allows you to enter details for the current tournament match.
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
The Alias field can be used to give a player an alternative handle without changing their main one, useful in scenarios where someone enters a tournament using a joke handle.
When using an alias, the primary Handle field changes to show both the player's handle and alias; however, there is an separate Handle field here that can be used to update only the player's handle.

#### Match

The Match field represents what stage of the tournament the current set is for.
The Game field represents which video game is currently being played. Autocomplete options can be added here by configuring [a game database][#game-database].

#### Set

The Bracket Set field can be used to pre-populate fields in the scoreboard from a bracket service.
After loading bracket sets in [the Bracket tab][Bracket Tab], selecting one from this dropdown and pressing the Fill button will populate fields.

#### Controls

At the bottom of the tab are a few controls.
Reset Players will reset all player-related fields, Reset Scores will reset only the score for each player, Swap will swap data between player 1 and player 2 side, and the Update button saves changes made to fields.
Changes can also be saved by hitting the enter key in any field.

### Commentary Tab

![The DETOCS commentary tab](images/tab_commentary.png)

The commentary tab is similar to [the Scoreboard tab](#scoreboard-tab), but for commentators.
The fields here are the same as the scoreboard field, though the Handle, Prefix, and Twitter fields are shown by default.

### Recording Tab

![The DETOCS recording tab](images/tab_recording.png)

The recording tab makes it easy to record the start and end times for matches, primarily to make it easy to cut and upload videos.
In order to use the functions in this tab, you will need to configure [obs-websocket](#obs-websocket) first.
Note that the controls in this tab will not work unless you have an active recording file in OBS.

The primary controls are the Start and Stop buttons, which set the start and end timestamps for a set.
When cutting individual videos for each set these will be the start and of the video, and if uploading a single video for the tournament the start times will be used to compute timestamps for the video description.
Pressing the Start button again before pressing the stop button will update the start timestamp for the set.
This means you never need to worry about hitting Start too early, since you can just hit it again later.
Similarly, hitting the Stop button till mark the end of the current set, and hitting the Stop button again before starting another set will update that end timestamp.
So like with the Start button, you don't need to worry too much about hitting the button too early.
When the Stop button is pressed, the current scoreboard information will be saved and associated with the set.
This is important to remember; you should make sure to hit Stop to end the current set before updating the names in the scoreboard for the next match.

Once you have recorded a timestamp, it can easily be adjusted as well.
The text field with the timestamp in it can be freely edited, and pressing enter in the field or pressing the Update button will update the timestamp and grab a new thumbnail.
Below the field are shortcut buttons for moving the timestamp forward or backwards by small amounts.
Note that these will also round the timestamp to the nearest second.

An important thing to note is how thumbnails are generated.
Generating a thumbnail for a given timestamp from the recording file can take a long time, especially if the recording file is very large or on a slow drive (e.g. an HDD instead of an SSD).
In order to speed this up, DETOCS is able to load create thumbnails from saved replay buffers instead, and will save the replay buffer whenever the Start or Stop buttons are pressed.
In practice, this means that if you hit the Start button late and move the timestamp back a few seconds thumbnails will be generated quickly, but will take significantly longer once you move the timestamp past the range covered by the replay.

### Twitter Tab

![The DETOCS Twitter tab](images/tab_twitter.png)

### Clips Tab

![The DETOCS clips tab](images/tab_clips_video.png)

The Clips tab lets you save highlight videos and screenshots, mainly for use with [social media](#twitter-tab).
Video clips require OBS's replay buffer to be enabled.
Pressing the Screenshot button will take a full-size screenshot of the currently active scene in OBS.
The other buttons will create video clips of the length indicated.
Note that clips are always created with a length that matches the size of your replay buffer; the clip length simply controls how much of the full length is selected by default in the video editor.

Once a video clip has been created, you can can adjust the start and end times for the highlight using the controls below the preview.
An underlay of the clip's audio waveform is shown behind the controls, which makes it easy to adjust the star and end times so that they don't interrupt important audio (like commentators talking).j
Pressing the Update button will save the current start/end timestamps and the description, and sync them to any other users connected to the DETOCS server.
Pressing Cut will render the video into a form that is suitable for uploading to social media.
Un-rendered videos cannot be used in tweets.


By default, rendered video clips are stored in a temporary directory.
If you would like to store them somewhere more permanent, you should set the `clipDirectory` property in your [configuration file](#detocs-configjson).

### Bracket Tab

![The DETOCS bracket tab](images/tab_bracket.png)

**Note:** DETOCS currently does not queue smash.gg requests to account for their API rate limits, meaning that very large queries will result in errors (instead of being spread out over several minutes).
It should be able to handle major tournaments, but probably not super-majors.
See [this relevant roadmap item](https://github.com/data-enabler/detocs/projects/1#card-50089528).

### Break Tab

Set messages to display on break scenes

### Settings Tab

This tab is currently just used to control a couple of client-side settings.
Reverse the order of the player or commentator fields to whatever feels more natural.

## API Control

DETOCS does not have an official API yet, but all of the changes and actions performed in the app UI are communicated via simple HTTP requests.
Using [browser developer tools][devtools], more technically inclined users can easily see what requests are being made and send those same requests using other tools such as the [Stream Deck Web Requests plugin][sd-webrequests].

Some sample requests that you might find useful:
- `POST http://localhost:58589/screenshots` takes a screenshot
- `POST http://localhost:58589/clip?seconds=15` creates a clip that that has the last 15 seconds selected.

[devtools]: https://developer.chrome.com/docs/devtools/network/
[sd-webrequests]: https://apps.elgato.com/plugins/gg.datagram.web-requests

## Command Line

### `vod`

### VOD Upload

![DETOCS VOD upload command line output](images/vod_metadata.png)
