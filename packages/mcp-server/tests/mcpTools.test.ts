import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerDeckTools } from '../src/tools/deckTools.ts';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('MCP Server Integration Tests (InMemoryTransport)', () => {
  let tmpBaseDir: string;
  let decksDir: string;
  let publicDecksDir: string;
  let client: Client;
  let server: McpServer;

  beforeAll(async () => {
    tmpBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'localstudio-test-'));
    decksDir = path.join(tmpBaseDir, 'decks');
    publicDecksDir = path.join(tmpBaseDir, 'public');

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    server = new McpServer({
      name: 'localstudio-test',
      version: '1.0.0',
    });

    registerDeckTools(server, {
      decksDir,
      publicDecksDir,
      host: 'http://localhost:4173',
    });

    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });

    await server.server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    try {
      await client.close();
      await server.close();
      await fs.rm(tmpBaseDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('should list all registered LocalStudio tools', async () => {
    const res = await client.listTools();
    const toolNames = res.tools.map((t) => t.name);

    expect(toolNames).toContain('localstudio_create_deck');
    expect(toolNames).toContain('localstudio_add_slide');
    expect(toolNames).toContain('localstudio_list_decks');
    expect(toolNames).toContain('localstudio_get_deck');
    expect(toolNames).toContain('localstudio_get_urls');
  });

  it('should create a new deck and write files to disk', async () => {
    const result = await client.callTool({
      name: 'localstudio_create_deck',
      arguments: {
        name: 'Apresentação de Teste',
        slug: 'test-presentation',
        theme: 'dark-neon',
        title: 'Bem-vindo ao LocalStudio',
        subtitle: 'Slides com IA e Antigravity',
        badge: 'DEMO',
        author: 'Fábio Brasileiro',
      },
    });

    expect(result.isError).toBeFalsy();
    const textContent = (result.content as any[])[0].text;
    const parsed = JSON.parse(textContent);

    expect(parsed.status).toBe('success');
    expect(parsed.deckSlug).toBe('test-presentation');
    expect(parsed.slidesCount).toBe(1);

    // Verify files created on disk in temp dir
    const projectJsonPath = path.join(decksDir, 'test-presentation', 'project.json');
    const localstudioJsonPath = path.join(decksDir, 'test-presentation', 'localstudio.json');
    const publicExportPath = path.join(publicDecksDir, 'test-presentation.json');

    const projectContent = JSON.parse(await fs.readFile(projectJsonPath, 'utf-8'));
    expect(projectContent.name).toBe('Apresentação de Teste');

    const localstudioContent = JSON.parse(await fs.readFile(localstudioJsonPath, 'utf-8'));
    expect(localstudioContent.projectName).toBe('Apresentação de Teste');

    const publicContent = JSON.parse(await fs.readFile(publicExportPath, 'utf-8'));
    expect(publicContent.shareId).toBe('test-presentation');
  });

  it('should add a cards slide to the deck', async () => {
    const result = await client.callTool({
      name: 'localstudio_add_slide',
      arguments: {
        deckSlug: 'test-presentation',
        type: 'cards',
        badge: 'CONCEITOS',
        title: 'Funcionalidades Principais',
        subtitle: 'O que o LocalStudio oferece',
        cardsData: [
          { title: 'Editor Canvas', description: 'Edição livre e camadas vetoriais.' },
          { title: 'Agente MCP', description: 'Geração programática via IA.' },
        ],
        notes: 'Explique que o canvas é 100% editável.',
      },
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content as any[])[0].text);
    expect(parsed.status).toBe('success');
    expect(parsed.slideNumber).toBe(2);
    expect(parsed.totalPages).toBe(2);
  });

  it('should list decks from the workspace', async () => {
    const result = await client.callTool({
      name: 'localstudio_list_decks',
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content as any[])[0].text);
    expect(parsed.total).toBe(1);
    expect(parsed.decks[0].slug).toBe('test-presentation');
    expect(parsed.decks[0].pagesCount).toBe(2);
  });

  it('should get detailed deck stats and speaker notes', async () => {
    const result = await client.callTool({
      name: 'localstudio_get_deck',
      arguments: {
        deckSlug: 'test-presentation',
      },
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content as any[])[0].text);
    expect(parsed.name).toBe('Apresentação de Teste');
    expect(parsed.pagesCount).toBe(2);
    expect(parsed.slides).toHaveLength(2);
    expect(parsed.slides[1].speakerNotes).toBe('Explique que o canvas é 100% editável.');
  });

  it('should return valid editor and presenter URLs', async () => {
    const result = await client.callTool({
      name: 'localstudio_get_urls',
      arguments: {
        deckSlug: 'test-presentation',
      },
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content as any[])[0].text);
    expect(parsed.editorUrl).toContain('http://localhost:4173/editor/?src=/editor/decks/test-presentation.json');
    expect(parsed.presenterUrl).toContain('http://localhost:4173/editor/?share=test-presentation');
  });
});
