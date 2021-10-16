const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const { name } = require('../package.json');
const { getVersion } = require('./versioning');

const version = getVersion();
const filename = `${name}-${version}-win.zip`;
const output = fs.createWriteStream(path.join('dist/full', filename));
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', function() {
  console.log(`${filename} archived (${archive.pointer()} bytes)`);
});

archive.on('warning', function(err) {
  throw err;
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);
archive.directory('dist/full/win-unpacked/', false);
archive.finalize();
