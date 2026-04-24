import { findLambdaLogicalIdInUri } from '../utils/cfn-uri';
import { type CfnResources, isRef } from './cfn-types';
import { buildApiGatewayResourcePaths } from './parse-api-gateway-paths';

export interface ParsedMethod {
  readonly httpMethod: string;
  readonly path: string;
  readonly lambdaLogicalId: string;
  readonly authorizerLogicalId: string | null;
}

export function parseApiGatewayMethods(
  resources: CfnResources
): ParsedMethod[] {
  const paths = buildApiGatewayResourcePaths(resources);
  const out: ParsedMethod[] = [];

  for (const [, res] of Object.entries(resources)) {
    if (res?.Type !== 'AWS::ApiGateway::Method' || !res.Properties) continue;
    const props = res.Properties;
    const integration = props.Integration as
      | Record<string, unknown>
      | undefined;
    if (!integration || integration.Type !== 'AWS_PROXY') continue;

    const lambdaLogicalId = findLambdaLogicalIdInUri(integration.Uri);
    if (!lambdaLogicalId) continue;

    const resourceRef = props.ResourceId;
    if (!isRef(resourceRef)) continue;
    const path = paths.get(resourceRef.Ref);
    if (!path) continue;

    const httpMethod = props.HttpMethod;
    if (typeof httpMethod !== 'string') continue;

    const authType = props.AuthorizationType;
    let authorizerLogicalId: string | null = null;
    if (authType === 'CUSTOM') {
      const authRef = props.AuthorizerId;
      if (isRef(authRef)) authorizerLogicalId = authRef.Ref;
    }

    out.push({ httpMethod, path, lambdaLogicalId, authorizerLogicalId });
  }

  return out;
}
