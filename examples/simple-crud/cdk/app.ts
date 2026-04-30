import * as cdk from "aws-cdk-lib";
import { SimpleCrudStack } from "./simple-crud-stack";

const app = new cdk.App();

new SimpleCrudStack(app, "SimpleCrudStack", {
	env: {
		account: process.env.CDK_DEFAULT_ACCOUNT ?? "000000000000",
		region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
	},
});

app.synth();
