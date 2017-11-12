# BDX I/O Stream Split

> CLI to split [BDX I/O](https://www.bdx.io) conferences streams into single videos and upload them to [BDX I/O YouTube channel](https://www.youtube.com/channel/UCA7pEYY0BlgCdpbnjhCDezQ)

## Install

First you'll need two runtime requirements :

    - [youtube-dl](), used to download conferences streams
    - [ffpmeg] v3.4+, used to split streams

Then you can install dependencies using `yarn` or `npm install`.

## Usage

To upload videos you'll need to retrieve `client_id` and `client_secret` of the application to authorize access to the BDX I/O YouTube account.  
Go to the [Google developers console](https://console.developers.google.com/), select the application `bdxio-stream-split` and select `Identifiants`.  
Then select `Node.js` as OAuth 2.0 client and copy/paste the `client_id` and `client_secret` into `config/default.json`.

The second step is to export the CSV file containing all the talks informations :
  
  1. Go to the Google Drive account and open the spreadsheet `Talks`
  2. Export the tab named `Vidéos`
  3. Paste the CSV file at the root of the projet, it should be named `Talks <ANNEE>.csv`

Check that the sheet contains :

  - room in column `A`
  - title in column `D`
  - start and end offsets in columns `E` and `H`
  - video url in column `K`

_invalid rows will be filtered out_

You can now run `NODE_ENV=production yarn start` to start the processing.  
Upon start the application should ask for access to the Google account, make sure that you select the account for BDX I/O, not your own Google account.

Once all the videos have been imported you just have to :

  - add license for all videos
  - add all videos to a specific playlist
  - make them public _(they are private by default in case something go wrong)_

## Contribute

PRs accepted.

## License

See [LICENSE](./LICENSE)
