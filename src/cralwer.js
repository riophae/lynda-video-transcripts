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
      await openPage(url, '检查网络连接');
    } catch (err) {
      console.error('网络连接故障');
      return;
    }
    console.log('网络连接正常');
  }
}

function getLoginStatusFromCookie() {
  const loginStatusCookie = page.cookies.find((cookie) => cookie.name === 'LyndaLoginStatus');
  return !!loginStatusCookie && loginStatusCookie.value === ('Member-Logged-In');
}

async function ensureLoggedIn() {
  await openHomePage();

  const isLoggedIn = getLoginStatusFromCookie();
  console.log(`登录状态：${isLoggedIn ? '已登录' : '未登录'}`);

  if (isLoggedIn) {
    return;
  }

  try {
    const url = LYNDA_ORIGIN + '/signin';
    await openPage(url, '打开登录页面');
  } catch (err) {
    console.error('无法打开登录页面');
    throw err;
  }

  page.evaluate(`function () {
    document.getElementById('email-address').value = ${JSON.stringify(config.username)};
    document.getElementById('username-submit').click();
  }`);

  console.log('已提交用户名，等待响应');
  for (let tryTimes = 0; ;) {
    await sleep(2000);
    const passwordInputExists = page.evaluate(() => !!document.getElementById('password-submit')); // eslint-disable-line no-loop-func
    if (!passwordInputExists && ++tryTimes >= 10) {
      throw new Error('提交用户名后服务器没有及时响应');
    } else {
      break;
    }
  }

  page.evaluate(`function () {
    document.getElementById('password-input').value = ${JSON.stringify(config.password)};
    document.getElementById('remember-me').checked = true;
    document.getElementById('password-submit').click();
  }`);
  console.log('已提交密码，等待响应');

  for (let tryTimes = 0; tryTimes < 10; tryTimes++) {
    await sleep(2000);
    if (getLoginStatusFromCookie()) {
      console.log('登录成功！');
      return;
    }
  }

  throw new Error('登录失败');
}

async function openHomePage() {
  const url = LYNDA_ORIGIN + '/';
  await openPage(url, '打开首页');
  captureScreen(page, 'homepage');
}

async function openTutorialPage(url) {
  const startedAt = Date.now();
  await openPage(url, `打开课程页面 ${url}`);
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
    }).map((item, idx) => {
      item.index = idx + 1;
      return item;
    });
  });

  const fileName = padZero(videoInfo.tutorialNo + 1, 3) + '.srt';
  const content = transcriptData.reduce((arr, item, idx) => {
    const { index, start, text } = item;
    const nextItem = transcriptData[idx + 1];
    const end = nextItem ? nextItem.start : videoTotalLength;
    return arr.concat([
      index,
      `${formatTimestamp(start)} --> ${formatTimestamp(end)}`,
      text,
      '',
      '',
    ]);
  }, []).join(NEW_LINE).trim() + NEW_LINE;

  console.log('课程标题：', videoInfo.tutorialTitle);
  console.log('尝试写入文件…', '文件名：', fileName, '内容长度：', content.length);
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
      console.log(`等待 ${wait}ms…`);
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
