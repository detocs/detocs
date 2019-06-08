const ERROR = 2;

module.exports = {
  parser: '@typescript-eslint/parser', // Specifies the ESLint parser
  extends: [
    'plugin:@typescript-eslint/recommended', // Uses the recommended rules from the @typescript-eslint/eslint-plugin
  ],
  plugins: [
    'react',
  ],
  parserOptions: {
    ecmaVersion: 2018, // Allows for the parsing of modern ECMAScript features
    sourceType: 'module', // Allows for the use of imports
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
      { functions: false, classes: false, variables: true },
    ],
    'react/jsx-filename-extension': [1, {
      'extensions': ['.ts', '.tsx', '.js', '.jsx']
    }],
    'react/jsx-uses-react': 'error',
    'react/jsx-uses-vars': 'error',
  },
};
