import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

const config = {
  input: 'src/main.ts',
  output: {
    dir: 'dist',
    entryFileNames: '[name].bundle.mjs',
  },
  plugins: [nodeResolve(), typescript()],
};

export default config;
