import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^electron$': '<rootDir>/tests/__mocks__/electron.ts',
  },
}

export default config
