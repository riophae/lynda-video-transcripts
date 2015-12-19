import toInt from './toInt';
import padZero from './padZero';
import padRight from 'lodash/string/padRight';

function divide(a, b) {
  const x = toInt(a);
  const y = toInt(b);
  return [(x - x % y) / y, x % y];
}

export default function formatTimestamp(num) {
  const [sec, decimal = '00'] = (num + '').split('.');
  const [min, S] = divide(sec, 60);
  const [H, M] = divide(min, 60);
  return `${padZero(H, 2)}:${padZero(M, 2)}:${padZero(S, 2)},${padRight(toInt(decimal), 3, '0')}`;
}
