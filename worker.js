/* eslint-disable no-use-before-define, func-names */

const fs = require('fs');
const path = require('path');
const log = require('npmlog');
const rimraf = require('rimraf').sync;
const mkdirp = require('mkdirp');
const browserify = require('browserify');
const watchify = require('watchify');
const babelify = require('babelify');
const yamlify = require('yamlify');

log.level = 'verbose';
const distDir = path.resolve(__dirname, 'lib/');

rimraf(distDir);
mkdirp(distDir);

function app(name) {
  const b = browserify({
    entries: ['./src/' + name + '.js'],
    cache: {},
    packageCache: {},
    debug: true,
  });
  b.exclude('webpage');
  b.exclude('fs');

  if (process.env.NODE_ENV !== 'production') {
    b.plugin(watchify);
  }
  b.transform(babelify, {
    presets: ['es2015', 'stage-0'],
  });
  b.transform(yamlify);

  b.on('update', bundle);
  b.on('log', onlog);
  b.on('error', onerr);

  function bundle() {
    b.bundle().pipe(fs.createWriteStream(path.resolve(distDir, name + '.js')));
  }

  function onlog(msg) {
    log.verbose(name + ' is bundled!', msg);
  }

  function onerr(err) {
    console.error(err);
  }

  bundle();
}

['crawler-entry'].forEach(app);
