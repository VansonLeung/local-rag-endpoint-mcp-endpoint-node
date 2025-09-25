import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testMCPClient() {
  // Create MCP client
  const client = new Client({ 
    name: 'test-client',
    version: '1.0.0',
  });

  // Connect to the MCP server
  const transport = new StreamableHTTPClientTransport(new URL(`http://localhost:${process.env.PORT || 13302}/mcp`));
  await client.connect(transport);

  console.log('Connected to MCP server');

  // List available resources (GET endpoints)
  // const resources = await client.listResources();
  // console.log('Available resources:');
  // resources.resources.forEach(r => {
  //   console.log(`  - Name: ${r.name}`);
  //   console.log(`    URI: ${r.uri}`);
  //   console.log(`    Description: ${r.description || 'No description'}`);
  //   console.log('');
  // });

  // List available tools (non-GET endpoints)
  const tools = await client.listTools();
  console.log('Available tools:');
  tools.tools.forEach(t => {
    console.log(`  - Name: ${t.name}  ...  ${JSON.stringify(t)}`);
    console.log(`    Description: ${t.description || 'No description'}`);
    console.log(`    Parameters:`);
    if (t.inputSchema && t.inputSchema.properties) {
      Object.entries(t.inputSchema.properties).forEach(([paramName, paramDef]) => {
        const required = t.inputSchema.required && t.inputSchema.required.includes(paramName) ? ' (required)' : '';
        console.log(`      - ${paramName}: ${paramDef.type || 'unknown'}${required}`);
        if (paramDef.description) {
          console.log(`        Description: ${paramDef.description}`);
        }
      });
    } else {
      console.log(`      No parameters defined`);
    }
    if (t.annotations && t.annotations.properties) {
      Object.entries(t.annotations.properties).forEach(([paramName, paramDef]) => {
        const required = t.annotations.required && t.annotations.required.includes(paramName) ? ' (required)' : '';
        console.log(`      - ${paramName}: ${paramDef.type || 'unknown'}${required}`);
        if (paramDef.description) {
          console.log(`        Description: ${paramDef.description}`);
        }
      });
    } else {
      console.log(`      No parameters defined`);
    }
    console.log(`    Response Format: JSON text`);
    console.log('');
  });

  // Read a resource (if any exist)
  // if (resources.resources.length > 0) {
  //   const resourceUri = resources.resources[0].uri;
  //   console.log(`Reading resource: ${resourceUri}`);
  //   try {
  //     const resourceContent = await client.readResource(resourceUri);
  //     console.log('Resource content:', resourceContent.contents[0].text.substring(0, 200) + '...');
  //   } catch (error) {
  //     console.error('Error reading resource:', error.message);
  //   }
  // }

  // Call a tool (if any exist)
  if (tools.tools.length > 0) {
    for (var k in tools.tools) {
      const tool = tools.tools[k];
      console.log(k, tool.name);
      console.log(tool.inputSchema);
      console.log(tool.annotations);
      console.log('');

      const toolName = tool.name;
      console.log(`Calling tool: ${toolName}`);

      let toolArgs = {};

      if (toolName === 'POST /api/download') {
        toolArgs = { 
          json: {
            fileUrl: "https://pdfobject.com/pdf/sample.pdf"
          }
        };
      }


      try {
        const result = await client.callTool({
          name: toolName,
          arguments: toolArgs
        });
        console.log('Tool result:', result.content[0]?.text?.substring(0, 200) + '...');
      } catch (error) {
        console.error('Error calling tool:', error.message);
      }
    }
  }

  // Close connection
  await client.close();
  console.log('Disconnected from MCP server');
}

testMCPClient().catch(console.error);
