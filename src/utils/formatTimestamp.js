import toInt from './toInt';

function divide(x, y) {
  return [(x - x % y) / y, x % y];
}

export default function formatTimestamp(num, formatter) {
  const [sec, decimal = '00'] = (num + '').split('.').map(toInt);
  const [min, S] = divide(sec, 60);
  const [H, M] = divide(min, 60);
  const SS = decimal;
  return formatter({ H, M, S, SS });
}
