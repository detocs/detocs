const fs = require('fs').promises;

const { series, parallel, src, dest } = require('gulp');
const run = require('gulp-run');

const clean = () =>
  fs.rmdir('build', { recursive: true, force: true });

const builtinAssets = () =>
  src('assets/templates/**/*')
    .pipe(dest('build/templates/'));

const tsc = () =>
  run('npm run tsc').exec();

const webCss = require('./webcss');

const webHtml = () =>
  src('src/web/views/**/*')
    .pipe(dest('build/public/'));

const webIcons = () =>
  run('npm run webicons').exec();

const webImages = () =>
  src('assets/images/**/*')
    .pipe(dest('build/public/images/'));

const rollup = () =>
  run('npm run webjs').exec();

const screenshotJs = () =>
  run('npm run screenshotjs').exec();

const build = series(
  clean,
  parallel(
    builtinAssets,
    webCss,
    webHtml,
    webIcons,
    webImages,
    series(tsc, rollup),
  ),
);

const screenshots = series(
  build,
  screenshotJs,
);

module.exports = {
  default: build,
  build,
  webCss,
  webJs: series(tsc, rollup),
  webHtml,
  screenshots,
};
