# @localstudio/mcp-server

> Model Context Protocol (MCP) Stdio Server for **LocalStudio.dev** — Agentic Slide Generation for Google Antigravity, Claude Code, Cursor, Windsurf, and LLMs.

---

## 🌟 Overview

`@localstudio/mcp-server` bridges the gap between **autonomous AI coding agents** and **LocalStudio's browser-native canvas editor**. 

Instead of generating static Markdown or locked screenshots, this MCP server allows AI agents to programmatically build **multi-layered, fully editable LocalStudio presentation decks** with professional design systems, color tokens, and speaker notes.

---

## 🛠️ Available MCP Tools

| Tool Name | Description | Key Parameters |
|---|---|---|
| `localstudio_create_deck` | Creates a new presentation deck with cover styling, theme palette, and metadata. | `name`, `slug`, `title`, `subtitle`, `badge`, `author`, `theme` (`dark-neon`, `cyber-matrix`, `royal-navy`), `tags`, `notes` |
| `localstudio_add_slide` | Appends a structured, styled slide to an existing presentation. | `deckSlug`, `type` (`cards`, `split`, `code`, `architecture`, `summary`), `title`, `subtitle`, `badge`, `notes`, layout-specific data |
| `localstudio_list_decks` | Lists all presentations saved in the workspace. | None |
| `localstudio_get_deck` | Inspects slides, elements count, and speaker notes of a deck. | `deckSlug` |
| `localstudio_get_urls` | Returns direct URLs for the interactive editor and presenter mode. | `deckSlug` |

---

## 🎨 Supported Layouts & Themes

### Slide Layout Types
- **`cards`**: 2 to 4 modular cards with color accents, highlights, and bullet points.
- **`split`**: Side-by-side comparison (e.g., Before vs After, Monolith vs Microservices).
- **`code`**: Conceptual breakdown on the left + styled code container on the right.
- **`architecture`**: Layered architectural stack (e.g., Domain, Application, Infrastructure).
- **`summary`**: Highlighted key takeaways and golden rules.

### Themes
- **`dark-neon`** (Default): `#070D14` canvas, `#38BDF8` cyan and `#34D399` emerald accents.
- **`cyber-matrix`**: `#050D10` terminal dark, `#37FD76` neon green and `#00D9FF` electric blue.
- **`royal-navy`**: `#0B132B` navy, `#6FFFE9` turquoise accents.

---

## ⚙️ Configuration

The server works with standard Stdio transports and resolves paths dynamically:

### Environment Variables (Optional)

| Variable | Description | Default |
|---|---|---|
| `LOCALSTUDIO_DECKS_DIR` | Directory where project files are persisted (`project.json`, `localstudio.json`) | `<workspace>/decks` |
| `LOCALSTUDIO_PUBLIC_DIR` | Directory where shareable web JSONs are exported | `<workspace>/apps/editor/public/decks` |
| `LOCALSTUDIO_HOST` | Base URL of the LocalStudio server | `http://localhost:4173` |

### Setting up in Google Antigravity / Claude Desktop / Cursor

Add to your MCP configuration (e.g., `mcp_config.json` or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "localstudio": {
      "command": "node",
      "args": ["<path-to-localstudio>/packages/mcp-server/src/index.ts"],
      "env": {
        "LOCALSTUDIO_DECKS_DIR": "<custom-decks-folder>",
        "LOCALSTUDIO_PUBLIC_DIR": "<path-to-localstudio>/apps/editor/public/decks"
      }
    }
  }
}
```

---

## 🧪 Testing

The test suite runs with [Vitest](https://vitest.dev/) using `@modelcontextprotocol/sdk/inMemory.js` for fast in-process transport testing:

```bash
npm run test
# or
npx vitest run packages/mcp-server/tests
```
