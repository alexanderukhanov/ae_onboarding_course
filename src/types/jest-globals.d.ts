import type * as jestGlobals from '@jest/globals';
import type { ClassLike, FunctionLike, UnknownFunction } from 'jest-mock';

declare global {
  const describe: typeof jestGlobals.describe;
  const it: typeof jestGlobals.it;
  const test: typeof jestGlobals.test;
  const expect: typeof jestGlobals.expect;
  const beforeAll: typeof jestGlobals.beforeAll;
  const beforeEach: typeof jestGlobals.beforeEach;
  const afterAll: typeof jestGlobals.afterAll;
  const afterEach: typeof jestGlobals.afterEach;
  const jest: typeof jestGlobals.jest;

  namespace jest {
    type Mock<T extends FunctionLike = UnknownFunction> = jestGlobals.jest.Mock<T>;
    type Mocked<T extends object> = jestGlobals.jest.Mocked<T>;
    type MockedClass<T extends ClassLike> = jestGlobals.jest.MockedClass<T>;
    type MockedFunction<T extends FunctionLike> = jestGlobals.jest.MockedFunction<T>;
    type MockedObject<T extends object> = jestGlobals.jest.MockedObject<T>;
  }
}

export {};
