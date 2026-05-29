import { describe, expect, it } from 'vitest';

import { sendProxyResult } from './response-writer';

function fakeRes() {
  const headers: Record<string, string> = {};
  let body: unknown;
  let status = 200;
  const res = {
    status(s: number) {
      status = s;
      return this;
    },
    setHeader(k: string, v: string) {
      headers[k] = v;
    },
    send(b: unknown) {
      body = b;
      return this;
    },
    get statusCode() {
      return status;
    },
    get body() {
      return body;
    },
    get headers() {
      return headers;
    }
  };
  return res;
}

describe('sendProxyResult', () => {
  it('applies statusCode, headers, and text body', () => {
    const res = fakeRes();
    sendProxyResult(res as never, {
      statusCode: 201,
      headers: { 'x-a': '1', 'x-b': undefined as unknown as string },
      body: 'hi'
    });
    expect(res.statusCode).toBe(201);
    expect(res.headers['x-a']).toBe('1');
    expect(res.body).toBe('hi');
  });

  it('decodes base64 body', () => {
    const res = fakeRes();
    sendProxyResult(res as never, {
      statusCode: 200,
      body: Buffer.from('hello').toString('base64'),
      isBase64Encoded: true
    });
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect((res.body as Buffer).toString()).toBe('hello');
  });

  it('502s on missing result', () => {
    const res = fakeRes();
    sendProxyResult(res as never, undefined);
    expect(res.statusCode).toBe(502);
  });
});
