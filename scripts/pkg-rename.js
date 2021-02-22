const fs = require('fs');
const path = require('path');
const { name, version } = require('../package.json');

const outputDir = 'dist/server';
const originalFilesRegex = new RegExp(`${name}-([\\w.]+)`);
const files = fs.readdirSync(outputDir);
console.log(files);
const originalFiles = files.filter(file => originalFilesRegex.test(file));
console.log(originalFiles);

originalFiles.map(filename => {
  const newFilename = filename.replace(originalFilesRegex, `${name}-server-${version}_$1`);
  console.log(`${filename} -> ${newFilename}`);
  fs.renameSync(
    path.join(outputDir, filename),
    path.join(outputDir, newFilename),
  );
});
