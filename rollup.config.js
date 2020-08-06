import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import bundleSize from 'rollup-plugin-bundle-size';
import visualizer from 'rollup-plugin-visualizer';

const commonPlugins = [
  json({
    indent: '    ',
    preferConst: true,
  }),
  replace({
    'process.env.NODE_ENV': "'production'",
  }),
  commonjs(),
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
    input: 'build/web/js/app.js',
    output: {
      file: 'web/public/detocs.js',
      format: 'iife',
    },
    plugins: appPlugins,
  },
  {
    input: 'build/web/js/polyfill.js',
    output: {
      file: 'web/public/polyfill.js',
      format: 'iife',
    },
    plugins: polyfillPlugins,
  },
];
