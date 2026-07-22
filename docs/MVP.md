# MVP Definition

## Goal

A personal tool that fully replaces other editors for building a MineColonies style pack — all 47 huts, up to 5 levels each (up to 235 `.blueprint` files per pack).

**Done signal**: Good enough to use internally instead of other tools. Not a public release.

---

## Feature Requirements

All seven of the following must work reliably for MVP:

1. **Open & save `.blueprint` files** — NBT round-trip must produce files MineColonies can load in-game.
2. **2D grid editing** — Place, erase, paint, pick blocks on a per-layer 2D grid and export a valid `.blueprint`.
3. **5-level pack workflow** — Level tabs (L1–L5) persist work in memory, "Export Level" and "Export Pack" (zip of all levels) both work.
4. **Resource pack textures** — Importing a `.zip` resource pack renders real block textures in the 2D grid.
5. **3D preview** — Interactive orbitable 3D view of the current blueprint (all layers).
6. **Validation** — Warns on missing hut block, footprint mismatch with ghost, out-of-bounds anchor.
7. **Pack Buildings checklist** — Tracks progress across all 47 MineColonies huts; persists across page refreshes.

---

## Gaps to Close

| Gap | Priority | Notes |
|---|---|---|
| **Session persistence** | 🔴 Critical | All work (`savedLevels`, pack metadata, checklist progress) is lost on page refresh. Needs Zustand `persist` middleware → `localStorage`. |
| **Pack progress tracking** | 🟠 High | `sessionBuildings` tracks buildings *visited* this session, not ones actually *exported*. Must be backed by persisted storage. |
| **NBT round-trip verification** | 🔴 Unknown | The serializer is structurally correct but has never been tested against a live Minecraft instance. |
| **File naming convention** | 🟡 Medium | Exported names (e.g. `buildershut1.blueprint`) should be verified against what MineColonies actually expects. |

---

## Out of Scope for MVP

- Public deployment or hosting
- Managing multiple packs simultaneously
- Per-level undo history (undo resets on level switch — acceptable)
- Collaboration or file sharing
