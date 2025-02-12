import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
  preset: 'ts-jest', // Use ts-jest preset for TypeScript support
  testEnvironment: 'node', // Use Node environment for testing
  moduleFileExtensions: ['ts', 'js', 'json', 'node'], // Extensions to recognize
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest', // Use ts-jest for TypeScript files
  },
  testMatch: ['**/*.test.ts'], // Match test files with .test.ts extension
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'], // Setup file after the environment is set up
  verbose: true, // Show detailed test results
  globalTeardown: '<rootDir>/globalTeardown.ts', // Optional: You can define global teardown logic if needed
  collectCoverage: true, // Collect coverage for tests
  coverageDirectory: '<rootDir>/coverage', // Where coverage reports will be stored
  coverageProvider: 'v8', // Use v8 engine for coverage (faster)
};

export default config;
