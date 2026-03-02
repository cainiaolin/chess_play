module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transformIgnorePatterns: ['node_modules'],
  moduleNameMapper: {
    '^uuid$': '<rootDir>/tests/mocks/uuid.js'
  }
};
