import type { Config } from "@jest/types";

const commonConfig: Config.InitialOptions = {
  preset: "ts-jest",
  testEnvironment: "node",
  verbose: true,
  maxWorkers: 1,
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ["../step_functions/**/*.{js,ts}", "!**/tests/**"],
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  coveragePathIgnorePatterns: ["config.ts", "node_modules/"],
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
  transform: {
    "^.+\\.ts?$": "ts-jest",
  },
};

export default commonConfig;
