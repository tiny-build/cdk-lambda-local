import { describe, it, expect } from 'vitest';

import { buildAuthorizerLambdaMap } from './parse-authorizers';

describe('buildAuthorizerLambdaMap', () => {
  it('maps authorizer logical id to its lambda logical id', () => {
    const resources = {
      MyAuthorizer: {
        Type: 'AWS::ApiGateway::Authorizer',
        Properties: {
          Type: 'REQUEST',
          AuthorizerUri: {
            'Fn::Join': [
              '',
              [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':apigateway:',
                { Ref: 'AWS::Region' },
                ':lambda:path/2015-03-31/functions/',
                { 'Fn::GetAtt': ['AuthLambdaABC', 'Arn'] },
                '/invocations'
              ]
            ]
          }
        }
      }
    };
    const map = buildAuthorizerLambdaMap(resources);
    expect(map.get('MyAuthorizer')).toBe('AuthLambdaABC');
  });

  it('skips authorizers without a resolvable lambda GetAtt', () => {
    const resources = {
      BadAuthorizer: {
        Type: 'AWS::ApiGateway::Authorizer',
        Properties: {
          Type: 'TOKEN',
          AuthorizerUri: 'static-uri-no-getatt'
        }
      }
    };
    const map = buildAuthorizerLambdaMap(resources);
    expect(map.has('BadAuthorizer')).toBe(false);
  });

  it('ignores non-Authorizer resources', () => {
    const resources = {
      Method: { Type: 'AWS::ApiGateway::Method', Properties: {} }
    };
    expect(buildAuthorizerLambdaMap(resources).size).toBe(0);
  });
});
