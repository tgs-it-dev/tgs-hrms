module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'style', 'chore', 'revert', 'ci', 'build'],
    ],
    // Allow lowercase subjects that may contain uppercase acronyms (WFH, DTO, API, etc.).
    // Only prohibit pure sentence-case, all-start-case, pascal-case, and all-upper-case.
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
    'scope-case': [2, 'always', 'lower-case'],
    'body-max-line-length': [1, 'always', 100],
  },
};
