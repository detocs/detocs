import json from 'rollup-plugin-json';
import resolve from 'rollup-plugin-node-resolve';

export default {
  input: 'web/js/app.js',
  output: {
    file: 'web/public/detocs.js',
    format: 'iife',
  },
  plugins: [
    json({
      indent: '    ',
      preferConst: true,
    }),
    resolve(),
  ],
};
