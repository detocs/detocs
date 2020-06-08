#!/usr/bin/env node
require = require('esm')(module);
global.APP_ROOT = __dirname;
module.exports = require('./build/main.js');
