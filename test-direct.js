import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MCP_URL = `http://localhost:${process.env.PORT || 13302}/mcp`;

const headers = {
  'Accept': 'application/json, text/event-stream',
  'Content-Type': 'application/json'
};

async function testMCPDirectly() {
  console.log('Testing MCP endpoint directly...\n');

  try {
    // Initialize the session
    console.log('Initializing session...');
    const initResponse = await axios.post(MCP_URL, {
      jsonrpc: '2.0',
      id: 0,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    }, { headers });
    console.log('Initialized:', JSON.stringify(initResponse.data, null, 2));

    // Test 1: List Resources
    console.log('1. Testing listResources...');
    const resourcesResponse = await axios.post(MCP_URL, {
      jsonrpc: '2.0',
      id: 1,
      method: 'resources/list',
      params: {}
    }, { headers });
    console.log('Resources:', JSON.stringify(resourcesResponse.data.result, null, 2));

    // Test 2: List Tools
    console.log('\n2. Testing listTools...');
    const toolsResponse = await axios.post(MCP_URL, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    }, { headers });
    console.log('Tools:', JSON.stringify(toolsResponse.data.result, null, 2));

    // Test 3: Read a resource (if any exist)
    const resources = resourcesResponse.data.result?.resources || [];
    if (resources.length > 0) {
      console.log('\n3. Testing readResource...');
      const resourceUri = resources[0].uri;
      const readResponse = await axios.post(MCP_URL, {
        jsonrpc: '2.0',
        id: 3,
        method: 'resources/read',
        params: { uri: resourceUri }
      }, { headers });
      console.log('Resource content:', JSON.stringify(readResponse.data.result, null, 2));
    }

    // Test 4: Call a tool (if any exist)
    const tools = toolsResponse.data.result?.tools || [];
    if (tools.length > 0) {
      console.log('\n4. Testing callTool...');
      const toolName = tools[0].name;
      const callResponse = await axios.post(MCP_URL, {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: {} // Empty args for testing
        }
      }, { headers });
      console.log('Tool result:', JSON.stringify(callResponse.data.result, null, 2));
    }

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Run the test
testMCPDirectly();
