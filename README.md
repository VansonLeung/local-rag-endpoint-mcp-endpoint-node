# MCP API Proxy Server

This project creates an MCP (Model Context Protocol) endpoint that proxies your REST API, automatically separating endpoints into Resources and Tools based on HTTP methods.

## Features

- **Resources**: GET endpoints starting with `/static` become readable resources
- **Tools**: All other endpoints (GET/POST/PUT/DELETE/PATCH) become callable tools (except file upload endpoints)
- **Auto-discovery**: Automatically loads endpoints from Swagger/OpenAPI spec
- **MCP Protocol**: Full MCP compliance for LLM integration

## Setup

1. Ensure your API server is running on port 13301
2. Make sure the Swagger spec is available at `http://localhost:13301/swagger.json`
3. Copy `.env.example` to `.env` and configure as needed

## Environment Variables

- `PORT`: Port for the MCP server (default: 13302)

## Running

### Terminal 1 - Start Server
```bash
npm start
```

### Terminal 2 - Test Client
```bash
node test-client.js
```

## API Structure

The server will automatically categorize your endpoints:

**Resources (static content):**
- GET endpoints starting with `/static`
- Listed via `listResources()`
- Read via `readResource(uri)`

**Tools (all other endpoints):**
- Listed via `listTools()`
- Called via `callTool(name, arguments)`
- Support query parameters, path parameters, and request body (for non-GET methods)

## Example

If your API has:
- `GET /static/logo.png` → Resource: `api://localhost:13301/static/logo.png`
- `GET /api/users` → Tool: `GET /api/users`
- `POST /api/users` → Tool: `POST /api/users`
- `GET /api/users/{id}` → Tool: `GET /api/users/{id}` (has parameters)

## Integration

Connect any MCP-compatible client (Claude Desktop, etc.) to:
```
http://localhost:{PORT}/mcp
```

Where `{PORT}` is the port configured in your `.env` file (default: 13302).
