import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  testRegex: 'test/integration/.*\\.e2e-spec\\.ts$',
  globalSetup: '<rootDir>/test/globalSetup.ts',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 30000,
};
export default config;
