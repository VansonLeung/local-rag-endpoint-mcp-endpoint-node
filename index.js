import dotenv from 'dotenv';
import { loadSwagger } from './swagger-mcp.js';
import { createExpressApp, startServer } from './swagger-mcp-express-api.js';

// Load environment variables
dotenv.config();

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:13301';
const swaggerUrl = process.env.SWAGGER_URL || `${apiBaseUrl}/swagger.json`;
let swaggerSpec = null;

async function main() {
  swaggerSpec = await loadSwagger(apiBaseUrl, swaggerUrl);

  const app = createExpressApp(swaggerSpec, apiBaseUrl);
  const port = process.env.PORT || 13302;

  startServer(app, port, apiBaseUrl);
}

main().catch(console.error);
