export interface GoogleFontCatalogItem {
  aliases?: string[];
  family: string;
  source: 'google-fonts';
}

const families: GoogleFontCatalogItem[] = [
  { family: 'Abril Fatface', source: 'google-fonts' },
  { family: 'Anton', source: 'google-fonts' },
  { family: 'Archivo', source: 'google-fonts' },
  { family: 'Arimo', aliases: ['Arial', 'Helvetica'], source: 'google-fonts' },
  { family: 'Bebas Neue', source: 'google-fonts' },
  { family: 'Bitter', source: 'google-fonts' },
  { family: 'Cabin', source: 'google-fonts' },
  { family: 'Caladea', aliases: ['Cambria'], source: 'google-fonts' },
  { family: 'Carlito', aliases: ['Calibri'], source: 'google-fonts' },
  { family: 'Cormorant Garamond', source: 'google-fonts' },
  { family: 'Cousine', aliases: ['Courier', 'Courier New'], source: 'google-fonts' },
  { family: 'DM Sans', source: 'google-fonts' },
  { family: 'Fira Sans', source: 'google-fonts' },
  { family: 'IBM Plex Sans', source: 'google-fonts' },
  { family: 'Inconsolata', source: 'google-fonts' },
  { family: 'Inter', source: 'google-fonts' },
  { family: 'Lato', source: 'google-fonts' },
  { family: 'Libre Baskerville', source: 'google-fonts' },
  { family: 'Lora', source: 'google-fonts' },
  { family: 'Manrope', source: 'google-fonts' },
  { family: 'Merriweather', source: 'google-fonts' },
  { family: 'Montserrat', source: 'google-fonts' },
  { family: 'Mulish', source: 'google-fonts' },
  { family: 'Noto Sans', source: 'google-fonts' },
  { family: 'Noto Sans JP', source: 'google-fonts' },
  { family: 'Noto Sans KR', source: 'google-fonts' },
  { family: 'Noto Sans SC', source: 'google-fonts' },
  { family: 'Noto Serif', source: 'google-fonts' },
  { family: 'Nunito', source: 'google-fonts' },
  { family: 'Open Sans', source: 'google-fonts' },
  { family: 'Oswald', source: 'google-fonts' },
  { family: 'Playfair Display', source: 'google-fonts' },
  { family: 'Poppins', source: 'google-fonts' },
  { family: 'Raleway', source: 'google-fonts' },
  { family: 'Roboto', source: 'google-fonts' },
  { family: 'Roboto Condensed', source: 'google-fonts' },
  { family: 'Roboto Mono', source: 'google-fonts' },
  { family: 'Rubik', source: 'google-fonts' },
  { family: 'Source Sans 3', source: 'google-fonts' },
  { family: 'Source Serif 4', source: 'google-fonts' },
  { family: 'Space Grotesk', source: 'google-fonts' },
  { family: 'Tinos', aliases: ['Times', 'Times New Roman'], source: 'google-fonts' },
  { family: 'Ubuntu', source: 'google-fonts' },
  { family: 'Work Sans', source: 'google-fonts' },
];

export const googleFontsCatalog = families satisfies GoogleFontCatalogItem[];
