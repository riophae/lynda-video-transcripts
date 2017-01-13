/* global phantom */
/* eslint-disable no-use-before-define */

import fs from 'fs';

import moment from 'moment';

import config from '../config.yaml';

import Deferred from './utils/deferred';
import createTimer from './utils/createTimer';
import captureScreen from './utils/captureScreen';
import toInt from './utils/toInt';
import padZero from './utils/padZero';
import formatTimestamp from './utils/formatTimestamp';
import sleep from './utils/sleep';

const LYNDA_ORIGIN = 'https://www.lynda.com';
const OUTPUT_DIR = 'output';
const NEW_LINE = '\r\n';

let page;

function openPage(url, actionName) {
  page = require('webpage').create();
  page.viewportSize = config.viewportSize;
  page.settings.userAgent = config.userAgent;

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

async function openTutorialPage(url) {
  const startedAt = Date.now();
  console.log(moment().format());

  await openPage(url, `Open tutorial page ${url}`);
  captureScreen(page, 'tutorial');

  const videoInfo = page.evaluate(() => {
    const container = document.querySelector('#toc-content');
    const videoItems = container.querySelectorAll('.video-name-cont .video-name[role="listitem"]');
    const currentVideo = container.querySelector('.toc-video-item.current .video-name-cont .video-name[role="listitem"]');

    return {
      tutorialNo: videoItems::([].indexOf)(currentVideo),
      tutorialTitle: currentVideo.textContent.trim(),
      videoDuration: container.querySelector('.toc-video-item.current .video-name-cont .video-duration').textContent.trim(),
    };
  });
  const [, m, s] = videoInfo.videoDuration.match(/^(\d+)m\s+(\d+)s$/);
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

  const fileName = padZero(videoInfo.tutorialNo + 1, 3) + '.srt';
  const content = transcriptData.reduce((arr, item, idx) => {
    const { start, text } = item;
    const nextItem = transcriptData[idx + 1];
    const end = nextItem ? nextItem.start : videoTotalLength;
    return arr.concat([
      idx + 1,
      `${formatTimestamp(start)} --> ${formatTimestamp(end)}`,
      text,
      '',
    ]);
  }, []).join(NEW_LINE).trim() + NEW_LINE;

  console.log('Tutorial title:', videoInfo.tutorialTitle);
  console.log('Attempting to write file:', fileName, '/', 'Content length:', content.length);
  fs.write(OUTPUT_DIR + '/' + fileName, content);

  const nextTutorialUrl = page.evaluate(() => {
    const container = document.querySelector('#toc-content');
    const videoItems = container.querySelectorAll('.video-name-cont .video-name[role="listitem"]');
    const currentVideo = container.querySelector('.toc-video-item.current .video-name-cont .video-name[role="listitem"]');

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
      await(sleep(wait));
    }
    console.log('');
    await openTutorialPage(nextTutorialUrl);
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
    () => openTutorialPage(config.startPoint),
    final,
  ];

  for (const task of tasks) {
    console.log('');
    await task();
  }
}

init();
