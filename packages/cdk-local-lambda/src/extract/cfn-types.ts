export interface CfnResource {
  readonly Type?: string;
  readonly Properties?: Record<string, unknown>;
}

export type CfnResources = Readonly<Record<string, CfnResource>>;

export function isRef(x: unknown): x is { Ref: string } {
  return (
    typeof x === 'object' &&
    x !== null &&
    'Ref' in x &&
    typeof (x as { Ref: unknown }).Ref === 'string'
  );
}

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
