const { series, parallel, src, dest } = require('gulp');
const run = require('gulp-run');

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

const webJs = () =>
  run('npm run webjs').exec();

const build = parallel(
  builtinAssets,
  webCss,
  webHtml,
  webIcons,
  webImages,
  series(tsc, webJs),
);

module.exports = {
  default: build,
  build,
  webCss,
  webHtml,
};
