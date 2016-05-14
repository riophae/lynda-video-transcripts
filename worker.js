/* eslint-disable no-var, vars-on-top, no-use-before-define, func-names */

var fs = require('fs');
var path = require('path');
var log = require('npmlog');
var rimraf = require('rimraf').sync;
var mkdirp = require('mkdirp');
var browserify = require('browserify');
var watchify = require('watchify');
var babelify = require('babelify');
var yamlify = require('yamlify');

log.level = 'verbose';
var distDir = path.resolve(__dirname, 'lib/');

rimraf(distDir);
mkdirp(distDir);

function app(name) {
  var b = browserify({
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

['entry', 'test'].forEach(app);
