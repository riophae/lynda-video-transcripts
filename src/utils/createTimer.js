import Stopwatch from 'timer-stopwatch';

export default function createTimer(msgPrefix) {
  const timer = new Stopwatch();
  console.log(`${msgPrefix}……`);
  timer.start();

  return {
    stop() {
      console.log(`${msgPrefix} 用时：${timer.ms}ms`);

      timer.stop();
    },
  };
}
