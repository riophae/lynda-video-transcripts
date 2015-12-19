/* eslint-disable no-unused-vars */

function testLoop() {
  const loop = require('./utils/loop');

  let i = 0;
  loop(10, () => new Promise((res, rej) => {
    console.log(i);
    if (i++ < 5) {
      setTimeout(rej, 1000);
    } else {
      res();
    }
  }));
}
// testLoop();

function testFormatTimestamp() {
  const format = require('./utils/formatTimestamp').default;

  console.log(format('10.05'));
  console.log(format('78.09'));
}
// testFormatTimestamp();
