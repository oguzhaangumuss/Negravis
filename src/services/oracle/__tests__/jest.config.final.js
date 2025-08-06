/**
 * Final Jest Configuration for Oracle System Tests
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '../',
  testMatch: [
    '**/__tests__/**/*.test.ts'
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.d.ts',
    '!**/__tests__/**',
    '!**/node_modules/**'
  ],
  coverageDirectory: '<rootDir>/coverage',
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  // setupFilesAfterEnv: ['<rootDir>/__tests__/setup.simple.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../../$1'
  }
};