// .eslintrc.cjs
module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'prettier'
    ],
    env: {
      node: true,
      browser: true,
      es2022: true
    },
    ignorePatterns: ['dist/', 'node_modules/', '*.config.js', '*.config.cjs'],
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      // Example: Customize here
      '@typescript-eslint/no-unused-vars': ['warn'],
      '@typescript-eslint/explicit-module-boundary-types': 'off'
    }
  };
  