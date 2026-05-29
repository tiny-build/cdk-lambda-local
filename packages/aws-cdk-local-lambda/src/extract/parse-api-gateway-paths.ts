import { type CfnResources, isGetAtt, isRef } from './cfn-types';

function isRootParent(parentId: unknown): boolean {
  return isGetAtt(parentId) && parentId['Fn::GetAtt'][1] === 'RootResourceId';
}

/**
 * Walks the `AWS::ApiGateway::Resource` tree in a CloudFormation template and returns a map
 * from each resource's logical ID to its resolved absolute path (e.g. `"/users/{id}"`).
 */
export function buildApiGatewayResourcePaths(
  resources: CfnResources
): Map<string, string> {
  const result = new Map<string, string>();

  const resourceIds = new Set<string>();
  for (const [id, res] of Object.entries(resources)) {
    if (res?.Type === 'AWS::ApiGateway::Resource') {
      resourceIds.add(id);
    }
  }

  function pathFor(logicalId: string): string {
    if (result.has(logicalId)) {
      return result.get(logicalId)!;
    }
    const res = resources[logicalId];
    if (!res || res.Type !== 'AWS::ApiGateway::Resource') {
      throw new Error(`Not an ApiGateway Resource: ${logicalId}`);
    }
    const props = res.Properties ?? {};
    const pathPart = props.PathPart;
    const parentId = props.ParentId;
    if (typeof pathPart !== 'string') {
      throw new Error(`Missing PathPart on ${logicalId}`);
    }

    let prefix = '';
    if (isRootParent(parentId)) {
      prefix = '';
    } else if (isRef(parentId)) {
      prefix = pathFor(parentId.Ref);
    } else {
      throw new Error(
        `Unsupported ParentId on ${logicalId}: ${JSON.stringify(parentId)}`
      );
    }

    const full =
      prefix === '' || prefix === '/'
        ? `/${pathPart}`
        : `${prefix.replace(/\/$/, '')}/${pathPart}`;

    result.set(logicalId, full);
    return full;
  }

  for (const id of resourceIds) {
    pathFor(id);
  }
  return result;
}
