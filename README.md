# MineColonies Blueprint Designer

A web-based 3D editor for [MineColonies](https://minecolonies.com/) / [Structurize](https://github.com/ldtteam/Structurize) `.blueprint` files, built with React, Three.js, and TypeScript.

![Screenshot](docs/screenshot.png)

## Features

- **Open & export** `.blueprint` files (gzip-compressed NBT v1 format)
- **3D voxel viewport** powered by [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber) — orbit, zoom, pan
- **Full tool palette** — Place, Erase, Paint brush, Block Pick, Select, Tag
- **X / Z symmetry** — mirror placements across the footprint centre
- **Y layer slider** — show/hide blocks above the active layer (`[` / `]`)
- **Ghost overlay** — render a previous schematic level as a semi-transparent guide
- **Block palette** — 1 000+ vanilla blocks + Structurize + MineColonies hut blocks, with search and namespace tabs
- **Metadata panel** — edit name, pack name, file name, and view size / anchor
- **MineColonies tag picker** — click any block in Tag mode to attach MC tags
- **Undo / Redo** via [zundo](https://github.com/charkour/zundo)
- **Resource pack support** — import a `.zip` resource pack to display real block textures (IndexedDB cached)

## Tech Stack

| Layer | Library |
|---|---|
| UI framework | React 19 + TypeScript + Vite |
| 3D rendering | Three.js + @react-three/fiber + @react-three/drei |
| State | Zustand + zundo (undo/redo) |
| NBT | prismarine-nbt + pako |
| Styling | Tailwind CSS v4 |
| Resource packs | JSZip + idb (IndexedDB) |

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Regenerate vanilla block list

The block colour/name data is pre-extracted from `minecraft-data` into a static JSON so it works in the browser. If you upgrade `minecraft-data`, re-run:

```bash
node scripts/generate-blocks.mjs
```

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `S` | Select tool |
| `P` | Place tool |
| `E` | Erase tool |
| `B` | Paint brush |
| `I` | Pick (eyedropper) |
| `T` | Tag mode |
| `X` | Toggle X symmetry |
| `Z` | Toggle Z symmetry |
| `G` | Toggle ghost overlay |
| `[` / `]` | Decrease / increase active layer |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |

## Blueprint Format

Structurize `.blueprint` files are **gzip-compressed NBT** (version 1). Key fields:

- `palette` — list of `{ Name, Properties }` block states; index 0 is always air
- `blocks` — packed int array (`(hi << 16 | lo)` short pairs), iterated `[y][z][x]`
- `size_x / size_y / size_z` — short dimensions
- `optional_data.structurize.primary_offset` — anchor BlockPos

## Project Structure

```
src/
  lib/
    blueprint/   types.ts          — core data model & MineColonies tag catalogue
    nbt/         parser.ts         — .blueprint → Blueprint
                 serializer.ts     — Blueprint → .blueprint
    blocks/      registry.ts       — block database (vanilla + modded)
                 textures.ts       — texture resolver + resource pack importer
                 vanilla-blocks-1.21.json  — pre-generated vanilla block list
    io/          localIO.ts        — file open / download
  store/
    blueprintStore.ts — active blueprint state + undo/redo (zundo)
    editorStore.ts    — transient editor UI state
  components/
    editor/      Viewport.tsx      — main R3F canvas
                 VoxelGrid.tsx     — InstancedMesh per block type
                 GhostVoxelGrid.tsx — semi-transparent ghost level
                 Stage.tsx         — platform + grid helper
                 BlockInteraction.tsx — raycasting / tool dispatch hook
    panels/      BlockPalette.tsx  — searchable block grid
                 MetadataPanel.tsx — name / size / anchor editor
                 TagPanel.tsx      — MineColonies tag picker overlay
    layout/      Toolbar.tsx       — tool buttons, symmetry, layer, file actions
  App.tsx        — three-column layout + global keyboard shortcuts
scripts/
  generate-blocks.mjs  — extracts vanilla block list from minecraft-data (Node.js only)
```

## Licence

MIT
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
