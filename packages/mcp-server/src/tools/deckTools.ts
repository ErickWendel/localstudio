import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { DeckBuilder, THEMES, type ProjectDocument } from '../domain/deckBuilder.ts';

export interface DeckToolsOptions {
  decksDir?: string;
  publicDecksDir?: string;
  host?: string;
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function saveDeckToDisk(dirPath: string, project: ProjectDocument) {
  await ensureDir(dirPath);
  await ensureDir(path.join(dirPath, 'assets'));
  await ensureDir(path.join(dirPath, 'fonts'));
  await ensureDir(path.join(dirPath, 'recordings'));

  // project.json
  await fs.writeFile(path.join(dirPath, 'project.json'), JSON.stringify(project, null, 2), 'utf-8');

  // localstudio.json config
  const localstudioConfig = {
    schemaVersion: 1,
    projectName: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
  await fs.writeFile(
    path.join(dirPath, 'localstudio.json'),
    JSON.stringify(localstudioConfig, null, 2),
    'utf-8',
  );
}

async function exportDeckForWeb(targetDir: string, deckSlug: string, project: ProjectDocument) {
  await ensureDir(targetDir);
  const sharePayload = {
    schemaVersion: 1,
    shareId: deckSlug,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    project,
  };
  const exportPath = path.join(targetDir, `${deckSlug}.json`);
  await fs.writeFile(exportPath, JSON.stringify(sharePayload, null, 2), 'utf-8');
  return exportPath;
}

export function registerDeckTools(server: McpServer, options: DeckToolsOptions = {}) {
  const decksDir =
    options.decksDir ||
    process.env.LOCALSTUDIO_DECKS_DIR ||
    path.resolve(process.cwd(), 'decks');
  const publicDecksDir =
    options.publicDecksDir ||
    process.env.LOCALSTUDIO_PUBLIC_DIR ||
    path.resolve(process.cwd(), 'apps/editor/public/decks');
  const defaultHost =
    options.host ||
    process.env.LOCALSTUDIO_HOST ||
    'http://localhost:4173';
  // 1. localstudio_create_deck
  server.tool(
    'localstudio_create_deck',
    'Cria uma nova apresentação do LocalStudio com capa estilizada e estrutura salva em disco',
    {
      name: z.string().describe('Nome da apresentação / projeto'),
      slug: z.string().describe('Identificador único em kebab-case (ex: my-first-deck)'),
      theme: z
        .enum(['dark-neon', 'cyber-matrix', 'royal-navy'])
        .default('dark-neon')
        .describe('Tema visual dos slides'),
      title: z.string().describe('Título principal do slide de capa'),
      subtitle: z.string().describe('Subtítulo do slide de capa'),
      badge: z.string().optional().describe('Badge de categoria (ex: ARQUITETURA & DESIGN)'),
      author: z.string().optional().describe('Nome do autor ou palestrante'),
      tags: z
        .array(z.string())
        .optional()
        .describe('Tags da apresentação (ex: ["Java", "DDD", "CleanArchitecture"])'),
      notes: z.string().optional().describe('Notas do palestrante (speaker notes) para a capa'),
    },
    async ({ name, slug, theme, title, subtitle, badge, author, tags, notes }) => {
      try {
        const builder = new DeckBuilder(name, theme);
        builder.addTitleSlide({ badge, title, subtitle, author, tags, notes });
        const project = builder.build();

        const deckDir = path.join(decksDir, slug);
        await saveDeckToDisk(deckDir, project);
        await exportDeckForWeb(publicDecksDir, slug, project);

        const editorUrl = `${defaultHost}/editor/?src=/editor/decks/${slug}.json`;
        const presenterUrl = `${defaultHost}/editor/?share=${slug}&src=/editor/decks/${slug}.json`;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  message: `Apresentação "${name}" criada com sucesso!`,
                  deckSlug: slug,
                  deckPath: deckDir,
                  slidesCount: project.pages.length,
                  urls: {
                    editor: editorUrl,
                    presenter: presenterUrl,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Erro ao criar apresentação: ${err.message}` }],
          isError: true,
        };
      }
    },
  );

  // 2. localstudio_add_slide
  server.tool(
    'localstudio_add_slide',
    'Adiciona um novo slide estruturado a uma apresentação existente do LocalStudio',
    {
      deckSlug: z.string().describe('Slug da apresentação (ex: my-first-deck)'),
      badge: z.string().describe('Badge de categoria no cabeçalho do slide (ex: CONCEITO, CÓDIGO)'),
      title: z.string().describe('Título do slide'),
      subtitle: z.string().optional().describe('Subtítulo do cabeçalho'),
      type: z
        .enum(['cards', 'split', 'code', 'architecture', 'summary'])
        .describe('Tipo de layout do slide'),
      cardsData: z
        .array(
          z.object({
            title: z.string(),
            description: z.string(),
            highlight: z.string().optional(),
            accentColor: z.string().optional(),
          }),
        )
        .optional()
        .describe('Dados para slide do tipo "cards" (2 a 4 cards)'),
      splitData: z
        .object({
          left: z.object({ title: z.string(), items: z.array(z.string()) }),
          right: z.object({ title: z.string(), items: z.array(z.string()) }),
        })
        .optional()
        .describe('Dados para slide do tipo "split" (comparativo lado a lado)'),
      codeData: z
        .object({
          explanation: z.array(z.string()),
          codeTitle: z.string(),
          code: z.string(),
        })
        .optional()
        .describe('Dados para slide do tipo "code" (código com destaques)'),
      architectureData: z
        .object({
          layers: z.array(
            z.object({
              name: z.string(),
              subtitle: z.string(),
              color: z.string(),
              components: z.array(z.string()),
            }),
          ),
        })
        .optional()
        .describe('Dados para slide do tipo "architecture" (camadas arquiteturais)'),
      summaryData: z
        .object({
          takeaways: z.array(
            z.object({
              title: z.string(),
              detail: z.string(),
            }),
          ),
        })
        .optional()
        .describe('Dados para slide do tipo "summary" (conclusões e boas práticas)'),
      notes: z.string().optional().describe('Notas do palestrante (speaker notes) para este slide'),
    },
    async ({
      deckSlug,
      badge,
      title,
      subtitle,
      type,
      cardsData,
      splitData,
      codeData,
      architectureData,
      summaryData,
      notes,
    }) => {
      try {
        const deckDir = path.join(decksDir, deckSlug);
        const projectPath = path.join(deckDir, 'project.json');
        const raw = await fs.readFile(projectPath, 'utf-8');
        const project: ProjectDocument = JSON.parse(raw);

        // Usamos o DeckBuilder para reconstruir e injetar o novo slide
        const builder = new DeckBuilder(project.name);
        // Restaura projeto existente
        (builder as any).project = project;
        (builder as any).pageCounter = project.pages.length;
        (builder as any).elementCounter = Object.keys(project.elements).length;

        if (type === 'cards' && cardsData) {
          builder.addCardsSlide({ badge, title, subtitle, cards: cardsData, notes });
        } else if (type === 'split' && splitData) {
          builder.addSplitSlide({
            badge,
            title,
            subtitle,
            left: splitData.left,
            right: splitData.right,
            notes,
          });
        } else if (type === 'code' && codeData) {
          builder.addCodeSlide({
            badge,
            title,
            subtitle,
            explanation: codeData.explanation,
            codeTitle: codeData.codeTitle,
            code: codeData.code,
            notes,
          });
        } else if (type === 'architecture' && architectureData) {
          builder.addArchitectureSlide({
            badge,
            title,
            subtitle,
            layers: architectureData.layers,
            notes,
          });
        } else if (type === 'summary' && summaryData) {
          builder.addSummarySlide({
            badge,
            title,
            subtitle,
            takeaways: summaryData.takeaways,
            notes,
          });
        } else {
          throw new Error(`Dados incompatíveis ou ausentes para o layout "${type}".`);
        }

        const updatedProject = builder.build();
        await saveDeckToDisk(deckDir, updatedProject);
        await exportDeckForWeb(publicDecksDir, deckSlug, updatedProject);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  message: `Slide "${title}" (${type}) adicionado com sucesso!`,
                  deckSlug,
                  slideNumber: updatedProject.pages.length,
                  totalPages: updatedProject.pages.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Erro ao adicionar slide: ${err.message}` }],
          isError: true,
        };
      }
    },
  );

  // 3. localstudio_list_decks
  server.tool(
    'localstudio_list_decks',
    'Lista as apresentações criadas no workspace de slides',
    {},
    async () => {
      try {
        await ensureDir(decksDir);
        const entries = await fs.readdir(decksDir, { withFileTypes: true });
        const decks: any[] = [];

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const projectPath = path.join(decksDir, entry.name, 'project.json');
            try {
              const raw = await fs.readFile(projectPath, 'utf-8');
              const proj = JSON.parse(raw);
              decks.push({
                slug: entry.name,
                name: proj.name,
                pagesCount: proj.pages?.length ?? 0,
                updatedAt: proj.updatedAt,
                editorUrl: `${defaultHost}/editor/?src=/editor/decks/${entry.name}.json`,
                presenterUrl: `${defaultHost}/editor/?share=${entry.name}&src=/editor/decks/${entry.name}.json`,
              });
            } catch {
              // Ignore non-project directory
            }
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ total: decks.length, decks }, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Erro ao listar apresentações: ${err.message}` }],
          isError: true,
        };
      }
    },
  );

  // 4. localstudio_get_deck
  server.tool(
    'localstudio_get_deck',
    'Obtém detalhes, slides, estatísticas e speaker notes de uma apresentação',
    {
      deckSlug: z.string().describe('Slug da apresentação (ex: my-first-deck)'),
    },
    async ({ deckSlug }) => {
      try {
        const projectPath = path.join(decksDir, deckSlug, 'project.json');
        const raw = await fs.readFile(projectPath, 'utf-8');
        const proj: ProjectDocument = JSON.parse(raw);

        const summary = {
          id: proj.id,
          name: proj.name,
          pagesCount: proj.pages.length,
          totalElements: Object.keys(proj.elements).length,
          slides: proj.pages.map((p, idx) => ({
            slideNumber: idx + 1,
            id: p.id,
            name: p.name,
            elementCount: p.elementIds.length,
            hasNotes: Boolean(p.speakerNotes),
            speakerNotes: p.speakerNotes,
          })),
          editorUrl: `${defaultHost}/editor/?src=/editor/decks/${deckSlug}.json`,
          presenterUrl: `${defaultHost}/editor/?share=${deckSlug}&src=/editor/decks/${deckSlug}.json`,
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Erro ao ler apresentação: ${err.message}` }],
          isError: true,
        };
      }
    },
  );

  // 5. localstudio_get_urls
  server.tool(
    'localstudio_get_urls',
    'Retorna links prontos para abrir o editor e modo apresentação no LocalStudio',
    {
      deckSlug: z.string().describe('Slug da apresentação (ex: my-first-deck)'),
    },
    async ({ deckSlug }) => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                deckSlug,
                editorUrl: `${defaultHost}/editor/?src=/editor/decks/${deckSlug}.json`,
                presenterUrl: `${defaultHost}/editor/?share=${deckSlug}&src=/editor/decks/${deckSlug}.json`,
                rawJsonUrl: `${defaultHost}/editor/decks/${deckSlug}.json`,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
