const ERROR = 2;

module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'plugin:@typescript-eslint/recommended',
  ],
  plugins: [
    'react',
  ],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  settings: {
    'react': {
      'pragma': 'h',
    },
  },
  rules: {
    'max-len': ['error', { 'code': 100 }],
    'semi': 'off',
    '@typescript-eslint/semi': ['error', 'always'],
    '@typescript-eslint/indent': [ERROR, 2],
    '@typescript-eslint/explicit-function-return-type': [
      'warn',
      { allowExpressions: true },
    ],
    '@typescript-eslint/no-use-before-define': [
      'error',
      { functions: false, classes: false, variables: false },
    ],
    'react/jsx-filename-extension': [1, {
      'extensions': ['.ts', '.tsx', '.js', '.jsx']
    }],
    'react/jsx-uses-react': 'error',
    'react/jsx-uses-vars': 'error',
  },
  overrides: [
    {
      files: [
        '*.js'
      ],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      }
    },
  ],
};
