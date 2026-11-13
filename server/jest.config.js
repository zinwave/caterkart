/**
 * Unit tests for the logic that decides who may do what, and what an error is
 * allowed to reveal. Those are the parts where a regression is silent — a
 * broken menu is obvious on the first page load, a missing ownership check is
 * not — so they are the parts with tests.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
