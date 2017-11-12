import { clearTimeout } from 'timers';

const fs = require('fs');
const readline = require('readline');
const util = require('util');

const parse = util.promisify(require('csv-parse'));
const config = require('config');
const _ = require('lodash');
const { spawnSync } = require('child_process');
const moment = require('moment');
const Lien = require('lien');
const google = require('googleapis');
const youtube = google.youtube('v3');
const opn = require('opn');
const prettyBytes = require('pretty-bytes');

const VIDEOS_PATH = `${__dirname}/videos`;
const FFMPEG_TIME_FORMAT = 'H:mm:ss';
const YEAR = config.has('year') ? config.get('year') : new Date().getFullYear();

const parseTime = time => moment(time, 'h[h]mm[m]ss[s]');

const parseUrl = url => url.replace(/&t=[0-9]h[0-9]{2}m[0-9]{2}s/, '');

const parseCsvTalk = talk => ({
  room: talk[0],
  title: talk[3],
  start: parseTime(talk[4]),
  end: parseTime(talk[7]),
  url: parseUrl(talk[10])
});

const isTalkValid = talk => {
  if (!talk.room || talk.room === '') return false;
  if (!talk.title || talk.title === '') return false;
  if (!talk.start || talk.start === '' || talk.start === '???') return false;
  if (!talk.end || talk.end === '' || talk.end === '???') return false;
  if (!talk.url || talk.url === '') return false;
  if (config.has('rooms') && !config.get('rooms').includes(talk.room))
    return false;

  return true;
};

const authenticate = async () => {
  const oauth = new google.auth.OAuth2(
    config.get('credentials').client_id,
    config.get('credentials').client_secret,
    config.get('credentials').redirect_uri
  );
  const server = new Lien({ host: 'localhost', port: 5000 });
  opn(
    oauth.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/youtube.upload']
    })
  );

  return new Promise((resolve, reject) => {
    server.addPage('/oauth2callback', lien => {
      console.log(`Trying to get the token using the code ${lien.query.code}`);
      oauth.getToken(lien.query.code, (err, tokens) => {
        console.log('Got the token :-)');
        oauth.setCredentials(tokens);
        lien.end();
        resolve(oauth);
      });
    });
  });
};

const mkdir = path => fs.existsSync(path) || fs.mkdirSync(path);

const splitRoom = async (talks, room) => {
  console.log(`Starting split of stream from ${room}...`);
  const url = talks[0].url;
  const path = `${VIDEOS_PATH}/${room}`;
  mkdir(path);
  const video = download(room, url, path);
  const conferences = talks.map(talk => extractConference(video, talk, path));
  for (let conference of conferences) {
    await uploadConference(conference);
  }
};

const download = (room, url, path) => {
  const video = `${path}/${room}.mp4`;
  if (config.has('download') && config.get('download')) {
    console.log(`Downloading ${url} to ${video}...`);
    spawnSync('youtube-dl', ['-f', 'best', url, '-o', video]);
  }

  return video;
};

const extractConference = (video, talk, path) => {
  const start = talk.start.format(FFMPEG_TIME_FORMAT);
  const duration = talk.end.diff(talk.start, 'seconds');
  const file = `${path}/${talk.title}.mp4`;
  if (config.has('split') && config.get('split')) {
    console.log(
      `Extracting ${talk.title} from ${start} for ${duration} seconds...`
    );
    spawnSync('ffmpeg', [
      '-ss',
      start,
      '-i',
      video,
      '-t',
      duration,
      '-c',
      'copy',
      `${file}`
    ]);
  }

  return { file, ...talk };
};

const generateMetadata = conference => {
  const title = `BDX I/O ${YEAR} - ${conference.title}`;
  const description = title;

  return {
    resource: {
      snippet: {
        title,
        description
      },
      status: {
        privacyStatus: 'private'
      }
    },
    part: 'snippet, status',
    media: { body: fs.createReadStream(`${conference.file}`) }
  };
};

const uploadConference = conference => {
  return new Promise((resolve, reject) => {
    if (config.has('upload') && config.get('upload')) {
      console.log(`Uploading ${conference.file}...`);
      const metadata = generateMetadata(conference);
      let timeout;
      const request = youtube.videos.insert(metadata, (err, data) => {
        timeout && clearTimeout(timeout);
        console.log('done');
        resolve();
      });

      timeout = setInterval(
        () =>
          console.log(
            `${prettyBytes(
              request.req.connection._bytesDispatched
            )} bytes uploaded.`
          ),
        250
      );
    }
  });
};

const main = async () => {
  try {
    const csvPath = `${__dirname}/Talks ${YEAR} - Vidéos.csv`;
    const file = fs.readFileSync(csvPath);
    const data = await parse(file);
    const talks = data.map(parseCsvTalk).filter(isTalkValid);

    if (config.has('upload') && config.get('upload')) {
      const oauth = await authenticate();
      google.options({ auth: oauth });
    }

    mkdir(VIDEOS_PATH);
    const talksByRoom = _.groupBy(talks, talk => talk.room);
    _.forEach(talksByRoom, splitRoom);

    console.log('All done folks :-)');
  } catch (err) {
    console.error(err);
  }
};

main();
