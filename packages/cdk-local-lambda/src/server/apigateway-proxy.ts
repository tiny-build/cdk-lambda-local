import type {
  APIGatewayProxyEvent,
  APIGatewayRequestAuthorizerEvent,
  Context
} from 'aws-lambda';
import type { Request } from 'express';

import { randomUUID } from 'node:crypto';

import {
  lowerCaseHeaderMap,
  pathParamsFromRequest,
  queryFromRequest
} from '../utils/request-shape';

export function buildRequestAuthorizerEvent(
  req: Request,
  opts: {
    readonly path: string;
    readonly httpMethod: string;
    readonly stage: string;
  }
): APIGatewayRequestAuthorizerEvent {
  const headers = lowerCaseHeaderMap(req.headers);
  const queryStringParameters = queryFromRequest(req);
  const methodArn = `arn:aws:execute-api:us-east-1:000000000000:local/${opts.stage}/${opts.httpMethod}${opts.path}`;

  return {
    type: 'REQUEST',
    methodArn,
    resource: opts.path,
    path: opts.path,
    httpMethod: opts.httpMethod,
    headers,
    multiValueHeaders: {},
    pathParameters: pathParamsFromRequest(req),
    queryStringParameters,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '000000000000',
      apiId: 'local',
      authorizer: {},
      protocol: 'HTTP/1.1',
      httpMethod: opts.httpMethod,
      identity: {
        sourceIp: req.ip ?? '127.0.0.1',
        userAgent: req.get('user-agent') ?? ''
      },
      path: opts.path,
      stage: opts.stage,
      requestId: randomUUID(),
      requestTimeEpoch: Date.now(),
      resourceId: 'local',
      resourcePath: opts.path
    } as unknown as APIGatewayRequestAuthorizerEvent['requestContext']
  };
}

export function buildProxyEvent(
  req: Request,
  opts: {
    readonly path: string;
    readonly httpMethod: string;
    readonly stage: string;
    readonly authorizerContext: Record<string, string>;
  }
): APIGatewayProxyEvent {
  const headers = lowerCaseHeaderMap(req.headers);
  const rawBody =
    typeof req.body === 'string' || Buffer.isBuffer(req.body)
      ? (req.body as Buffer | string).toString()
      : req.body === undefined
        ? null
        : JSON.stringify(req.body);

  return {
    body: rawBody,
    headers,
    multiValueHeaders: {},
    httpMethod: opts.httpMethod,
    isBase64Encoded: false,
    path: opts.path,
    pathParameters: pathParamsFromRequest(req),
    queryStringParameters: queryFromRequest(req),
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: opts.path,
    requestContext: {
      accountId: '000000000000',
      apiId: 'local',
      authorizer: opts.authorizerContext,
      protocol: 'HTTP/1.1',
      httpMethod: opts.httpMethod,
      identity: {
        sourceIp: req.ip ?? '127.0.0.1',
        userAgent: req.get('user-agent') ?? ''
      },
      path: opts.path,
      stage: opts.stage,
      requestId: randomUUID(),
      requestTimeEpoch: Date.now(),
      resourceId: 'local'
    } as APIGatewayProxyEvent['requestContext']
  };
}

export function lambdaContext(functionName: string): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName,
    functionVersion: '$LATEST',
    invokedFunctionArn: `arn:aws:lambda:us-east-1:000000000000:function:${functionName}`,
    memoryLimitInMB: '1024',
    awsRequestId: randomUUID(),
    logGroupName: `/aws/lambda/${functionName}`,
    logStreamName: 'local',
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {}
  };
}
