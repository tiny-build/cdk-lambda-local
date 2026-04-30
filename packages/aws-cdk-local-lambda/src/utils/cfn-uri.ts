/**
 * Extracts the Lambda logical resource ID from a CloudFormation `AuthorizerUri` or `Integration.Uri` value.
 *
 * Handles both `Fn::GetAtt: [LogicalId, Arn]` and `Fn::Join` intrinsics. Returns `null` if no ID is found.
 */
export function findLambdaLogicalIdInUri(uri: unknown): string | null {
	if (uri === null || uri === undefined) return null;

	if (typeof uri === "object" && "Fn::GetAtt" in uri) {
		const getAtt = (uri as { "Fn::GetAtt": unknown })["Fn::GetAtt"];
		if (
			Array.isArray(getAtt) &&
			getAtt.length === 2 &&
			typeof getAtt[0] === "string" &&
			getAtt[1] === "Arn"
		) {
			return getAtt[0];
		}
	}

	if (typeof uri === "object" && uri !== null && "Fn::Join" in uri) {
		const joinVal = (uri as { "Fn::Join": unknown })["Fn::Join"];
		const parts = Array.isArray(joinVal) ? joinVal[1] : undefined;
		if (Array.isArray(parts)) {
			for (const part of parts) {
				const id = findLambdaLogicalIdInUri(part);
				if (id) return id;
			}
		}
	}

	return null;
}
