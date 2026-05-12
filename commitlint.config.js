module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'style', 'chore', 'revert', 'ci', 'build'],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
    'scope-case': [2, 'always', 'lower-case'],
    'body-max-line-length': [1, 'always', 100],
  },
};
