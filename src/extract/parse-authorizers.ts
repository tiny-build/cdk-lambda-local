import { findLambdaLogicalIdInUri } from "../utils/cfn-uri.js";
import type { CfnResources } from "./cfn-types.js";

export function buildAuthorizerLambdaMap(resources: CfnResources): Map<string, string> {
	const out = new Map<string, string>();
	for (const [logicalId, res] of Object.entries(resources)) {
		if (res?.Type !== "AWS::ApiGateway::Authorizer" || !res.Properties) {
			continue;
		}
		const uri = res.Properties.AuthorizerUri;
		const lambdaId = findLambdaLogicalIdInUri(uri);
		if (lambdaId) {
			out.set(logicalId, lambdaId);
		}
	}
	return out;
}
