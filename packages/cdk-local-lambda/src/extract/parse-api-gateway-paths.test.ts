import { describe, expect, it } from 'vitest';

import { buildApiGatewayResourcePaths } from './parse-api-gateway-paths';

describe('buildApiGatewayResourcePaths', () => {
  it('builds /hello from root + child resource', () => {
    const resources = {
      ApiGatewayPatServicesApi9A7C783E: {
        Type: 'AWS::ApiGateway::RestApi',
        Properties: { Name: 'pat-services-dev' }
      },
      ApiGatewayPatServicesApihello499181B2: {
        Type: 'AWS::ApiGateway::Resource',
        Properties: {
          ParentId: {
            'Fn::GetAtt': ['ApiGatewayPatServicesApi9A7C783E', 'RootResourceId']
          },
          PathPart: 'hello',
          RestApiId: { Ref: 'ApiGatewayPatServicesApi9A7C783E' }
        }
      }
    };

    const paths = buildApiGatewayResourcePaths(resources);
    expect(paths.get('ApiGatewayPatServicesApihello499181B2')).toBe('/hello');
  });

  it('builds nested /common/get-all-assessments', () => {
    const resources = {
      Api: {
        Type: 'AWS::ApiGateway::RestApi',
        Properties: {}
      },
      CommonRes: {
        Type: 'AWS::ApiGateway::Resource',
        Properties: {
          ParentId: {
            'Fn::GetAtt': ['Api', 'RootResourceId']
          },
          PathPart: 'common',
          RestApiId: { Ref: 'Api' }
        }
      },
      NestedRes: {
        Type: 'AWS::ApiGateway::Resource',
        Properties: {
          ParentId: { Ref: 'CommonRes' },
          PathPart: 'get-all-assessments',
          RestApiId: { Ref: 'Api' }
        }
      }
    };

    const paths = buildApiGatewayResourcePaths(resources);
    expect(paths.get('CommonRes')).toBe('/common');
    expect(paths.get('NestedRes')).toBe('/common/get-all-assessments');
  });
});
