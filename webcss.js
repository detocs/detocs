/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs').promises;
const path = require('path');
const postCss = require('postcss');
const presetEnv = require('postcss-preset-env');
const sass = require('sass');

const inFile = 'src/web/styles/detocs.scss';
const sassOut = inFile + '.css';
const outFile = 'build/public/detocs.css';

const sassResult = sass.renderSync({
  file: inFile,
  outFile: sassOut,
  includePaths: [ 'node_modules/', 'src/web/styles' ],
  sourceMap: true,
});

postCss([ presetEnv() ])
  .process(sassResult.css, {
    from: sassOut,
    to: outFile,
    map: { prev: sassResult.map.toString('utf8') },
  })
  .then(async result => {
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    return Promise.all([
      fs.writeFile(outFile, result.css),
      fs.writeFile(outFile + '.map', result.map),
    ]);
  });
