import { findLambdaLogicalIdInUri } from "../utils/cfn-uri";
import { type CfnResources, isRef } from "./cfn-types";
import { buildApiGatewayResourcePaths } from "./parse-api-gateway-paths";

/** An API Gateway method extracted from a CloudFormation template. */
export interface ParsedMethod {
	/** HTTP method in upper-case (e.g. `"GET"`). */
	readonly httpMethod: string;
	/** Full API Gateway path pattern (e.g. `"/users/{id}"`). */
	readonly path: string;
	/** CloudFormation logical ID of the Lambda backing this method. */
	readonly lambdaLogicalId: string;
	/** CloudFormation logical ID of the custom authorizer, or `null` if none. */
	readonly authorizerLogicalId: string | null;
}

/**
 * Scans CloudFormation resources and returns all `AWS::ApiGateway::Method` entries
 * that use `AWS_PROXY` integration, resolved to their full paths.
 */
export function parseApiGatewayMethods(resources: CfnResources): ParsedMethod[] {
	const paths = buildApiGatewayResourcePaths(resources);
	const out: ParsedMethod[] = [];

	for (const [, res] of Object.entries(resources)) {
		if (res?.Type !== "AWS::ApiGateway::Method" || !res.Properties) continue;
		const props = res.Properties;
		const integration = props.Integration as Record<string, unknown> | undefined;
		if (!integration || integration.Type !== "AWS_PROXY") continue;

		const lambdaLogicalId = findLambdaLogicalIdInUri(integration.Uri);
		if (!lambdaLogicalId) continue;

		const resourceRef = props.ResourceId;
		if (!isRef(resourceRef)) continue;
		const path = paths.get(resourceRef.Ref);
		if (!path) continue;

		const httpMethod = props.HttpMethod;
		if (typeof httpMethod !== "string") continue;

		const authType = props.AuthorizationType;
		let authorizerLogicalId: string | null = null;
		if (authType === "CUSTOM") {
			const authRef = props.AuthorizerId;
			if (isRef(authRef)) authorizerLogicalId = authRef.Ref;
		}

		out.push({ httpMethod, path, lambdaLogicalId, authorizerLogicalId });
	}

	return out;
}
