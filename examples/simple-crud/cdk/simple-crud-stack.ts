import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

export class SimpleCrudStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		const stage = this.node.tryGetContext("stage") ?? "dev";
		const tableName = `Items-${stage}`;
		const bucketName = `attachments-bucket-${stage}`;

		const table = new dynamodb.Table(this, "ItemsTable", {
			tableName,
			partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
			billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		});

		const bucket = new s3.Bucket(this, "AttachmentsBucket", {
			bucketName,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
			autoDeleteObjects: true,
		});

		const lambdaEnvironment: Record<string, string> = {
			TABLE_NAME: tableName,
			BUCKET_NAME: bucketName,
			AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL ?? "",
		};

		const lambdasDir = join(__dirname, "..", "lambdas");

		const createItemFn = new lambda.NodejsFunction(this, "CreateItemFn", {
			entry: join(lambdasDir, "create-item.ts"),
			handler: "handler",
			runtime: Runtime.NODEJS_22_X,
			environment: lambdaEnvironment,
		});

		const getItemFn = new lambda.NodejsFunction(this, "GetItemFn", {
			entry: join(lambdasDir, "get-item.ts"),
			handler: "handler",
			runtime: Runtime.NODEJS_22_X,
			environment: lambdaEnvironment,
		});

		const uploadAttachmentFn = new lambda.NodejsFunction(this, "UploadAttachmentFn", {
			entry: join(lambdasDir, "upload-attachment.ts"),
			handler: "handler",
			runtime: Runtime.NODEJS_22_X,
			environment: lambdaEnvironment,
		});

		table.grantReadWriteData(createItemFn);
		table.grantReadData(getItemFn);
		table.grantReadWriteData(uploadAttachmentFn);
		bucket.grantPut(uploadAttachmentFn);

		const authorizerFn = new lambda.NodejsFunction(this, "AuthorizerFn", {
			entry: join(lambdasDir, "authorizer.ts"),
			handler: "handler",
			runtime: Runtime.NODEJS_22_X,
		});

		const tokenAuthorizer = new apigateway.TokenAuthorizer(this, "TokenAuthorizer", {
			handler: authorizerFn,
			identitySource: "method.request.header.Authorization",
		});

		const api = new apigateway.RestApi(this, "SimpleCrudApi", {
			restApiName: `simple-crud-${stage}`,
			deployOptions: { stageName: stage },
		});

		const items = api.root.addResource("items");

		items.addMethod("POST", new apigateway.LambdaIntegration(createItemFn), {
			authorizer: tokenAuthorizer,
		});

		const item = items.addResource("{id}");

		item.addMethod("GET", new apigateway.LambdaIntegration(getItemFn));

		const attachment = item.addResource("attachment");

		attachment.addMethod("POST", new apigateway.LambdaIntegration(uploadAttachmentFn), {
			authorizer: tokenAuthorizer,
		});
	}
}
