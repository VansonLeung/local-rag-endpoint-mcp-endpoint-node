import axios from 'axios';
import { McpServer } from '@socotra/modelcontextprotocol-sdk/server/mcp.js';
import { buildInputSchema } from './swagger-utils.js';

const paramMapping = {};

export async function loadSwagger(apiBaseUrl, swaggerUrl) {
  console.log('🔄 Loading Swagger spec from:', swaggerUrl);
  try {
    const response = await axios.get(swaggerUrl);
    const swaggerSpec = response.data;
    console.log('✅ Swagger spec loaded successfully. Found', Object.keys(swaggerSpec.paths || {}).length, 'paths');
    return swaggerSpec;
  } catch (error) {
    console.error('❌ Failed to load Swagger spec:', error.message);
    console.log('⚠️ Starting server without tools. Please ensure the API server is running.');
    return { paths: {} }; // Empty spec
  }
}

export function isFileUpload(operation) {
  // Check if requestBody has multipart/form-data
  if (operation.requestBody && operation.requestBody.content) {
    if (operation.requestBody.content['multipart/form-data']) {
      return true;
    }
  }

  // Check if any parameter is a file
  if (operation.parameters) {
    for (const param of operation.parameters) {
      if (param.type === 'file' || (param.schema && param.schema.type === 'string' && param.schema.format === 'binary')) {
        return true;
      }
    }
  }

  return false;
}

export function createMcpServer(swaggerSpec, apiBaseUrl) {
  console.log('🏗️ Creating MCP server instance');
  const server = new McpServer({
    name: 'swagger-mcp-proxy',
    version: '1.0.0',
  });

  if (swaggerSpec) {
    console.log('📋 Processing Swagger paths...');
    let resourceCount = 0;
    let toolCount = 0;

    for (const [path, methods] of Object.entries(swaggerSpec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        const fullPath = path;
        const methodUpper = method.toUpperCase();

        if (methodUpper === 'GET' && fullPath.startsWith('/static')) {
          // Register static GET endpoints as resources
          const resourceUri = `${apiBaseUrl}${fullPath}`;
          const resourceName = `${methodUpper} ${fullPath}`;
          const description = operation.summary || operation.description || `Get data from ${fullPath}`;

          console.log(`📖 Registering resource: ${resourceName} -> ${resourceUri}`);
          console.log(`  - Description: ${description}`);

          server.resource(resourceName, resourceUri, { description }, async (uri) => {
            console.log(`🔍 Reading resource: ${uri.toString()}`);
            // Extract path from URI - uri.pathname already contains the correct path
            const apiPath = uri.pathname + uri.search;
            console.log(`🌐 Making API call to: ${apiBaseUrl}${apiPath}`);

            try {
              const response = await axios.get(`${apiBaseUrl}${apiPath}`);
              console.log(`✅ API call successful, response length: ${JSON.stringify(response.data).length}`);
              return {
                contents: [{
                  uri: uri.toString(),
                  mimeType: 'application/json',
                  text: JSON.stringify(response.data, null, 2)
                }]
              };
            } catch (error) {
              console.error(`❌ API call failed: ${error.message}`);
              throw new Error(`Failed to fetch resource: ${error.message}`);
            }
          });
          resourceCount++;
        } else {
          // Register all other endpoints as tools
          // Check if this operation involves file uploads
          if (isFileUpload(operation)) {
            console.log(`⏭️ Skipping tool registration for file upload endpoint: ${methodUpper} ${fullPath}`);
            continue;
          }

          // Register as tool
          const toolName = `${methodUpper} ${fullPath}`;
          const description = operation.summary || operation.description || `Call ${methodUpper} ${fullPath}`;
          const {
            inputSchema,
            queryParams,
            pathParams,
            bodyParams,
            formParams,
            headerParams,
          } = buildInputSchema(operation, swaggerSpec);

          paramMapping[toolName] = paramMapping[toolName] || {
            method,
            fullPath,
            inputSchema,
            queryParams,
            pathParams,
            bodyParams,
            formParams,
            headerParams,
          };

          console.log(`🔧 Registering tool: ${toolName} ... ${JSON.stringify(operation)}`);
          console.log(`  - Description: ${description}`);
          console.log(`  - Input Schema:`, JSON.stringify(inputSchema, null, 2));
          server.tool(toolName, description, inputSchema, async (args) => {
            console.log(`⚡ Calling tool: ${toolName} with args:`, args);
            return await callApi(method, fullPath, args, apiBaseUrl);
          });
          toolCount++;
        }
      }
    }

    console.log(`✅ Registered ${resourceCount} resources and ${toolCount} tools`);
  }

  return server;
}

export async function callApi(method, path, args, apiBaseUrl) {
  console.log(`🔄 callApi called: ${method} ${path} with args:`, JSON.stringify(args));
  let url = `${apiBaseUrl}${path}`;
  const config = { method: method.toLowerCase() };

  // Handle path parameters
  for (const [key, value] of Object.entries(args)) {
    if (url.includes(`{${key}}`)) {
      url = url.replace(`{${key}}`, value);
      delete args[key];
    }
  }

  let paramMap = paramMapping[`${method.toUpperCase()} ${path}`];

  // Handle query parameters
  const queryParams = {};
  for (const [key, value] of Object.entries(args)) {
    if (key !== 'json') {
      queryParams[key] = value;
      delete args[key];
    }
  }
  if (Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  // Handle body
  if (args.json) {
    config.data = args.json;
    config.headers = { 'Content-Type': 'application/json' };
  }

  console.log(`📡 Making ${method} request to: ${url}`);
  if (config.data) {
    console.log(`📦 Request body:`, JSON.stringify(config.data));
  }

  try {
    const response = await axios(url, config);
    console.log(`✅ API response status: ${response.status}, data length: ${JSON.stringify(response.data).length}`);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
    };
  } catch (error) {
    console.error(`❌ API call failed: ${error.message}`);
    if (error.response) {
      console.error(`❌ Response status: ${error.response.status}, data:`, error.response.data);
    }
    return {
      content: [{ type: 'text', text: `Error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}` }],
      isError: true
    };
  }
}
