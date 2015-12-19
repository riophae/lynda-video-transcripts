const distDir = 'screenshots';
let id = 0;

function padZero(num) {
  let str = num + '';
  while (str.length < 3) {
    str = '0' + str;
  }
  return str;
}

export default function captureScreen(page, name) {
  const fileName = `${distDir}/${padZero(id)}${name ? '-' + name : ''}.png`;
  // console.log('Capturing screen to:', fileName);
  page.render(fileName);
  id += 1;
}
