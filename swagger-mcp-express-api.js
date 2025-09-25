import express from 'express';
import { StreamableHTTPServerTransport } from '@socotra/modelcontextprotocol-sdk/server/streamableHttp.js';
import cors from 'cors';
import { createMcpServer } from './swagger-mcp.js';

export function createExpressApp(swaggerSpec, apiBaseUrl) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const transports = {};

  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    console.log(`📨 Incoming MCP request - Session: ${sessionId || 'new'}, Method: ${req.body?.method}, ID: ${req.body?.id}`);

    try {
      let transport;
      if (sessionId && transports[sessionId]) {
        console.log(`🔄 Reusing existing transport for session: ${sessionId}`);
        transport = transports[sessionId];
      } else {
        console.log(`🆕 Creating new transport${sessionId ? ` for session: ${sessionId}` : ''}`);
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => Math.random().toString(36).substring(7),
          onsessioninitialized: (sid) => {
            console.log(`🎯 Session initialized: ${sid}`);
            transports[sid] = transport;
          }
        });
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            console.log(`👋 Transport closed for session ${sid}, cleaning up`);
            delete transports[sid];
          }
        };
        const server = createMcpServer(swaggerSpec, apiBaseUrl);
        console.log(`🔗 Connecting server to transport`);
        await server.connect(transport);
      }

      console.log(`⚙️ Handling request with transport`);
      await transport.handleRequest(req, res, req.body);
      console.log(`✅ Request handled successfully`);
    } catch (error) {
      console.error('❌ Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null
        });
      }
    }
  });

  return app;
}

export function startServer(app, port, apiBaseUrl) {
  app.listen(port, () => {
    console.log(`🚀 MCP proxy server listening on port ${port}`);
    console.log('📡 Endpoint: http://localhost:' + port + '/mcp');
    console.log('🔗 API Base URL:', apiBaseUrl);
  });
}
