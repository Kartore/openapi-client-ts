import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/cli.ts', 'src/node.ts'],
      reporter: ['text', 'lcov'],
    },
  },
  pack: {
    dts: {
      generator: 'tsc',
    },
    exports: { bin: false },
    entry: ['src/index.ts', 'src/cli.ts', 'src/node.ts'],
  },
});
