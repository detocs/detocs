const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const { productName, version } = require('./package.json');

const filename = `${productName}-${version}.zip`;
const output = fs.createWriteStream(path.join('dist', filename));
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
archive.directory('dist/win-unpacked/', false);
archive.finalize();
