import alias from '@rollup/plugin-alias';
import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import bundleSize from 'rollup-plugin-bundle-size';
import visualizer from 'rollup-plugin-visualizer';

const nullFile = 'export default null';
const nullFilename = 'rollup_excluded_module';
/**
 * @param {RegExp[]} list
 */
function exclude(list) {
  return {
    resolveId(importee) {
      if (importee === nullFilename || list.some(regexp => regexp.test(importee))) {
        return nullFilename;
      }
      return null;
    },
    load(id) {
      return id === nullFilename ? nullFile : null;
    },
  };
}

const commonjsPlugin = commonjs();
const resolvePlugin = resolve({
  preferBuiltins: false,
});
const bundleSizePlugin = bundleSize();
let appPlugins = [
  json({
    indent: '    ',
    preferConst: true,
  }),
  replace({
    'process.env.NODE_ENV': "'production'",
  }),
  commonjsPlugin,
  // exclude([
  //   /^core-js.*/,
  // ]), // Some libraries like twitter-text include their own polyfills
  babel({
    babelHelpers: 'bundled',
    exclude: [/\/core-js\//]
  }),
  resolvePlugin,
  alias({
    entries: {
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
    },
  }),
  bundleSizePlugin,
];
const polyfillPlugins = [
  commonjsPlugin,
  resolvePlugin,
  bundleSizePlugin,
];

if (process.env.ANALYZE) {
  appPlugins = appPlugins.concat(/** @type {Plugin} */ (visualizer({
    filename: 'webjs-app-stats.html',
    open: true,
  })));
}

export default [
  {
    input: 'build/src/web/scripts/app.js',
    output: {
      file: 'build/public/detocs.js',
      format: 'iife',
    },
    plugins: appPlugins,
  },
  {
    input: 'build/src/web/scripts/polyfill.js',
    output: {
      file: 'build/public/polyfill.js',
      format: 'iife',
    },
    plugins: polyfillPlugins,
  },
];
