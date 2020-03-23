import json from 'rollup-plugin-json';
import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';

const plugins = [
  json({
    indent: '    ',
    preferConst: true,
  }),
  commonjs(),
  resolve(),
];
export default [
  {
    input: 'web/js/app.js',
    output: {
      file: 'web/public/detocs.js',
      format: 'iife',
    },
    plugins,
  },
  {
    input: 'web/js/polyfill.js',
    output: {
      file: 'web/public/polyfill.js',
      format: 'iife',
    },
    plugins,
  },
];
