/** A single CloudFormation resource entry from a synthesised template. */
export interface CfnResource {
  /** CloudFormation resource type (e.g. `"AWS::Lambda::Function"`). */
  readonly Type?: string;
  /** Resource-specific properties from the CloudFormation template. */
  readonly Properties?: Record<string, unknown>;
}

/** All resources in a CloudFormation template, keyed by logical resource ID. */
export type CfnResources = Readonly<Record<string, CfnResource>>;

/** Type guard — returns `true` if `x` is a CloudFormation `{ Ref: string }` intrinsic. */
export function isRef(x: unknown): x is { Ref: string } {
  return (
    typeof x === 'object' &&
    x !== null &&
    'Ref' in x &&
    typeof (x as { Ref: unknown }).Ref === 'string'
  );
}

/** Type guard — returns `true` if `x` is a CloudFormation `{ "Fn::GetAtt": [logicalId, attribute] }` intrinsic. */
export function isGetAtt(x: unknown): x is { 'Fn::GetAtt': [string, string] } {
  if (typeof x !== 'object' || x === null || !('Fn::GetAtt' in x)) {
    return false;
  }
  const ga = (x as { 'Fn::GetAtt': unknown })['Fn::GetAtt'];
  return (
    Array.isArray(ga) &&
    ga.length === 2 &&
    typeof ga[0] === 'string' &&
    typeof ga[1] === 'string'
  );
}
