import Stopwatch from 'timer-stopwatch';

export default function createTimer(msgPrefix) {
  const timer = new Stopwatch();
  console.log(`Start: ${msgPrefix}`);
  timer.start();

  return {
    stop() {
      console.log(`Completed in ${timer.ms}ms: ${msgPrefix}`);
      timer.stop();
    },
  };
}
