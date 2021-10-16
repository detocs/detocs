const fs = require('fs');
const path = require('path');
const { name } = require('../package.json');
const { getVersion } = require('./versioning');

const version = getVersion();
const outputDir = 'dist/server';
const originalFilesRegex = new RegExp(`${name}-([\\w.]+)$`);
const files = fs.readdirSync(outputDir);
const originalFiles = files.filter(file => originalFilesRegex.test(file));

originalFiles.map(filename => {
  const newFilename = filename.replace(originalFilesRegex, `${name}-server-${version}_$1`);
  console.log(`${filename} -> ${newFilename}`);
  fs.renameSync(
    path.join(outputDir, filename),
    path.join(outputDir, newFilename),
  );
});
