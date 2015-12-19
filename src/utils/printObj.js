export default function printObj(obj) {
  Object.keys(obj).forEach((key) => {
    console.log(key, obj[key]);
  });
}
