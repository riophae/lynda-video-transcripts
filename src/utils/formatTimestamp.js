import toInt from './toInt';

function divide(a, b) {
  const x = toInt(a);
  const y = toInt(b);
  return [(x - x % y) / y, x % y];
}

export default function formatTimestamp(num, formatter) {
  const [sec, decimal = '00'] = (num + '').split('.');
  const [min, S] = divide(sec, 60);
  const [H, M] = divide(min, 60);
  const SS = toInt(decimal) * 10;
  return formatter({ H, M, S, SS });
}
