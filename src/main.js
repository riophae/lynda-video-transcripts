/* global phantom */
/* eslint-disable no-use-before-define */

require('./utils/polyfill');

import fs from 'fs';

import moment from 'moment';

import config from '../config.yaml';

import createTimer from './utils/createTimer';
import captureScreen from './utils/captureScreen';
import toInt from './utils/toInt';
import padZero from './utils/padZero';
import formatTimestamp from './utils/formatTimestamp';
import sleep from './utils/sleep';
import loop from './utils/loop';

const origin = 'http://www.lynda.com';
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

function captureScreenEverySecond() {
  setInterval(() => {
    if (page) {
      captureScreen(page, moment().format('HH-mm-ss'));
    }
  }, 1000);
}

function detectNetworkCondition() {
  if (config.detectNetworkCondition !== 'yes') {
    return Promise.resolve();
  }

  const timer = createTimer('检查网络连接');
  const url = 'https://www.baidu.com';

  return new Promise((res, rej) => {
    resetPage().open(url, (status) => {
      timer.stop();
      console.log('网络连接状态：', status);

      if (status === 'success') {
        res();
      } else {
        rej();
      }
    });
  });
}

function getLoginStatusFromCookie() {
  let isLoggedIn = false;
  const loginStatusCookie = page.cookies.find((cookie) => cookie.name === 'LyndaLoginStatus');
  if (loginStatusCookie && loginStatusCookie.value.indexOf('Not-Logged-In') === -1) {
    isLoggedIn = true;
  }
  return isLoggedIn;
}

async function ensureLoggedIn() {
  const timer = createTimer('检查登录状态');
  const url = origin + '/login/login.aspx';

  return new Promise((resolve, reject) => {
    resetPage().open(url, (status) => {
      timer.stop();
      console.log('打开登录检查页面：', status);
      if (status !== 'success') {
        console.error('检查登录状态失败：无法成功打开页面');
        reject();
      } else {
        const isLoggedIn = getLoginStatusFromCookie();
        console.log('登录状态：', isLoggedIn);
        if (isLoggedIn) {
          resolve();
        } else {
          page.evaluate(() => {
            document.getElementById('usernameInput').value = 'etchingubvf@gmail.com';
            document.getElementById('passwordInput').value = '907p9p098';
            document.getElementById('lnk_login').click();
          });

          loop(10, () => new Promise(async (res, rej) => {
            if (getLoginStatusFromCookie()) {
              console.log('从 cookie 判断，登录操作已生效');

              if (page.url === 'http://www.lynda.com/member') {
                console.log('跳转到了用户页面，认为已登录成功');
                res();
                return;
              }

              const btnFound = page.evaluate(() => {
                const doc = window.frames.length
                  ? frames['fancybox-frame'].contentDocument
                  : document
                ;
                const ensureBtn = doc.getElementById('conflicedOk');
                if (ensureBtn) {
                  ensureBtn.click();
                  return true;
                }
                return false;
              });

              if (btnFound) {
                const delay = 5000;
                console.log('找到了确认登录按钮，退登其他已登录设备');
                console.log(`等待 ${delay}ms…`);
                await sleep(delay);
                res();
                return;
              }
              console.log('未找到确认登录按钮');
              console.log('当前页面：', page.url);
            } else {
              console.log('从 cookie 判断，登录操作还未生效');
            }

            await sleep(1000);
            rej();
          })).then(resolve, reject);
        }
      }
    });
  });
}

function openHomePage() {
  const timer = createTimer('打开首页');
  const url = origin + '/';

  return new Promise((resolve, reject) => {
    resetPage().open(url, (status) => {
      timer.stop();
      console.log('打开首页：', status);

      if (status !== 'success') {
        reject();
      } else {
        captureScreen(page, 'homepage');
        resolve();
      }
    });
  });
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

          console.log('LYNDA_CRAWLER', '是否进入了旧界面：', isOldInterface);

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
  captureScreenEverySecond();

  const workers = [
    detectNetworkCondition,
    ensureLoggedIn,
    openHomePage,
    () => openTutorialPage(config.startPoint),
    final,
  ];

  for (const worker of workers) {
    console.log('');
    await worker();
  }
}

init();
