import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';

const plugins = [
  json({
    indent: '    ',
    preferConst: true,
  }),
  replace({
    'process.env.NODE_ENV': "'production'",
  }),
  commonjs(),
  resolve(),
  alias({
    entries: {
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
    },
  }),
];
export default [
  {
    input: 'build/web/js/app.js',
    output: {
      file: 'web/public/detocs.js',
      format: 'iife',
    },
    plugins,
  },
  {
    input: 'build/web/js/polyfill.js',
    output: {
      file: 'web/public/polyfill.js',
      format: 'iife',
    },
    plugins,
  },
];
