import padLeft from 'lodash/string/padLeft';

export default function padZero(str, len) {
  return padLeft(str, len, '0');
}
