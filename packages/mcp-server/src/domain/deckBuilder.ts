export interface DeckTheme {
  id: string;
  name: string;
  background: string;
  cardBackground: string;
  cardBorder: string;
  textPrimary: string;
  textMuted: string;
  accent: string;
  accentAlt: string;
  codeBackground: string;
  fontHeading: string;
  fontBody: string;
  fontCode: string;
}

export const THEMES: Record<string, DeckTheme> = {
  'dark-neon': {
    id: 'dark-neon',
    name: 'Dark Neon',
    background: '#070D14',
    cardBackground: '#0F1B27',
    cardBorder: '#1E293B',
    textPrimary: '#F8FAFC',
    textMuted: '#94A3B8',
    accent: '#38BDF8', // Cyan/Sky
    accentAlt: '#34D399', // Emerald
    codeBackground: '#0B111A',
    fontHeading: 'Inter, system-ui, sans-serif',
    fontBody: 'Inter, system-ui, sans-serif',
    fontCode: 'JetBrains Mono, Fira Code, monospace',
  },
  'cyber-matrix': {
    id: 'cyber-matrix',
    name: 'Cyber Matrix',
    background: '#050D10',
    cardBackground: '#0A1A20',
    cardBorder: '#16353F',
    textPrimary: '#FFFFFF',
    textMuted: '#7AA2AB',
    accent: '#37FD76', // Terminal Green
    accentAlt: '#00D9FF', // Electric Blue
    codeBackground: '#03080A',
    fontHeading: 'Inter, system-ui, sans-serif',
    fontBody: 'Inter, system-ui, sans-serif',
    fontCode: 'JetBrains Mono, monospace',
  },
  'royal-navy': {
    id: 'royal-navy',
    name: 'Royal Navy',
    background: '#0B132B',
    cardBackground: '#1C2541',
    cardBorder: '#3A506B',
    textPrimary: '#FFFFFF',
    textMuted: '#A7B6C8',
    accent: '#6FFFE9',
    accentAlt: '#5BC0BE',
    codeBackground: '#111936',
    fontHeading: 'Inter, system-ui, sans-serif',
    fontBody: 'Inter, system-ui, sans-serif',
    fontCode: 'JetBrains Mono, monospace',
  },
};

export interface DesignElement {
  id: string;
  type: 'text' | 'shape' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
  visible: boolean;
  opacity: number;
  // Text specific
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fill?: string;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
  // Shape specific
  shape?: 'rect' | 'rounded-rect' | 'ellipse' | 'line';
  stroke?: string;
  strokeWidth?: number;
}

export interface SlidePage {
  id: string;
  name: string;
  width: number;
  height: number;
  background: { type: 'color'; color: string };
  elementIds: string[];
  speakerNotes?: string;
}

export interface ProjectDocument {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  pages: SlidePage[];
  elements: Record<string, DesignElement>;
  assets: Record<string, unknown>;
}

export class DeckBuilder {
  private project: ProjectDocument;
  public readonly theme: DeckTheme;
  private elementCounter = 0;
  private pageCounter = 0;

  constructor(name: string, themeName: string = 'dark-neon') {
    this.theme = THEMES[themeName] ?? THEMES['dark-neon']!;
    const now = new Date().toISOString();
    this.project = {
      id: `proj-${Date.now().toString(36)}`,
      name,
      createdAt: now,
      updatedAt: now,
      pages: [],
      elements: {},
      assets: {},
    };
  }

  private nextId(prefix: string): string {
    this.elementCounter += 1;
    return `${prefix}-${this.elementCounter}-${Date.now().toString(36)}`;
  }

  private addElement(page: SlidePage, element: DesignElement) {
    this.project.elements[element.id] = element;
    page.elementIds.push(element.id);
  }

  private createPage(name: string, notes?: string): SlidePage {
    this.pageCounter += 1;
    const page: SlidePage = {
      id: `page-${this.pageCounter}`,
      name,
      width: 1920,
      height: 1080,
      background: { type: 'color', color: this.theme.background },
      elementIds: [],
      speakerNotes: notes,
    };
    this.project.pages.push(page);
    return page;
  }

  private addSlideHeader(page: SlidePage, badge: string, title: string, subtitle?: string) {
    // Badge shape
    const badgeShapeId = this.nextId('badge-shape');
    this.addElement(page, {
      id: badgeShapeId,
      type: 'shape',
      shape: 'rounded-rect',
      x: 100,
      y: 70,
      width: 220,
      height: 38,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 0.9,
      fill: this.theme.cardBackground,
      stroke: this.theme.accent,
      strokeWidth: 1.5,
    });

    // Badge text
    const badgeTextId = this.nextId('badge-text');
    this.addElement(page, {
      id: badgeTextId,
      type: 'text',
      x: 110,
      y: 76,
      width: 200,
      height: 26,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      text: badge.toUpperCase(),
      fontFamily: this.theme.fontHeading,
      fontSize: 14,
      fontWeight: 700,
      fill: this.theme.accent,
      align: 'center',
    });

    // Main Title
    const titleId = this.nextId('title');
    this.addElement(page, {
      id: titleId,
      type: 'text',
      x: 100,
      y: 125,
      width: 1720,
      height: 65,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      text: title,
      fontFamily: this.theme.fontHeading,
      fontSize: 48,
      fontWeight: 800,
      fill: this.theme.textPrimary,
      align: 'left',
    });

    // Subtitle if present
    if (subtitle) {
      const subId = this.nextId('sub');
      this.addElement(page, {
        id: subId,
        type: 'text',
        x: 100,
        y: 195,
        width: 1720,
        height: 38,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 0.9,
        text: subtitle,
        fontFamily: this.theme.fontBody,
        fontSize: 22,
        fontWeight: 400,
        fill: this.theme.textMuted,
        align: 'left',
      });
    }

    // Top subtle accent bar
    const barId = this.nextId('top-accent-bar');
    this.addElement(page, {
      id: barId,
      type: 'shape',
      shape: 'rect',
      x: 0,
      y: 0,
      width: 1920,
      height: 6,
      rotation: 0,
      locked: true,
      visible: true,
      opacity: 1,
      fill: this.theme.accent,
    });
  }

  addTitleSlide(options: {
    badge?: string;
    title: string;
    subtitle: string;
    author?: string;
    tags?: string[];
    notes?: string;
  }) {
    const page = this.createPage(options.title, options.notes);

    // Accent line top
    const barId = this.nextId('bar');
    this.addElement(page, {
      id: barId,
      type: 'shape',
      shape: 'rect',
      x: 0,
      y: 0,
      width: 1920,
      height: 8,
      rotation: 0,
      locked: true,
      visible: true,
      opacity: 1,
      fill: this.theme.accent,
    });

    // Badge
    if (options.badge) {
      const bShape = this.nextId('badge-shape');
      this.addElement(page, {
        id: bShape,
        type: 'shape',
        shape: 'rounded-rect',
        x: 120,
        y: 260,
        width: 280,
        height: 44,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        fill: this.theme.cardBackground,
        stroke: this.theme.accent,
        strokeWidth: 2,
      });

      const bText = this.nextId('badge-text');
      this.addElement(page, {
        id: bText,
        type: 'text',
        x: 130,
        y: 270,
        width: 260,
        height: 28,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        text: options.badge.toUpperCase(),
        fontFamily: this.theme.fontHeading,
        fontSize: 16,
        fontWeight: 700,
        fill: this.theme.accent,
        align: 'center',
      });
    }

    // Huge Main Title
    const titleId = this.nextId('hero-title');
    this.addElement(page, {
      id: titleId,
      type: 'text',
      x: 120,
      y: 330,
      width: 1680,
      height: 180,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      text: options.title,
      fontFamily: this.theme.fontHeading,
      fontSize: 72,
      fontWeight: 900,
      fill: this.theme.textPrimary,
      align: 'left',
      lineHeight: 1.15,
    });

    // Subtitle
    const subId = this.nextId('hero-sub');
    this.addElement(page, {
      id: subId,
      type: 'text',
      x: 120,
      y: 540,
      width: 1680,
      height: 90,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      text: options.subtitle,
      fontFamily: this.theme.fontBody,
      fontSize: 32,
      fontWeight: 400,
      fill: this.theme.textMuted,
      align: 'left',
      lineHeight: 1.3,
    });

    // Author and date card
    if (options.author) {
      const authorCardId = this.nextId('author-card');
      this.addElement(page, {
        id: authorCardId,
        type: 'shape',
        shape: 'rounded-rect',
        x: 120,
        y: 720,
        width: 700,
        height: 90,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 0.8,
        fill: this.theme.cardBackground,
        stroke: this.theme.cardBorder,
        strokeWidth: 1,
      });

      const authorTextId = this.nextId('author-text');
      this.addElement(page, {
        id: authorTextId,
        type: 'text',
        x: 150,
        y: 748,
        width: 640,
        height: 40,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        text: options.author,
        fontFamily: this.theme.fontHeading,
        fontSize: 22,
        fontWeight: 600,
        fill: this.theme.accent,
        align: 'left',
      });
    }

    // Tags
    if (options.tags && options.tags.length > 0) {
      const tagsTextId = this.nextId('tags-text');
      this.addElement(page, {
        id: tagsTextId,
        type: 'text',
        x: 120,
        y: 850,
        width: 1680,
        height: 40,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 0.8,
        text: options.tags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join('   '),
        fontFamily: this.theme.fontCode,
        fontSize: 20,
        fontWeight: 500,
        fill: this.theme.accentAlt,
        align: 'left',
      });
    }
  }

  addCardsSlide(options: {
    badge: string;
    title: string;
    subtitle?: string;
    cards: Array<{
      title: string;
      description: string;
      highlight?: string;
      accentColor?: string;
    }>;
    notes?: string;
  }) {
    const page = this.createPage(options.title, options.notes);
    this.addSlideHeader(page, options.badge, options.title, options.subtitle);

    const count = options.cards.length;
    const paddingX = 100;
    const startY = 270;
    const totalWidth = 1920 - paddingX * 2;
    const gap = 30;
    const cardWidth = Math.floor((totalWidth - gap * (count - 1)) / count);
    const cardHeight = 680;

    options.cards.forEach((card, index) => {
      const cardX = paddingX + index * (cardWidth + gap);
      const cardAccent =
        card.accentColor ?? (index % 2 === 0 ? this.theme.accent : this.theme.accentAlt);

      // Card Background
      const cardBgId = this.nextId('card-bg');
      this.addElement(page, {
        id: cardBgId,
        type: 'shape',
        shape: 'rounded-rect',
        x: cardX,
        y: startY,
        width: cardWidth,
        height: cardHeight,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 0.95,
        fill: this.theme.cardBackground,
        stroke: this.theme.cardBorder,
        strokeWidth: 1.5,
      });

      // Card Accent Top Bar
      const cardBarId = this.nextId('card-bar');
      this.addElement(page, {
        id: cardBarId,
        type: 'shape',
        shape: 'rounded-rect',
        x: cardX + 15,
        y: startY + 15,
        width: 60,
        height: 8,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        fill: cardAccent,
      });

      // Card Title
      const cardTitleId = this.nextId('card-title');
      this.addElement(page, {
        id: cardTitleId,
        type: 'text',
        x: cardX + 35,
        y: startY + 45,
        width: cardWidth - 70,
        height: 80,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        text: card.title,
        fontFamily: this.theme.fontHeading,
        fontSize: 32,
        fontWeight: 700,
        fill: cardAccent,
        align: 'left',
        lineHeight: 1.2,
      });

      // Card Highlight/Tag if present
      let descOffsetY = startY + 135;
      if (card.highlight) {
        const highlightId = this.nextId('card-highlight');
        this.addElement(page, {
          id: highlightId,
          type: 'text',
          x: cardX + 35,
          y: descOffsetY,
          width: cardWidth - 70,
          height: 35,
          rotation: 0,
          locked: false,
          visible: true,
          opacity: 1,
          text: card.highlight,
          fontFamily: this.theme.fontCode,
          fontSize: 16,
          fontWeight: 600,
          fill: this.theme.accentAlt,
          align: 'left',
        });
        descOffsetY += 45;
      }

      // Card Description / Content
      const cardDescId = this.nextId('card-desc');
      this.addElement(page, {
        id: cardDescId,
        type: 'text',
        x: cardX + 35,
        y: descOffsetY,
        width: cardWidth - 70,
        height: cardHeight - (descOffsetY - startY) - 40,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        text: card.description,
        fontFamily: this.theme.fontBody,
        fontSize: 22,
        fontWeight: 400,
        fill: this.theme.textPrimary,
        align: 'left',
        lineHeight: 1.45,
      });
    });
  }

  addSplitSlide(options: {
    badge: string;
    title: string;
    subtitle?: string;
    left: {
      title: string;
      badge?: string;
      items: string[];
      accentColor?: string;
    };
    right: {
      title: string;
      badge?: string;
      items: string[];
      accentColor?: string;
    };
    notes?: string;
  }) {
    const page = this.createPage(options.title, options.notes);
    this.addSlideHeader(page, options.badge, options.title, options.subtitle);

    const startY = 260;
    const cardWidth = 830;
    const cardHeight = 700;
    const sides = [
      { side: options.left, x: 100, defaultAccent: this.theme.accent },
      { side: options.right, x: 990, defaultAccent: this.theme.accentAlt },
    ];

    sides.forEach(({ side, x, defaultAccent }) => {
      const accent = side.accentColor ?? defaultAccent;

      // Card box
      const bgId = this.nextId('split-bg');
      this.addElement(page, {
        id: bgId,
        type: 'shape',
        shape: 'rounded-rect',
        x,
        y: startY,
        width: cardWidth,
        height: cardHeight,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 0.95,
        fill: this.theme.cardBackground,
        stroke: this.theme.cardBorder,
        strokeWidth: 2,
      });

      // Card Title
      const titleId = this.nextId('split-title');
      this.addElement(page, {
        id: titleId,
        type: 'text',
        x: x + 40,
        y: startY + 40,
        width: cardWidth - 80,
        height: 60,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        text: side.title,
        fontFamily: this.theme.fontHeading,
        fontSize: 34,
        fontWeight: 700,
        fill: accent,
        align: 'left',
      });

      // Items formatted with bullet points
      const bodyText = side.items.map((it) => `• ${it}`).join('\n\n');
      const itemsId = this.nextId('split-items');
      this.addElement(page, {
        id: itemsId,
        type: 'text',
        x: x + 40,
        y: startY + 120,
        width: cardWidth - 80,
        height: cardHeight - 150,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        text: bodyText,
        fontFamily: this.theme.fontBody,
        fontSize: 22,
        fontWeight: 400,
        fill: this.theme.textPrimary,
        align: 'left',
        lineHeight: 1.4,
      });
    });
  }

  addCodeSlide(options: {
    badge: string;
    title: string;
    subtitle?: string;
    explanation: string[];
    codeTitle: string;
    code: string;
    notes?: string;
  }) {
    const page = this.createPage(options.title, options.notes);
    this.addSlideHeader(page, options.badge, options.title, options.subtitle);

    const startY = 260;
    const leftWidth = 650;
    const rightWidth = 1010;
    const height = 700;

    // Left card: Explanation points
    const expBgId = this.nextId('exp-bg');
    this.addElement(page, {
      id: expBgId,
      type: 'shape',
      shape: 'rounded-rect',
      x: 100,
      y: startY,
      width: leftWidth,
      height,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 0.95,
      fill: this.theme.cardBackground,
      stroke: this.theme.cardBorder,
      strokeWidth: 1.5,
    });

    const expTitleId = this.nextId('exp-title');
    this.addElement(page, {
      id: expTitleId,
      type: 'text',
      x: 140,
      y: startY + 35,
      width: leftWidth - 80,
      height: 45,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      text: 'CONCEITOS CHAVE',
      fontFamily: this.theme.fontHeading,
      fontSize: 20,
      fontWeight: 700,
      fill: this.theme.accent,
      align: 'left',
    });

    const expText = options.explanation.map((item) => `✔  ${item}`).join('\n\n');
    const expContentId = this.nextId('exp-content');
    this.addElement(page, {
      id: expContentId,
      type: 'text',
      x: 140,
      y: startY + 95,
      width: leftWidth - 80,
      height: height - 120,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      text: expText,
      fontFamily: this.theme.fontBody,
      fontSize: 21,
      fontWeight: 400,
      fill: this.theme.textPrimary,
      align: 'left',
      lineHeight: 1.45,
    });

    // Right card: Code block window
    const codeBgId = this.nextId('code-bg');
    this.addElement(page, {
      id: codeBgId,
      type: 'shape',
      shape: 'rounded-rect',
      x: 790,
      y: startY,
      width: rightWidth,
      height,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      fill: this.theme.codeBackground,
      stroke: this.theme.accent,
      strokeWidth: 2,
    });

    // Header bar of code window
    const codeHeaderBarId = this.nextId('code-header');
    this.addElement(page, {
      id: codeHeaderBarId,
      type: 'shape',
      shape: 'rounded-rect',
      x: 790,
      y: startY,
      width: rightWidth,
      height: 50,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 0.9,
      fill: this.theme.cardBackground,
      stroke: this.theme.cardBorder,
      strokeWidth: 1,
    });

    // Code title
    const codeTitleId = this.nextId('code-title');
    this.addElement(page, {
      id: codeTitleId,
      type: 'text',
      x: 820,
      y: startY + 12,
      width: rightWidth - 60,
      height: 30,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      text: `💻 ${options.codeTitle}`,
      fontFamily: this.theme.fontCode,
      fontSize: 16,
      fontWeight: 600,
      fill: this.theme.accentAlt,
      align: 'left',
    });

    // Code content
    const codeContentId = this.nextId('code-content');
    this.addElement(page, {
      id: codeContentId,
      type: 'text',
      x: 825,
      y: startY + 70,
      width: rightWidth - 70,
      height: height - 90,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      text: options.code,
      fontFamily: this.theme.fontCode,
      fontSize: 20,
      fontWeight: 400,
      fill: '#E2E8F0',
      align: 'left',
      lineHeight: 1.35,
    });
  }

  addArchitectureSlide(options: {
    badge: string;
    title: string;
    subtitle?: string;
    layers: Array<{
      name: string;
      color: string;
      subtitle: string;
      components: string[];
    }>;
    notes?: string;
  }) {
    const page = this.createPage(options.title, options.notes);
    this.addSlideHeader(page, options.badge, options.title, options.subtitle);

    const startY = 260;
    const totalWidth = 1720;
    const count = options.layers.length;
    const gap = 24;
    const layerWidth = Math.floor((totalWidth - gap * (count - 1)) / count);
    const height = 690;

    options.layers.forEach((layer, index) => {
      const x = 100 + index * (layerWidth + gap);

      // Layer box
      const bgId = this.nextId('arch-bg');
      this.addElement(page, {
        id: bgId,
        type: 'shape',
        shape: 'rounded-rect',
        x,
        y: startY,
        width: layerWidth,
        height,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 0.95,
        fill: this.theme.cardBackground,
        stroke: layer.color,
        strokeWidth: 2,
      });

      // Layer Header
      const headerId = this.nextId('arch-title');
      this.addElement(page, {
        id: headerId,
        type: 'text',
        x: x + 25,
        y: startY + 30,
        width: layerWidth - 50,
        height: 45,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        text: layer.name,
        fontFamily: this.theme.fontHeading,
        fontSize: 26,
        fontWeight: 800,
        fill: layer.color,
        align: 'left',
      });

      const subId = this.nextId('arch-sub');
      this.addElement(page, {
        id: subId,
        type: 'text',
        x: x + 25,
        y: startY + 80,
        width: layerWidth - 50,
        height: 35,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        text: layer.subtitle,
        fontFamily: this.theme.fontBody,
        fontSize: 17,
        fontWeight: 500,
        fill: this.theme.textMuted,
        align: 'left',
      });

      // Component pill cards
      const compStartY = startY + 140;
      const compHeight = 95;
      const compGap = 20;

      layer.components.forEach((comp, cIdx) => {
        const cY = compStartY + cIdx * (compHeight + compGap);
        if (cY + compHeight > startY + height - 20) return;

        const pillBgId = this.nextId('comp-pill');
        this.addElement(page, {
          id: pillBgId,
          type: 'shape',
          shape: 'rounded-rect',
          x: x + 25,
          y: cY,
          width: layerWidth - 50,
          height: compHeight,
          rotation: 0,
          locked: false,
          visible: true,
          opacity: 0.9,
          fill: this.theme.background,
          stroke: this.theme.cardBorder,
          strokeWidth: 1,
        });

        const pillTextId = this.nextId('comp-text');
        this.addElement(page, {
          id: pillTextId,
          type: 'text',
          x: x + 40,
          y: cY + 18,
          width: layerWidth - 80,
          height: compHeight - 36,
          rotation: 0,
          locked: false,
          visible: true,
          opacity: 1,
          text: comp,
          fontFamily: this.theme.fontCode,
          fontSize: 18,
          fontWeight: 600,
          fill: this.theme.textPrimary,
          align: 'left',
          lineHeight: 1.25,
        });
      });
    });
  }

  addSummarySlide(options: {
    badge: string;
    title: string;
    subtitle?: string;
    takeaways: Array<{ title: string; detail: string; icon?: string }>;
    notes?: string;
  }) {
    const page = this.createPage(options.title, options.notes);
    this.addSlideHeader(page, options.badge, options.title, options.subtitle);

    const startY = 260;
    const totalHeight = 700;
    const count = options.takeaways.length;
    const gap = 20;
    const itemHeight = Math.floor((totalHeight - gap * (count - 1)) / count);

    options.takeaways.forEach((item, index) => {
      const y = startY + index * (itemHeight + gap);
      const accent = index % 2 === 0 ? this.theme.accent : this.theme.accentAlt;

      // Card
      const bgId = this.nextId('sum-bg');
      this.addElement(page, {
        id: bgId,
        type: 'shape',
        shape: 'rounded-rect',
        x: 100,
        y,
        width: 1720,
        height: itemHeight,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 0.95,
        fill: this.theme.cardBackground,
        stroke: this.theme.cardBorder,
        strokeWidth: 1.5,
      });

      // Number badge
      const numBgId = this.nextId('num-bg');
      this.addElement(page, {
        id: numBgId,
        type: 'shape',
        shape: 'rounded-rect',
        x: 130,
        y: y + Math.floor((itemHeight - 50) / 2),
        width: 50,
        height: 50,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        fill: accent,
      });

      const numTextId = this.nextId('num-text');
      this.addElement(page, {
        id: numTextId,
        type: 'text',
        x: 130,
        y: y + Math.floor((itemHeight - 50) / 2) + 10,
        width: 50,
        height: 35,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        text: `${index + 1}`,
        fontFamily: this.theme.fontHeading,
        fontSize: 24,
        fontWeight: 800,
        fill: this.theme.background,
        align: 'center',
      });

      // Title
      const titleId = this.nextId('sum-title');
      this.addElement(page, {
        id: titleId,
        type: 'text',
        x: 215,
        y: y + Math.floor((itemHeight - 50) / 2) - 8,
        width: 450,
        height: 40,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        text: item.title,
        fontFamily: this.theme.fontHeading,
        fontSize: 26,
        fontWeight: 700,
        fill: accent,
        align: 'left',
      });

      // Detail
      const detailId = this.nextId('sum-detail');
      this.addElement(page, {
        id: detailId,
        type: 'text',
        x: 690,
        y: y + Math.floor((itemHeight - 50) / 2) - 5,
        width: 1090,
        height: 60,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        text: item.detail,
        fontFamily: this.theme.fontBody,
        fontSize: 21,
        fontWeight: 400,
        fill: this.theme.textPrimary,
        align: 'left',
        lineHeight: 1.3,
      });
    });
  }

  build(): ProjectDocument {
    this.project.updatedAt = new Date().toISOString();
    return this.project;
  }
}
