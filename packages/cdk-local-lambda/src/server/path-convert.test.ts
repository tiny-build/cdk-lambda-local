import { describe, it, expect } from 'vitest';

import { toExpressPath } from './path-convert';

describe('toExpressPath', () => {
  it('rewrites {id} to :id', () => {
    expect(toExpressPath('/users/{id}')).toBe('/users/:id');
  });
  it('rewrites {proxy+} to *', () => {
    expect(toExpressPath('/files/{proxy+}')).toBe('/files/*');
  });
  it('preserves plain paths', () => {
    expect(toExpressPath('/hello')).toBe('/hello');
  });
  it('handles multiple params', () => {
    expect(toExpressPath('/a/{x}/b/{y}')).toBe('/a/:x/b/:y');
  });
  it('throws on unsupported patterns', () => {
    expect(() => toExpressPath('/a/{x+}/b')).toThrow();
  });
});
