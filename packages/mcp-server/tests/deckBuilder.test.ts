import { describe, expect, it } from 'vitest';
import { DeckBuilder, THEMES } from '../src/domain/deckBuilder.ts';

describe('DeckBuilder Unit Tests', () => {
  it('should initialize with project name and default dark-neon theme', () => {
    const builder = new DeckBuilder('Test Presentation');
    const doc = builder.build();

    expect(doc.id).toMatch(/^proj-/);
    expect(doc.name).toBe('Test Presentation');
    expect(doc.pages).toHaveLength(0);
    expect(Object.keys(doc.elements)).toHaveLength(0);
  });

  it('should support alternative themes like cyber-matrix and royal-navy', () => {
    const matrixTheme = THEMES['cyber-matrix']!;
    const matrixBuilder = new DeckBuilder('Matrix Deck', 'cyber-matrix');
    expect(matrixBuilder.theme.id).toBe('cyber-matrix');
    expect(matrixBuilder.theme.accent).toBe(matrixTheme.accent);

    const navyTheme = THEMES['royal-navy']!;
    const navyBuilder = new DeckBuilder('Navy Deck', 'royal-navy');
    expect(navyBuilder.theme.id).toBe('royal-navy');
    expect(navyBuilder.theme.accent).toBe(navyTheme.accent);
  });

  it('should create title slide with metadata, badge, tags, and speaker notes', () => {
    const builder = new DeckBuilder('Title Test');
    builder.addTitleSlide({
      title: 'Construindo Agentes com Antigravity',
      subtitle: 'Arquitetura Autônoma e MCP',
      badge: 'IA AVANÇADA',
      author: 'Fábio Brasileiro',
      tags: ['AI', 'Antigravity', 'MCP'],
      notes: 'Slide de abertura: dar boas-vindas aos participantes.',
    });

    const doc = builder.build();
    expect(doc.pages).toHaveLength(1);
    const page = doc.pages[0]!;
    expect(page.name).toBe('Construindo Agentes com Antigravity');
    expect(page.speakerNotes).toBe('Slide de abertura: dar boas-vindas aos participantes.');
    expect(page.elementIds.length).toBeGreaterThanOrEqual(4);
  });

  it('should create cards slide with multi-column layout', () => {
    const builder = new DeckBuilder('Cards Test');
    builder.addCardsSlide({
      badge: 'CONCEITOS',
      title: 'Pilares de Soluções Modernas',
      subtitle: 'Estrutura fundamental',
      cards: [
        {
          title: 'Resiliência',
          description: 'Sistemas que se recuperam automaticamente de falhas transitórias.',
          highlight: 'Alta Disponibilidade',
        },
        {
          title: 'Escalabilidade',
          description: 'Capacidade de crescer horizontalmente sob demanda.',
          highlight: 'Auto Scaling',
        },
      ],
      notes: 'Focar na diferença entre resiliência e redundância.',
    });

    const doc = builder.build();
    expect(doc.pages).toHaveLength(1);
    const page = doc.pages[0]!;
    expect(page.name).toBe('Pilares de Soluções Modernas');
    expect(page.speakerNotes).toBe('Focar na diferença entre resiliência e redundância.');
  });

  it('should create split comparison slide', () => {
    const builder = new DeckBuilder('Split Test');
    builder.addSplitSlide({
      badge: 'COMPARATIVO',
      title: 'Monólito vs Microsserviços',
      subtitle: 'Trade-offs arquiteturais',
      left: {
        title: 'Monólito Tradicional',
        items: ['Deploy unificado', 'Simplicidade inicial', 'Acoplamento forte'],
      },
      right: {
        title: 'Microsserviços',
        items: ['Deploy independente', 'Complexidade distribuída', 'Escalabilidade seletiva'],
      },
      notes: 'Enfatizar que microsserviços não são bala de prata.',
    });

    const doc = builder.build();
    expect(doc.pages).toHaveLength(1);
    const page = doc.pages[0]!;
    expect(page.elementIds.length).toBeGreaterThanOrEqual(5);
  });

  it('should create code snippet slide with explanations', () => {
    const builder = new DeckBuilder('Code Test');
    builder.addCodeSlide({
      badge: 'CÓDIGO',
      title: 'Definição de Ferramenta MCP',
      subtitle: 'Implementação com TypeScript',
      codeTitle: 'server.tool.ts',
      code: 'server.tool("minha_tool", "descrição", {}, async () => ({}));',
      explanation: [
        'Registro declarativo da ferramenta',
        'Validação de schema via Zod',
        'Execução assíncrona desacoplada',
      ],
      notes: 'Demonstrar facilidade de integração.',
    });

    const doc = builder.build();
    expect(doc.pages).toHaveLength(1);
    const page = doc.pages[0]!;
    expect(page.elementIds.length).toBeGreaterThanOrEqual(4);
  });

  it('should create architecture layers slide', () => {
    const builder = new DeckBuilder('Arch Test');
    builder.addArchitectureSlide({
      badge: 'ARQUITETURA',
      title: 'Camadas do Sistema',
      subtitle: 'Clean Architecture',
      layers: [
        {
          name: 'Domínio',
          subtitle: 'Regras de negócio',
          color: '#38BDF8',
          components: ['Entidades', 'Value Objects', 'Domain Services'],
        },
        {
          name: 'Infraestrutura',
          subtitle: 'Adaptadores externos',
          color: '#34D399',
          components: ['Repositories', 'Database', 'Mensageria'],
        },
      ],
      notes: 'A camada de domínio nunca deve depender da infraestrutura.',
    });

    const doc = builder.build();
    expect(doc.pages).toHaveLength(1);
  });

  it('should create summary takeaways slide', () => {
    const builder = new DeckBuilder('Summary Test');
    builder.addSummarySlide({
      badge: 'CONCLUSÃO',
      title: 'Regras de Ouro',
      subtitle: 'Recomendações finais',
      takeaways: [
        { title: '1. Desacoplamento', detail: 'Mantenha ferramentas e dados modulares.' },
        { title: '2. Automação', detail: 'Automatize tarefas repetitivas com IA.' },
      ],
      notes: 'Encerrar abrindo para perguntas.',
    });

    const doc = builder.build();
    expect(doc.pages).toHaveLength(1);
    const page = doc.pages[0]!;
    expect(page.speakerNotes).toBe('Encerrar abrindo para perguntas.');
  });
});
