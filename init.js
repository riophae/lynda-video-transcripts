/* eslint-disable no-var, vars-on-top */

var path = require('path');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');

var screenshotDir = path.resolve(__dirname, './screenshots');
rimraf.sync(screenshotDir);
mkdirp(screenshotDir);

var outputDir = path.resolve(__dirname, './output');
rimraf.sync(outputDir);
mkdirp(outputDir);
