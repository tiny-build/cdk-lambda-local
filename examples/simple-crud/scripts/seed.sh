#!/usr/bin/env bash
set -euo pipefail

ENDPOINT="http://localhost:4566"
REGION="us-east-1"

export AWS_DEFAULT_REGION="$REGION"
export AWS_ACCESS_KEY_ID="test"
export AWS_SECRET_ACCESS_KEY="test"

echo "Waiting for Floci to be ready..."
until aws s3 ls --endpoint-url "$ENDPOINT" > /dev/null 2>&1; do
  sleep 1
done
echo "Floci is ready."

echo "Creating DynamoDB table: Items-dev"
aws dynamodb create-table \
  --table-name Items-dev \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url "$ENDPOINT" \
  2>/dev/null || echo "  (table already exists)"

echo "Creating S3 bucket: attachments-bucket-dev"
aws s3 mb "s3://attachments-bucket-dev" \
  --endpoint-url "$ENDPOINT" \
  2>/dev/null || echo "  (bucket already exists)"

echo "Seed complete."
