import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { S3Client as S3ClientType } from "@aws-sdk/client-s3";
import type { APIGatewayProxyResult } from "aws-lambda";

const awsOverrides = process.env.AWS_ENDPOINT_URL
	? {
			endpoint: process.env.AWS_ENDPOINT_URL,
			credentials: { accessKeyId: "test", secretAccessKey: "test" },
			region: "us-east-1",
			forcePathStyle: true,
		}
	: {};

export function createDynamoDBClient(): DynamoDBClient {
	return new DynamoDBClient(awsOverrides);
}

export function createS3Client(): S3ClientType {
	return new (require("@aws-sdk/client-s3").S3Client)(awsOverrides);
}

export function errorResponse(statusCode: number, message: string): APIGatewayProxyResult {
	return {
		statusCode,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ error: message }),
	};
}

export function successResponse<T extends Record<string, unknown>>(
	data: T,
	statusCode = 200,
): APIGatewayProxyResult {
	return {
		statusCode,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	};
}

export function getTableName(): string {
	return process.env.TABLE_NAME ?? "Items";
}

export function getBucketName(): string {
	return process.env.BUCKET_NAME ?? "attachments-bucket";
}
