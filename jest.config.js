import { createDefaultEsmPreset, pathsToModuleNameMapper } from 'ts-jest';
import tsconfigJson from './tsconfig.json' with { type: 'json' };

const presetConfig = createDefaultEsmPreset({
  tsconfig: "./test/tsconfig.json",
});

/** @type {import('ts-jest').JestConfigWithTsJest} */
const jestConfig = {
  ...presetConfig,
  testEnvironment: 'node',
  moduleNameMapper: pathsToModuleNameMapper(
    tsconfigJson.compilerOptions.paths,
    { prefix: '<rootDir>/' },
  ),
};

export default jestConfig;