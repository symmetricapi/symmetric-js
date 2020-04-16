import fs from 'fs';
import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';

const pkg = JSON.parse(fs.readFileSync('./package.json'));
const babelrc = JSON.parse(fs.readFileSync('./.babelrc'));
babelrc.presets[0][1].modules = false;

export default {
  input: 'src/index.js',
  output: {
    file: pkg.main,
    format: 'umd',
    name: pkg.name,
    sourcemap: true,
  },
  plugins: [
    resolve(),
    babel(
      Object.assign(babelrc, {
        babelrc: false,
        exclude: 'node_modules/**',
      }),
    ),
  ],
};
