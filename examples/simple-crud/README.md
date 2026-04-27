# Simple CRUD Example

A self-contained example demonstrating `cdk-local-lambda` with:

- **API Gateway** with 3 routes
- **3 Lambda handlers** (create, get, upload attachment)
- **1 Lambda token authorizer** on write routes
- **DynamoDB** for data storage
- **S3** for file attachments
- **Floci** for local AWS emulation

## Prerequisites

- Node.js >= 22
- pnpm >= 10
- Docker (for Floci)
- AWS CLI (for seeding)

## Setup

From the **monorepo root**:

```bash
pnpm install
```

## Running

```bash
cd examples/simple-crud

# 1. Start Floci (local AWS emulator)
docker compose up -d

# 2. Seed DynamoDB table and S3 bucket
pnpm run seed

# 3. Start everything in one go
pnpm run dev
```

The server starts on `http://localhost:3001`.

### What `dev` does

`dev` is shorthand for `manifest` + `serve`:

- **`manifest`** — runs CDK synth (produces `cdk.out/`), then extract (reads `cdk.out/` and writes `manifest.json`). This is the single command to run after any infra change.
- **`serve`** — reads `manifest.json` and starts the Express server with hot-reload.

### When to re-run what

| What changed | Command |
|---|---|
| Routes, env vars, authorizer config — anything in `cdk/` | `pnpm run manifest` then `pnpm run serve` |
| Handler code only (Lambda `.ts` files) | nothing — hot-reload picks it up automatically |
| Everything from scratch | `pnpm run dev` |


The manifest is written to `examples/simple-crud/manifest.json`. To start the server against an existing manifest without re-synthesizing:

```bash
pnpm run serve
```

### Hot reload

While `serve` is running, any changes you make to a Lambda handler file are applied immediately—no restart is required.

For example, if you edit `lambdas/get-item.ts` and add:

```ts
console.log("hot reload is working!")
```

then check the logs. You will see that only the **get-item handler** is reloaded, not any other handlers.


Hot reload does **not** pick up infra changes (routes, environment variables, authorizer config). Those live in `cdk/` and require `pnpm run manifest` followed by restarting `serve`.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/items` | ✅ Bearer token | Create an item |
| GET | `/items/{id}` | ❌ None | Get an item by ID |
| POST | `/items/{id}/attachment` | ✅ Bearer token | Upload a text attachment |

**Auth token:** `Bearer my-secret-token`

## Testing with Bruno

Open the `bruno/simple-crud/` collection in [Bruno](https://www.usebruno.com/).

1. Select the **local** environment
2. Run **Create Item** → copy the returned `id`
3. Set `itemId` in environment variables to the copied `id`
4. Run **Get Item** → see the created item
5. Run **Upload Attachment** → attach a file
6. Run **Get Item** again → see the `attachmentKey` field
7. Run **Create Item Unauthorized** → see 401/403 response

## Testing with curl

```bash
# Create an item
curl -X POST http://localhost:3001/items \
  -H "Authorization: Bearer my-secret-token" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test item", "description": "Hello world"}'

# Get an item (replace <id> with the returned id)
curl http://localhost:3001/items/<id>

# Upload attachment
curl -X POST http://localhost:3001/items/<id>/attachment \
  -H "Authorization: Bearer my-secret-token" \
  -H "Content-Type: application/json" \
  -d '{"filename": "notes.txt", "content": "My attachment"}'

# Unauthorized request (should fail)
curl -X POST http://localhost:3001/items \
  -H "Content-Type: application/json" \
  -d '{"title": "Should fail"}'
```

## Cleanup

```bash
docker compose down -v
```
