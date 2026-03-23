import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    dts: {
      tsgo: true,
    },
    exports: true,
    entry: ['src/index.ts', 'src/cli.ts', 'src/node.ts'],
    banner: (chunk) => {
      if (chunk.fileName.includes('cli')) {
        return '#!/usr/bin/env node';
      }
    },
  },
});
