import alias from '@rollup/plugin-alias';
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

const commonPlugins = [
  json({
    indent: '    ',
    preferConst: true,
  }),
  replace({
    'process.env.NODE_ENV': "'production'",
  }),
  commonjs(),
  exclude([
    /^core-js\/modules\/es6\..*/,
    /^core-js\/modules\/es7\..*/,
    /^core-js\/modules\/web.dom\..*/,
  ]),
  resolve({
    preferBuiltins: false,
  }),
  alias({
    entries: {
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
    },
  }),
  bundleSize(),
];
let appPlugins = commonPlugins;
const polyfillPlugins = commonPlugins;

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
