import type { APIGatewayProxyResult } from "aws-lambda";
import type { Response } from "express";

export function sendProxyResult(res: Response, result: APIGatewayProxyResult | undefined): void {
	if (!result) {
		res.status(502).send("Empty Lambda response");
		return;
	}
	res.status(result.statusCode ?? 200);
	const headers = result.headers ?? {};
	for (const [k, v] of Object.entries(headers)) {
		if (v !== undefined) res.setHeader(k, String(v));
	}
	const body = result.body ?? "";
	if (result.isBase64Encoded) {
		res.send(Buffer.from(body, "base64"));
	} else {
		res.send(body);
	}
}
