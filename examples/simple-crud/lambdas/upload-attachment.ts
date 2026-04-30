import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

import {
	createDynamoDBClient,
	createS3Client,
	errorResponse,
	getBucketName,
	getTableName,
	successResponse,
} from "./utils";

const dynamodb = createDynamoDBClient();
const s3 = createS3Client();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
	try {
		const id = event.pathParameters?.id;

		if (!id) {
			return errorResponse(400, "id path parameter is required");
		}

		const body = JSON.parse(event.body ?? "{}") as {
			filename?: string;
			content?: string;
		};

		if (!body.filename || !body.content) {
			return errorResponse(400, "filename and content are required");
		}

		const s3Key = `${id}/${body.filename}`;
		const bucketName = getBucketName();
		const tableName = getTableName();

		await s3.send(
			new PutObjectCommand({
				Bucket: bucketName,
				Key: s3Key,
				Body: body.content,
				ContentType: "text/plain",
			}),
		);

		await dynamodb.send(
			new UpdateItemCommand({
				TableName: tableName,
				Key: { id: { S: id } },
				UpdateExpression: "SET attachmentKey = :key",
				ExpressionAttributeValues: { ":key": { S: s3Key } },
			}),
		);

		return successResponse({ s3Key });
	} catch (err) {
		console.error("upload-attachment error:", err);
		return errorResponse(500, "Internal server error");
	}
};
