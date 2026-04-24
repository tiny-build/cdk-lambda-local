import type {
	APIGatewayAuthorizerResult,
	APIGatewayRequestAuthorizerEvent,
	APIGatewayTokenAuthorizerEvent,
} from "aws-lambda";

const VALID_TOKEN = "my-secret-token";

type AuthorizerEvent = APIGatewayTokenAuthorizerEvent | APIGatewayRequestAuthorizerEvent;

function extractToken(event: AuthorizerEvent): string | undefined {
	if ("authorizationToken" in event) {
		return event.authorizationToken?.replace(/^Bearer\s+/i, "");
	}
	const header = event.headers?.authorization ?? event.headers?.Authorization;
	return header?.replace(/^Bearer\s+/i, "");
}

export const handler = async (event: AuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
	const token = extractToken(event);

	const effect = token === VALID_TOKEN ? "Allow" : "Deny";

	return {
		principalId: effect === "Allow" ? "user" : "anonymous",
		policyDocument: {
			Version: "2012-10-17",
			Statement: [
				{
					Action: "execute-api:Invoke",
					Effect: effect,
					Resource: event.methodArn,
				},
			],
		},
	};
};
