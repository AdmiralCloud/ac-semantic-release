const globals = require('globals')
const js = require('@eslint/js')

module.exports = {
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    globals: {
      ...globals.commonjs,
      ...globals.es6,
      ...globals.node,
      expect: 'readonly',
      describe: 'readonly',
      it: 'readonly',
      test: 'readonly'
    }
  },
  rules: {
    ...js.configs.recommended.rules,
    'no-undef': 'error',  // Add this rule to catch undefined variables
    'no-const-assign': 'error',
    'space-before-function-paren': 'off',
    'no-extra-semi': 'off',
    'object-curly-spacing': ['error', 'always'],
    'brace-style': ['error', 'stroustrup', { allowSingleLine: true }],
    'no-useless-escape': 'off',
    'new-cap': 'off',
    //'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': 'error',
    'prefer-const': ['warn', { ignoreReadBeforeAssign: true }],
    "no-control-regex": "off"
  }
};