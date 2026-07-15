import { localStudioAppRoutes } from '@localstudio/app-routes';
import type { DefaultTheme } from 'vitepress';

const githubIssuesUrl = 'https://github.com/ErickWendel/localstudio/issues/new/choose';

const guideSidebar: DefaultTheme.SidebarItem[] = [
  { text: 'Getting Started', link: '/guide/getting-started' },
  {
    text: 'Editor Elements',
    collapsed: false,
    items: [
      { text: 'Overview', link: '/guide/editor-elements/' },
      { text: 'Text', link: '/guide/editor-elements/text' },
      { text: 'Images', link: '/guide/editor-elements/images' },
      { text: 'Videos and GIFs', link: '/guide/editor-elements/videos-and-gifs' },
      { text: 'Shapes', link: '/guide/editor-elements/shapes' },
      { text: 'Layers and Arrange', link: '/guide/editor-elements/layers-and-arrange' },
      { text: 'Slide Layouts', link: '/guide/editor-elements/slide-layouts' },
    ],
  },
  {
    text: 'Media Integrations',
    collapsed: false,
    items: [
      { text: 'Overview', link: '/guide/media-integrations/' },
      { text: 'GIPHY', link: '/guide/media-integrations/giphy' },
      { text: 'Unsplash', link: '/guide/media-integrations/unsplash' },
    ],
  },
  {
    text: 'Local Projects',
    collapsed: false,
    items: [
      {
        text: 'Import',
        collapsed: false,
        items: [
          { text: 'PowerPoint (.pptx)', link: '/guide/local-projects/import/powerpoint' },
          { text: 'Remote', link: '/guide/local-projects/import/remote' },
          { text: 'Local Projects', link: '/guide/local-projects/import/local-projects' },
        ],
      },
      { text: 'Version History', link: '/guide/local-projects/version-history' },
      { text: 'Mirroring', link: '/guide/local-projects/mirroring' },
      { text: 'Sharing', link: '/guide/local-projects/sharing' },
      {
        text: 'Export',
        collapsed: false,
        items: [
          { text: 'PowerPoint (.pptx)', link: '/guide/local-projects/export/powerpoint' },
          { text: 'Images (.zip)', link: '/guide/local-projects/export/images' },
        ],
      },
    ],
  },
  {
    text: 'Work with Web AI',
    collapsed: false,
    items: [
      {
        text: 'Prompt',
        collapsed: false,
        items: [
          { text: 'Prompt to Slide', link: '/guide/work-with-web-ai/prompt/slide' },
          { text: 'Prompt to Image', link: '/guide/work-with-web-ai/prompt/image' },
        ],
      },
      { text: 'Translate Decks', link: '/guide/work-with-web-ai/translate-decks' },
      { text: 'Edit Images', link: '/guide/work-with-web-ai/edit-images' },
    ],
  },
  { text: 'Presenter Mode', link: '/guide/presenter-mode' },
];

const referenceSidebar: DefaultTheme.SidebarItem[] = [
  { text: 'Keyboard Shortcuts', link: '/reference/keyboard-shortcuts' },
  { text: 'Browser Support', link: '/reference/browser-support' },
  { text: 'Hosting', link: '/reference/hosting' },
  { text: 'Release Notes', link: '/reference/release-notes' },
  { text: 'FAQ', link: '/reference/faq' },
];

const resourcesSidebar: DefaultTheme.SidebarItem[] = [
  { text: 'Roadmap', link: '/resources/roadmap' },
  { text: 'Contributing', link: '/resources/contributing' },
  { text: 'Found a Bug', link: githubIssuesUrl },
];

const sidebar = {
  '/guide/': [{ text: 'Guide', items: guideSidebar }],
  '/reference/': [{ text: 'Reference', items: referenceSidebar }],
  '/resources/': [{ text: 'Resources', items: resourcesSidebar }],
  '/': [
    { text: 'Guide', items: guideSidebar },
    { text: 'Reference', items: referenceSidebar },
    { text: 'Resources', items: resourcesSidebar },
  ],
} satisfies DefaultTheme.SidebarMulti;

const nav = [
  { text: 'Guide', items: toNavItems(guideSidebar) },
  { text: 'Reference', link: '/reference/keyboard-shortcuts' },
  { text: 'Resources', link: '/resources/roadmap' },
  { text: 'Open Editor', link: localStudioAppRoutes.editor },
] satisfies DefaultTheme.NavItem[];

export const docsNavigation = {
  githubIssuesUrl,
  nav,
  sidebar,
} as const;

function toNavItems(items: DefaultTheme.SidebarItem[]): DefaultTheme.NavItemWithChildren['items'] {
  return items.map((item) => {
    if (item.items) {
      return {
        text: item.text,
        items: toFlatNavLinks(item.items),
      };
    }
    return toNavLink(item);
  });
}

function toFlatNavLinks(items: DefaultTheme.SidebarItem[]): DefaultTheme.NavItemWithLink[] {
  return items.flatMap((item) => {
    if (item.items) return toFlatNavLinks(item.items);
    return [toNavLink(item)];
  });
}

function toNavLink(item: DefaultTheme.SidebarItem): DefaultTheme.NavItemWithLink {
  return {
    text: item.text ?? '',
    link: item.link ?? '/',
  };
}
