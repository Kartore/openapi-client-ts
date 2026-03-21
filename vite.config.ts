import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  fmt: {
    ignorePatterns: ['worker-configuration.d.ts'],
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: true,
    trailingComma: 'es5',
    endOfLine: 'lf',
    experimentalSortImports: {
      groups: [
        ['side_effect'],
        ['builtin'],
        ['external'],
        ['internal'],
        ['parent', 'sibling', 'index'],
      ],
      sortSideEffects: false,
      newlinesBetween: true,
      ignoreCase: true,
    },
    experimentalSortPackageJson: true,
  },
  lint: {
    ignorePatterns: ['worker-configuration.d.ts'],
    plugins: ['typescript', 'oxc'],
    rules: {
      eqeqeq: [
        'error',
        'always',
        {
          null: 'ignore',
        },
      ],
      'no-console': [
        'error',
        {
          allow: ['info', 'warn', 'error'],
        },
      ],
      'no-debugger': 'error',
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'typescript/no-floating-promises': 'error',
      'typescript/no-namespace': 'off',
      'import/no-cycle': 'error',
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
