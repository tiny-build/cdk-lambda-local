import type { LocalManifest } from '../types';

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { createLocalApp } from './create-app';

function mkFn(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'app-'));
  const file = join(dir, 'h.mjs');
  writeFileSync(file, body);
  return file;
}

describe('createLocalApp', () => {
  it('serves a public GET route', async () => {
    const entry = mkFn(
      'export const main = async () => ({ statusCode: 200, body: "hi" });'
    );
    const m: LocalManifest = {
      source: 'cdk-synth',
      stack: 'S',
      stage: 'dev',
      cdkOut: '/x',
      lambdas: {
        hello: {
          functionKey: 'hello',
          lambdaLogicalId: 'X',
          lambdaFunctionName: 'x',
          assetDir: '/x',
          entry,
          handler: 'main',
          runtime: 'nodejs22.x',
          environment: {}
        }
      },
      routes: {
        'GET /hello': {
          method: 'GET',
          path: '/hello',
          functionKey: 'hello',
          authorizerKey: null
        }
      }
    };
    const handle = await createLocalApp({ manifest: m, watch: false });
    const r = await request(handle.app).get('/hello');
    expect(r.status).toBe(200);
    expect(r.text).toBe('hi');
    await handle.stop();
  });

  it('calls the authorizer and 403s on deny', async () => {
    const authEntry = mkFn(
      'export const main = async () => ({ policyDocument: { Statement: [{ Effect: "Deny" }] } });'
    );
    const entry = mkFn(
      'export const main = async () => ({ statusCode: 200, body: "private" });'
    );
    const m: LocalManifest = {
      source: 'cdk-synth',
      stack: 'S',
      stage: 'dev',
      cdkOut: '/x',
      lambdas: {
        authorizer: {
          functionKey: 'authorizer',
          lambdaLogicalId: 'A',
          lambdaFunctionName: 'a',
          assetDir: '/x',
          entry: authEntry,
          handler: 'main',
          runtime: 'nodejs22.x',
          environment: {}
        },
        secret: {
          functionKey: 'secret',
          lambdaLogicalId: 'S',
          lambdaFunctionName: 's',
          assetDir: '/x',
          entry,
          handler: 'main',
          runtime: 'nodejs22.x',
          environment: {}
        }
      },
      routes: {
        'GET /secret': {
          method: 'GET',
          path: '/secret',
          functionKey: 'secret',
          authorizerKey: 'authorizer'
        }
      }
    };
    const handle = await createLocalApp({ manifest: m, watch: false });
    const r = await request(handle.app).get('/secret');
    expect(r.status).toBe(403);
    await handle.stop();
  });

  it('serves the health route', async () => {
    const m: LocalManifest = {
      source: 'cdk-synth',
      stack: 'S',
      stage: 'dev',
      cdkOut: '/x',
      lambdas: {},
      routes: {}
    };
    const handle = await createLocalApp({ manifest: m, watch: false });
    const r = await request(handle.app).get('/__local/health');
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    await handle.stop();
  });

  it('forwards authorizer context to the main handler on allow', async () => {
    const authEntry = mkFn(
      'export const main = async () => ({ ' +
        'principalId: "u1", ' +
        'policyDocument: { Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: "execute-api:Invoke", Resource: "*" }] }, ' +
        'context: { userId: "42", role: "admin" } ' +
        '});'
    );
    const entry = mkFn(
      'export const main = async (event) => ({ statusCode: 200, body: JSON.stringify(event.requestContext.authorizer) });'
    );
    const m: LocalManifest = {
      source: 'cdk-synth',
      stack: 'S',
      stage: 'dev',
      cdkOut: '/x',
      lambdas: {
        authorizer: {
          functionKey: 'authorizer',
          lambdaLogicalId: 'A',
          lambdaFunctionName: 'a',
          assetDir: '/x',
          entry: authEntry,
          handler: 'main',
          runtime: 'nodejs22.x',
          environment: {}
        },
        secret: {
          functionKey: 'secret',
          lambdaLogicalId: 'S',
          lambdaFunctionName: 's',
          assetDir: '/x',
          entry,
          handler: 'main',
          runtime: 'nodejs22.x',
          environment: {}
        }
      },
      routes: {
        'GET /secret': {
          method: 'GET',
          path: '/secret',
          functionKey: 'secret',
          authorizerKey: 'authorizer'
        }
      }
    };
    const handle = await createLocalApp({ manifest: m, watch: false });
    const r = await request(handle.app).get('/secret');
    expect(r.status).toBe(200);
    const ctx = JSON.parse(r.text);
    expect(ctx.userId).toBe('42');
    expect(ctx.role).toBe('admin');
    await handle.stop();
  });

  it('invokes onError and returns 500 when the handler throws', async () => {
    const entry = mkFn(
      'export const main = async () => { throw new Error("boom"); };'
    );
    const m: LocalManifest = {
      source: 'cdk-synth',
      stack: 'S',
      stage: 'dev',
      cdkOut: '/x',
      lambdas: {
        f: {
          functionKey: 'f',
          lambdaLogicalId: 'F',
          lambdaFunctionName: 'f',
          assetDir: '/x',
          entry,
          handler: 'main',
          runtime: 'nodejs22.x',
          environment: {}
        }
      },
      routes: {
        'GET /fail': {
          method: 'GET',
          path: '/fail',
          functionKey: 'f',
          authorizerKey: null
        }
      }
    };
    const seen: Error[] = [];
    const handle = await createLocalApp({
      manifest: m,
      watch: false,
      onError: err => {
        if (err instanceof Error) seen.push(err);
      }
    });
    const r = await request(handle.app).get('/fail');
    expect(r.status).toBe(500);
    expect(r.body.message).toBe('boom');
    expect(seen).toHaveLength(1);
    expect(seen[0].message).toBe('boom');
    await handle.stop();
  });

  it('throws when a route references an unknown function', async () => {
    const m: LocalManifest = {
      source: 'cdk-synth',
      stack: 'S',
      stage: 'dev',
      cdkOut: '/x',
      lambdas: {},
      routes: {
        'GET /x': {
          method: 'GET',
          path: '/x',
          functionKey: 'missing',
          authorizerKey: null
        }
      }
    };
    await expect(createLocalApp({ manifest: m, watch: false })).rejects.toThrow(
      /unknown lambda/i
    );
  });

  it('prefers literal routes over parameterized routes (specificity)', async () => {
    const meEntry = mkFn(
      'export const main = async () => ({ statusCode: 200, body: "me" });'
    );
    const idEntry = mkFn(
      'export const main = async (event) => ({ statusCode: 200, body: `id:${event.pathParameters?.id ?? ""}` });'
    );
    const m: LocalManifest = {
      source: 'cdk-synth',
      stack: 'S',
      stage: 'dev',
      cdkOut: '/x',
      lambdas: {
        me: {
          functionKey: 'me',
          lambdaLogicalId: 'M',
          lambdaFunctionName: 'm',
          assetDir: '/x',
          entry: meEntry,
          handler: 'main',
          runtime: 'nodejs22.x',
          environment: {}
        },
        byId: {
          functionKey: 'byId',
          lambdaLogicalId: 'I',
          lambdaFunctionName: 'i',
          assetDir: '/x',
          entry: idEntry,
          handler: 'main',
          runtime: 'nodejs22.x',
          environment: {}
        }
      },
      routes: {
        'GET /users/{id}': {
          method: 'GET',
          path: '/users/{id}',
          functionKey: 'byId',
          authorizerKey: null
        },
        'GET /users/me': {
          method: 'GET',
          path: '/users/me',
          functionKey: 'me',
          authorizerKey: null
        }
      }
    };
    const handle = await createLocalApp({ manifest: m, watch: false });
    const rMe = await request(handle.app).get('/users/me');
    expect(rMe.text).toBe('me');
    const rId = await request(handle.app).get('/users/42');
    expect(rId.text).toBe('id:42');
    await handle.stop();
  });
});
