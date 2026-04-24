import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

import { createDynamoDBClient, errorResponse, getTableName, successResponse } from "./utils.js";

const client = createDynamoDBClient();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
	try {
		const id = event.pathParameters?.id;

		if (!id) {
			return errorResponse(400, "id path parameter is required");
		}

		const tableName = getTableName();

		const result = await client.send(
			new GetItemCommand({
				TableName: tableName,
				Key: { id: { S: id } },
			}),
		);

		if (!result.Item) {
			return errorResponse(404, "Item not found");
		}

		return successResponse({
			id: result.Item.id?.S,
			title: result.Item.title?.S,
			description: result.Item.description?.S,
			createdAt: result.Item.createdAt?.S,
			attachmentKey: result.Item.attachmentKey?.S ?? null,
		});
	} catch (err) {
		console.error("get-item error:", err);
		return errorResponse(500, "Internal server error");
	}
};
