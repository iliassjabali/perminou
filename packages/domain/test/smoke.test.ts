import { test, expect } from 'vitest';
import { hello } from '../src/index';

test('domain package is wired', () => {
  expect(hello()).toBe('perminou');
});
