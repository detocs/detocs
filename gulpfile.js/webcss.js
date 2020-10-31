const browserslist = require('browserslist');
const doiuse = require('doiuse');
const fs = require('fs').promises;
const path = require('path');
const postCss = require('postcss');
const inputRange = require('postcss-input-range');
const presetEnv = require('postcss-preset-env');
const sass = require('sass');

const inFile = 'src/web/styles/detocs.scss';
const sassOut = inFile + '.css';
const outFile = 'build/public/detocs.css';
const browsers = browserslist();

module.exports = function webCss() {
  const sassResult = sass.renderSync({
    file: inFile,
    outFile: sassOut,
    includePaths: [ 'node_modules/', 'src/web/styles' ],
    sourceMap: true,
  });

  return postCss([
    inputRange(),
    presetEnv(),
    doiuse({
      browsers,
      ignore: [ 'css-appearance', 'css-resize', 'multicolumn' ],
      onFeatureUsage: usageInfo => {
        const source = usageInfo.usage.source.original.start.source;
        if (source.endsWith('normalize.css')) {
          return;
        }
        console.warn(usageInfo.message);
      },
    }),
  ])
    .process(sassResult.css.toString('utf8'), {
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
};
