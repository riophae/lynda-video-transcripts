/* global phantom */
/* eslint-disable no-use-before-define */

import fs from 'fs';

import moment from 'moment';
import sanitizeFilename from 'sanitize-filename';

import config from '../config.yaml';
import generate from './formats/ass';

import Deferred from './utils/deferred';
import createTimer from './utils/createTimer';
import captureScreen from './utils/captureScreen';
import toInt from './utils/toInt';
import padZero from './utils/padZero';
import sleep from './utils/sleep';

const LYNDA_ORIGIN = 'https://www.lynda.com';
const OUTPUT_DIR = 'output';

let page;

function openPage(url, actionName) {
  page = require('webpage').create();
  page.viewportSize = config.viewportSize;
  page.settings.userAgent = config.userAgent;
  page.onError = function noop() {};

  const timer = createTimer(actionName);
  const deferred = new Deferred();
  page.open(url, (status) => {
    timer.stop();
    if (status === 'success') {
      deferred.resolve();
    } else {
      deferred.reject();
    }
  });

  return deferred.promise;
}

function captureScreenEverySecond() {
  setInterval(() => {
    if (page) captureScreen(page, moment().format('HH-mm-ss'));
  }, 1000);
}

async function detectNetworkCondition() {
  if (config.detectNetworkCondition === 'yes') {
    const url = 'https://www.baidu.com';
    try {
      await openPage(url, 'Test network connection');
    } catch (err) {
      console.error('Failed to connect network.');
      return;
    }
    console.log('Network connection is okay.');
  }
}

function getLoginStatusFromCookie() {
  const loginStatusCookie = page.cookies.find((cookie) => cookie.name === 'LyndaLoginStatus');
  return !!loginStatusCookie && loginStatusCookie.value === ('Member-Logged-In');
}

async function ensureLoggedIn() {
  await openHomePage();

  const isLoggedIn = getLoginStatusFromCookie();
  console.log(`Login status：${isLoggedIn ? 'Logged-in' : 'Not logged-in'}`);

  if (isLoggedIn) {
    return;
  }

  try {
    const url = LYNDA_ORIGIN + '/signin';
    await openPage(url, 'Open login-in page');
  } catch (err) {
    console.error('Failed to open login-in page');
    throw err;
  }

  page.evaluate(`function () {
    document.getElementById('email-address').value = ${JSON.stringify(config.username)};
    document.getElementById('username-submit').click();
  }`);

  console.log('Username submitted, waiting for response...');
  for (let tryTimes = 0; ;) {
    await sleep(2000);
    const passwordInputExists = page.evaluate(() => !!document.getElementById('password-submit')); // eslint-disable-line no-loop-func
    if (!passwordInputExists && ++tryTimes >= 10) {
      throw new Error('Response timeout.');
    } else {
      break;
    }
  }

  page.evaluate(`function () {
    document.getElementById('password-input').value = ${JSON.stringify(config.password)};
    document.getElementById('remember-me').checked = true;
    document.getElementById('password-submit').click();
  }`);
  console.log('Password submitted, waiting for response...');

  for (let tryTimes = 0; tryTimes < 10; tryTimes++) {
    await sleep(2000);
    if (getLoginStatusFromCookie()) {
      console.log('Login success！');
      return;
    }
  }

  throw new Error('Login failure');
}

async function openHomePage() {
  const url = LYNDA_ORIGIN + '/';
  await openPage(url, 'Open homepage');
  captureScreen(page, 'homepage');
}

async function fetchCoursesTranscripts() {
  let dirName;
  let startPoint;
  for (let i = 0; i < config.courses.length; i++) {
    if (i !== 0) console.log('');
    if (typeof config.courses[i] === 'string') {
      dirName = '';
      startPoint = config.courses[i];
    } else {
      dirName = config.courses[i].dirName;
      startPoint = config.courses[i].startPoint;
    }
    await openTutorialPage(i, dirName, startPoint);
  }
}

async function openTutorialPage(courseIndex, dirName, url) {
  const startedAt = Date.now();
  console.log(moment().format());

  let retry;
  do {
    retry = false;
    const t = Date.now();
    try {
      await openPage(url, `Open tutorial page ${url}`);
      captureScreen(page, 'tutorial');
      const looksGood = page.evaluate(() => ( // eslint-disable-line no-loop-func
        !!document.getElementById('course-page') &&
        !!document.querySelector('h1.default-title') &&
        !!document.getElementById('cover-wrapper')
      ));
      if (!looksGood) retry = true;
    } catch (err) {
      if (Date.now() - t < 250) retry = true;
    }
    if (retry) await sleep(2000);
  } while (retry);

  const videoInfo = page.evaluate(() => {
    const defaultTitle = document.querySelector('h1.default-title');
    const container = document.querySelector('#toc-content');
    const videoItems = container.querySelectorAll('.video-name-cont .video-name');
    const currentVideo = container.querySelector('.toc-video-item.current .video-name-cont .video-name');

    return {
      courseTitle: defaultTitle.getAttribute('data-course').trim(),
      tutorialNo: videoItems::([].indexOf)(currentVideo),
      tutorialTitle: currentVideo.textContent.trim(),
      videoDuration: container.querySelector('.toc-video-item.current .video-name-cont .video-duration').textContent.trim(),
    };
  });

  if (!videoInfo) {
    return openTutorialPage(...arguments);
  }

  const { courseTitle, tutorialTitle } = videoInfo;
  const [, m = 0, s = 0] = videoInfo.videoDuration.match(/^(?:(\d+)m\s*)?(?:(\d+)s)?$/);
  const videoTotalLength = toInt(m) * 60 + toInt(s);

  const transcriptData = page.evaluate(() => {
    const transcripts = document.querySelectorAll('.toc-video-item.current .transcript');

    return transcripts::([].map)((item) => ({
      start: parseFloat(item.getAttribute('data-duration')),
      text: item.textContent.replace(/^-\s+/, '').trim(),
    })).sort((a, b) => {
      return a.start - b.start;
    });
  });

  const { content, ext } = generate({ courseTitle, tutorialTitle, transcriptData, videoTotalLength });
  const fileName = padZero(videoInfo.tutorialNo + 1, 3) + ext;

  console.log('Course title:', courseTitle);
  console.log('Tutorial title:', tutorialTitle);
  console.log('Attempting to write file:', fileName, '/', 'Content length:', content.length);
  const outputDir = OUTPUT_DIR + '/' + (dirName || sanitizeFilename(courseTitle));
  const filePath = outputDir + '/' + sanitizeFilename(fileName);
  if (!fs.exists(outputDir)) fs.makeDirectory(outputDir);
  fs.write(filePath, content);

  const nextTutorialUrl = page.evaluate(() => {
    const container = document.querySelector('#toc-content');
    const videoItems = container.querySelectorAll('.video-name-cont .video-name');
    const currentVideo = container.querySelector('.toc-video-item.current .video-name-cont .video-name');

    const idx = videoItems::([].indexOf)(currentVideo);
    const nextVideo = videoItems[idx + 1];
    return nextVideo && nextVideo.href;
  });

  if (nextTutorialUrl) {
    const endedAt = Date.now();
    const duration = endedAt - startedAt;
    const wait = config.intervalBetweenTutorialVisits * 1000 - duration;

    if (wait > 0) {
      console.log(`Sleep ${wait}ms…`);
      await sleep(wait);
    }
    console.log('');
    return openTutorialPage(courseIndex, dirName, nextTutorialUrl);
  }
}

function final() {
  phantom.exit();
}

async function init() {
  if (config.captureScreenAutomatically === 'yes') {
    captureScreenEverySecond();
  }

  const tasks = [
    detectNetworkCondition,
    ensureLoggedIn,
    openHomePage,
    fetchCoursesTranscripts,
    final,
  ];

  for (const task of tasks) {
    console.log('');
    await task();
  }
}

init();
