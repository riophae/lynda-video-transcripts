export default function loop(times, fn) {
  return new Promise((res, rej) => {
    if (times > 0) {
      fn().then(res, () => {
        res(loop(times - 1, fn));
      });
    } else {
      rej();
    }
  });
}
