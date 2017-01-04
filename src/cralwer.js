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
import loop from './utils/loop';

const origin = 'https://www.lynda.com';
const NEW_LINE = '\r\n';

let page;

function resetPage() {
  page = require('webpage').create();

  Object.assign(page, {
    viewportSize: config.viewportSize,
    onConsoleMessage(msg) {
      if (!msg || !msg.indexOf) {
        return;
      }

      if (msg.indexOf('LYNDA_CRAWLER') === 0) {
        console.log(msg.replace('LYNDA_CRAWLER ', ''));
      }
    },
  });
  Object.assign(page.settings, {
    userAgent: config.userAgent,
  });

  return page;
}

function openPage(url, actionName) {
  page = require('webpage').create();
  page.viewportSize = config.viewportSize;
  page.onConsoleMessage = (msg) => {
    const CONSOLE_MSG_PREFIX = 'LYNDA_CRAWLER';
    if (msg && msg.indexOf && msg.startsWith(CONSOLE_MSG_PREFIX)) {
      console.log(msg.replace(CONSOLE_MSG_PREFIX + ' ', ''));
    }
  };
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
    console.log('网络状态正常');
  }
}

function getLoginStatusFromCookie() {
  const loginStatusCookie = page.cookies.find((cookie) => cookie.name === 'LyndaLoginStatus');
  return !!loginStatusCookie && loginStatusCookie.value.indexOf('Not-Logged-In') === -1;
}

async function ensureLoggedIn() {
  await openHomePage();

  const isLoggedIn = getLoginStatusFromCookie();
  console.log('登录状态：', isLoggedIn);

  if (isLoggedIn) {
    return;
  }

  try {
    const url = origin + '/signin';
    await openPage(url, '打开登录页面');
  } catch (err) {
    console.error('无法打开登录页面');
    throw err;
  }

  page.evaluate(`function () {
    document.getElementById('email-address').value = ${JSON.stringify(config.username)};
    document.getElementById('username-submit').click();
  }`);

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
    document.getElementById('password-submit').click();
  }`);

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
  const url = origin + '/';
  await openPage(url, '打开首页');
  captureScreen(page, 'homepage');
}

function openTutorialPage(url) {
  const timer = createTimer('打开课程页面');
  console.log('课程页面地址：', url);

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    resetPage().open(url, (status) => {
      timer.stop();
      console.log('打开课程页面：', status);
      if (status !== 'success') {
        reject();
      } else {
        captureScreen(page, 'tutorial');

        const videoInfo = page.evaluate(() => {
          const indexOf = Array.prototype.indexOf;
          const $ = ::document.querySelector;
          const $find = Element.prototype.querySelector;
          const $findAll = Element.prototype.querySelectorAll;

          const isOldInterface = !!$('#course-toc-outer');

          // 若使用 `console.log()` 的话，命令行中看不到相关日志
          console.error('是否进入了旧界面：', isOldInterface);

          if (isOldInterface) {
            const container = $('#course-toc-outer');
            const videoItems = container::$findAll('.video-cta');
            const currentVideo = container::$find('.now .video-cta');
            const tutorialTitle = currentVideo.getAttribute('data-video-title');

            const tutorialNo = videoItems::indexOf(currentVideo);
            const videoDuration = currentVideo.getAttribute('data-video-duration');

            return { tutorialNo, tutorialTitle, videoDuration };
          }

          const container = $('#toc-content');
          const videoItems = container::$findAll('.video-name-cont .video-name[role="listitem"]');
          const currentVideo = container::$find('.toc-video-item.current .video-name-cont .video-name[role="listitem"]');
          const tutorialTitle = currentVideo.textContent;

          const tutorialNo = videoItems::indexOf(currentVideo);
          const videoDuration = container::$find('.toc-video-item.current .video-name-cont .video-duration').textContent;

          return { tutorialNo, tutorialTitle, videoDuration };
        });
        const [, m, s] = videoInfo.videoDuration.trim().match(/^(\d+)m\s+(\d+)s$/);
        const videoTotalLength = toInt(m) * 60 + toInt(s);

        const transcriptData = page.evaluate(() => {
          const $ = ::document.querySelector;
          const $$ = ::document.querySelectorAll;

          const isOldInterface = !!$('#course-toc-outer');
          const transcripts = isOldInterface
            ? $$('#tab-transcript .video-transcript span.transcript')
            : $$('.toc-video-item.current .transcript')
          ;

          return [].map.call(transcripts, (item) => ({
            start: parseFloat(item.getAttribute('data-duration')),
            text: item.textContent.replace(/^-\s+/, '').trim(),
          })).sort((a, b) => {
            return a.start - b.start > 0;
          }).map((item, idx) => {
            item.index = idx + 1;
            return item;
          });
        });

        const fileName = padZero(videoInfo.tutorialNo + 1, 3) + '.srt';
        const content = transcriptData.reduce((accum, item, idx) => {
          const { index, start, text } = item;
          const nextItem = transcriptData[idx + 1];
          const end = nextItem ? nextItem.start : videoTotalLength;
          const arr = [];
          arr.push(
            index,
            `${formatTimestamp(start)} --> ${formatTimestamp(end)}`,
            text,
            '',
            ''
          );
          return accum.concat(arr);
        }, []).join(NEW_LINE).trim() + NEW_LINE;

        console.log('课程标题：', videoInfo.tutorialTitle);
        console.log('尝试写入文件…', fileName, content.length);
        fs.write('output/' + fileName, content);

        const nextTutorialUrl = page.evaluate(() => {
          const indexOf = Array.prototype.indexOf;
          const $ = ::document.querySelector;
          const $find = Element.prototype.querySelector;
          const $findAll = Element.prototype.querySelectorAll;

          const isOldInterface = !!$('#course-toc-outer');

          const container = isOldInterface
            ? $('#course-toc-outer')
            : $('#toc-content')
          ;
          const videoItems = isOldInterface
            ? container::$findAll('.video-cta')
            : container::$findAll('.video-name-cont .video-name[role="listitem"]')
          ;
          const currentVideo = isOldInterface
            ? container::$find('.now .video-cta')
            : container::$find('.toc-video-item.current .video-name-cont .video-name[role="listitem"]')
          ;

          const idx = videoItems::indexOf(currentVideo);
          const nextVideo = videoItems[idx + 1];
          return nextVideo && nextVideo.href;
        });

        if (nextTutorialUrl) {
          const endedAt = Date.now();
          const duration = endedAt - startedAt;
          const wait = Math.max(0, config.intervalBetweenTutorialVisits * 1000 - duration);

          if (wait) console.log(`等待 ${wait}ms…`);
          console.log('');
          resolve(sleep(wait).then(() => openTutorialPage(nextTutorialUrl)));
        } else {
          resolve();
        }
      }
    });
  });
}

function final() {
  phantom.exit();
}

async function init() {
  if (config.captureScreenAutomatically === 'yes') {
    captureScreenEverySecond();
  }

  const workers = [
    detectNetworkCondition,
    ensureLoggedIn,
    openHomePage,
    // () => openTutorialPage(config.startPoint),
    final,
  ];

  for (const worker of workers) {
    console.log('');
    await worker();
  }
}

init();
