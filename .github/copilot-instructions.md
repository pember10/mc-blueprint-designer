# mc-blueprint-designer — Copilot Instructions

## Project Overview
Vite + React 19 + TypeScript Minecraft blueprint designer. Users paint blocks on a layered grid and preview the result in a 3D viewport.

## Tech Stack
- **Build**: Vite + `@vitejs/plugin-react`, path alias `@/ → src/`
- **UI**: React 19, Tailwind CSS v4 (`@tailwindcss/vite`)
- **State**: Zustand v5 + zundo (undo/redo) + persist (`mc-blueprint-editor` key)
- **3D**: Three.js 0.185.1 + React Three Fiber + Drei (`OrbitControls`)
- **Storage**: JSZip + `idb` — IDB name `mc-blueprint-textures`, version 2, stores: `textures`, `blockstates`, `models`
- **CDN**: `https://assets.mcasset.cloud/{version}/assets/{namespace}/{type}/{path}.{ext}` (default version `1.21.4`)
- **TypeScript**: `tsconfig.app.json` has `ignoreDeprecations: "6.0"`, `noUnusedLocals: true`, `noUnusedParameters: true`
- **Check**: `$env:PATH = "C:\Program Files\nodejs;$env:PATH"; npx tsc -b --noEmit 2>&1`

## UI Palette
`bg #151517`, panel `#19191c`, border `#2c2c30`, text `#e8e6e3`, accent `#8a6fd6`

## Key Source Files
| File | Purpose |
|---|---|
| `src/lib/blocks/textures.ts` | Texture resolver, CDN/IDB/memCache, `resolveTextureById`, `tryResolveTexture` (cropped first-frame), `fetchTextureMcmeta` |
| `src/lib/blocks/blockstate.ts` | Blockstate string → model ID + XYrot; handles `variants` + `multipart` |
| `src/lib/blocks/model.ts` | Follows parent chains, resolves `#var` refs, returns `ResolvedModel { elements, textures }` |
| `src/lib/blocks/geometry.ts` | `buildBlockMesh` → Three.js BufferGeometry + MeshLambertMaterial[]; animated texture ticker |
| `src/lib/blocks/preloader.ts` | Preloads all vanilla block textures (full sprite sheets) for palette icons |
| `src/components/editor/AnimatedBlockIcon.tsx` | Shared canvas component used by both PaletteTab and LayerGrid for animated sprite sheets |
| `src/components/editor/VoxelGrid.tsx` | R3F instanced mesh renderer; ticks `tickAnimatedTextures` via `useFrame` |
| `src/components/editor/LayerGrid.tsx` | 2D top-down paint grid; uses `AnimatedBlockIcon` canvas overlay for block textures |
| `src/components/panels/PaletteTab.tsx` | Block selector palette; uses `AnimatedBlockIcon` for block icons |
| `src/store/editorStore.ts` | Persisted editor state; `textureMap` (full sprite sheets), `setTextureMap` (merge) |

## Block Rendering Pipeline
```
blockId string
  → resolveBlockstate()   → { modelId, xRot, yRot }
  → resolveModel()        → { elements[], textures{} }
  → buildBlockMesh()      → { geometry: BufferGeometry, materials: MeshLambertMaterial[] }
  → VoxelGrid             → InstancedModelMesh (Three.js scene)
```

## Animated Textures (3D)
- `loadTexture(dataUrl, texId?)` in geometry.ts detects sprite sheets (`h > w && h % w === 0`)
- Sets `texture.repeat.y = 1/N`, `texture.offset.y = (N-1)/N` for frame 0
- Registers `AnimState { tex, frameCount, frames[], frameIdx, msPerFrame, elapsed }` in `animatedTextures[]`
- `tickAnimatedTextures(deltaMs)` advances `frameIdx` through `frames[]` (respects mcmeta ping-pong order)
- mcmeta fetched async via `fetchTextureMcmeta(texId)` → updates `state.frames` + `state.msPerFrame`
- `VoxelGrid.useFrame` calls `tickAnimatedTextures(delta * 1000)` each frame
- Fluid blocks (lava, water) have no `elements` in their model JSON → `buildBlockMesh` synthesises a full cube from the `particle` texture

## Animated Textures (Palette + Layer Grid)
- `textureMap` stores **full sprite sheets** (not cropped first frames)
- `AnimatedBlockIcon` (`src/components/editor/AnimatedBlockIcon.tsx`) is a shared canvas component used by **both** PaletteTab and LayerGrid
- Module-level `setInterval(100ms)` ticks all registered canvases; fills background with `color` prop before drawing each frame so transparent textures (water) composite correctly
- `frames[]` + `seqIdx` track the mcmeta playback sequence; fetched async via `fetchTextureMcmeta(texId)` when `texId` prop is provided
- `blockToTexId` map in textures.ts (localStorage-persisted) maps blockId → texId so `AnimatedBlockIcon` can fetch mcmeta on subsequent page loads without re-running the preloader
- LayerGrid cells with textures use an absolutely-positioned `AnimatedBlockIcon` canvas overlay (32×32px buffer, CSS-scaled to `cellSize`)

## Important Gotchas
- `setTextureMap` in editorStore is a **merge**, not replace
- `resolveModel` returns `{ elements: [], textures }` (not null) for element-less models (fluids) so `buildBlockMesh` can synthesise geometry
- REVERSED_WINDING faces (`up/down/north/south`) use `[0,2,1,0,3,2]` index order — do NOT change
- Model element positions are in 0-16 space; divide by 16 when writing to BufferGeometry
- IDB version is 2; bumping it wipes all cached textures/blockstates/models
- mcmeta `frametime` is in game ticks; multiply by 50ms to get wall-clock ms

## Tri-Surface Consistency Rule
The Palette, Layer Grid, and 3D Preview are three independent rendering surfaces for the same block data. **Any bug or visual fix in one must be checked and applied to all three.** Common shared concerns: texture resolution, animated sprite sheets, tint colors (water, etc.), fluid block fallbacks.

## Reference: minecraft-renderer (zardoy)
**Always check this library first** when solving Minecraft-specific problems before implementing custom solutions.

- Repo: https://github.com/zardoy/minecraft-renderer
- npm: `minecraft-renderer` (browser + Three.js, actively maintained)
- Uses a **texture atlas** (`blocksAtlasImage` + `blocksAtlasJson`) rather than per-texture Three.js textures
- Animated textures are handled by updating atlas pixel regions each tick
- Block geometry is built by WASM mesher workers via `MesherGeometryOutput { positions, normals, colors, uvs, indices }`
- Vertex colors carry per-face lighting (sky + block light); no per-material lights needed
- Fluid blocks render via a separate fluid surface mesher, not standard block models
- Consult its source (especially `src/mesher/`, `src/three/`) before writing custom geometry or lighting code
- Prefer a local clone of the repository to reduce calls to GitHub and improve performance when exploring the library's source code.
