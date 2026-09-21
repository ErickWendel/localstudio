#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerDeckTools } from './tools/deckTools.ts';

const server = new McpServer({
  name: 'localstudio',
  version: '1.0.0',
});

// Registra ferramentas modulares do LocalStudio
registerDeckTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[localstudio-mcp] Servidor MCP iniciado via Stdio (Node >= 24 Native TS)');
}

main().catch((err) => {
  console.error('[localstudio-mcp] Erro fatal:', err);
  process.exit(1);
});
