import { randomUUID } from "node:crypto";

import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

import { createDynamoDBClient, errorResponse, getTableName, successResponse } from "./utils";

const client = createDynamoDBClient();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
	try {
		const body = JSON.parse(event.body ?? "{}") as {
			title?: string;
			description?: string;
		};

		if (!body.title) {
			return errorResponse(400, "title is required");
		}

		const id = randomUUID();
		const now = new Date().toISOString();
		const tableName = getTableName();

		await client.send(
			new PutItemCommand({
				TableName: tableName,
				Item: {
					id: { S: id },
					title: { S: body.title },
					description: { S: body.description ?? "" },
					createdAt: { S: now },
				},
			}),
		);

		return successResponse(
			{
				id,
				title: body.title,
				description: body.description ?? "",
				createdAt: now,
			},
			201,
		);
	} catch (err) {
		console.error("create-item error:", err);
		return errorResponse(500, "Internal server error");
	}
};
