/**
 * Builds Three.js BufferGeometry + MeshLambertMaterial[] from a resolved block model.
 *
 * Each unique texture gets its own material. The geometry uses `groups` so that
 * Three.js knows which triangle range uses which material.
 *
 * All positions are in 0-1 block-space (Minecraft's 0-16 space ÷ 16).
 */

import * as THREE from 'three'
import type { FaceDir, ResolvedModel } from './model'
import { resolveTextureById, fetchTextureMcmeta } from './textures'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BlockMesh {
  geometry: THREE.BufferGeometry
  materials: THREE.MeshLambertMaterial[]
}

// ---------------------------------------------------------------------------
// Face geometry tables
// ---------------------------------------------------------------------------

type Corner = [number, number, number]

// For each face direction, given [x1,y1,z1]-[x2,y2,z2] in 0-16 space:
// returns 4 corners in CCW winding (when viewed from outside) + UV corner order.
// Corners indexed as: [0]=TopLeft, [1]=TopRight, [2]=BottomRight, [3]=BottomLeft
// "Top/Bottom" and "Left/Right" defined by Minecraft's canonical UV orientation per face.

function faceCorners(
  dir: FaceDir,
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
): [Corner, Corner, Corner, Corner] {
  // All values in 0-16 space; divide by 16 when writing to buffer.
  // Winding: CCW when the face normal points toward the viewer.
  switch (dir) {
    case 'up':    // normal +Y, UV: u→+X, v→+Z
      return [[x1, y2, z1], [x2, y2, z1], [x2, y2, z2], [x1, y2, z2]]
    case 'down':  // normal -Y, UV: u→+X, v→-Z (flip Z)
      return [[x1, y1, z2], [x2, y1, z2], [x2, y1, z1], [x1, y1, z1]]
    case 'north': // normal -Z, UV: u→-X, v→-Y
      return [[x2, y2, z1], [x1, y2, z1], [x1, y1, z1], [x2, y1, z1]]
    case 'south': // normal +Z, UV: u→+X, v→-Y
      return [[x1, y2, z2], [x2, y2, z2], [x2, y1, z2], [x1, y1, z2]]
    case 'west':  // normal -X, UV: u→+Z, v→-Y
      return [[x1, y2, z2], [x1, y2, z1], [x1, y1, z1], [x1, y1, z2]]
    case 'east':  // normal +X, UV: u→-Z, v→-Y
      return [[x2, y2, z1], [x2, y2, z2], [x2, y1, z2], [x2, y1, z1]]
  }
}

const FACE_NORMALS: Record<FaceDir, [number, number, number]> = {
  up:    [0,  1,  0],
  down:  [0, -1,  0],
  north: [0,  0, -1],
  south: [0,  0,  1],
  west:  [-1, 0,  0],
  east:  [1,  0,  0],
}

// ---------------------------------------------------------------------------
// UV helpers
// ---------------------------------------------------------------------------

/**
 * Map a face's UV [u1,v1,u2,v2] (0-16) and optional face rotation to the
 * per-vertex UV in Three.js space (Y flipped: MC v=0 → Three Y=1).
 *
 * Returns 4 UV pairs corresponding to the 4 corners [TL, TR, BR, BL].
 */
function buildUVs(
  uv: [number, number, number, number],
  faceRotation: number = 0,
): [[number, number], [number, number], [number, number], [number, number]] {
  const [u1, v1, u2, v2] = uv.map((v) => v / 16)

  // Base UVs in Three.js space (V inverted: MC top = Three bottom of V axis)
  let corners: [[number, number], [number, number], [number, number], [number, number]] = [
    [u1, 1 - v1], // TL
    [u2, 1 - v1], // TR
    [u2, 1 - v2], // BR
    [u1, 1 - v2], // BL
  ]

  // Apply Minecraft face rotation (rotates UV 90° steps CCW in texture space)
  const steps = ((faceRotation / 90) % 4 + 4) % 4
  for (let i = 0; i < steps; i++) {
    corners = [corners[1], corners[2], corners[3], corners[0]]
  }

  return corners
}

// ---------------------------------------------------------------------------
// Texture loading
// ---------------------------------------------------------------------------

const textureCache = new Map<string, THREE.Texture>()

// ---------------------------------------------------------------------------
// Animated-texture state
// ---------------------------------------------------------------------------

interface AnimState {
  tex: THREE.Texture
  frameCount: number
  /** Ordered sequence of sprite-sheet row indices to display (from mcmeta, or 0…N-1). */
  frames: number[]
  /** Current position within `frames`. */
  frameIdx: number
  msPerFrame: number
  elapsed: number
}

const animatedTextures: AnimState[] = []

/**
 * Advance all animated block textures by `deltaMs` milliseconds.
 * Call once per render frame from a useFrame() hook in the R3F scene.
 *
 * Respects mcmeta `frames[]` (ping-pong, custom order) and `frametime`.
 * Default is 100 ms/frame (2 game ticks) which matches most fluid textures.
 *
 * Note from minecraft-renderer (zardoy): that library handles this by writing
 * updated pixel regions back into the blocks atlas texture each tick.
 * We use Three.js texture.offset instead, which is simpler but equivalent.
 */
export function tickAnimatedTextures(deltaMs: number): void {
  for (const s of animatedTextures) {
    s.elapsed += deltaMs
    if (s.elapsed >= s.msPerFrame) {
      const advance = Math.floor(s.elapsed / s.msPerFrame)
      s.elapsed %= s.msPerFrame
      s.frameIdx = (s.frameIdx + advance) % s.frames.length
      const frame = s.frames[s.frameIdx]
      // Three.js V=0 is bottom; frame 0 is at top of sprite sheet.
      s.tex.offset.y = (s.frameCount - 1 - frame) / s.frameCount
    }
  }
}

function loadTexture(dataUrl: string, texId?: string): THREE.Texture {
  if (textureCache.has(dataUrl)) return textureCache.get(dataUrl)!

  const tex = new THREE.Texture()
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false

  const img = new Image()
  img.onload = () => {
    tex.image = img
    const w = img.naturalWidth
    const h = img.naturalHeight
    if (h > w && h % w === 0) {
      const N = h / w
      tex.repeat.set(1, 1 / N)
      tex.offset.set(0, (N - 1) / N)  // frame 0 at top of sheet

      // Default: linear frame sequence 0…N-1
      const state: AnimState = {
        tex,
        frameCount: N,
        frames: Array.from({ length: N }, (_, i) => i),
        frameIdx: 0,
        msPerFrame: 100,
        elapsed: 0,
      }
      animatedTextures.push(state)

      // Fetch mcmeta to get the real frame order + timing (e.g. lava ping-pong)
      if (texId) {
        fetchTextureMcmeta(texId).then(mcmeta => {
          if (!mcmeta) return
          if (mcmeta.frames && mcmeta.frames.length > 0) {
            state.frames = mcmeta.frames.map(f =>
              typeof f === 'number' ? f : f.index,
            )
          }
          if (mcmeta.frametime) {
            // mcmeta frametime is in game ticks; 1 tick = 50 ms
            state.msPerFrame = mcmeta.frametime * 50
          }
          // Reset to frame 0 of the new sequence
          state.frameIdx = 0
          const frame = state.frames[0]
          tex.offset.y = (state.frameCount - 1 - frame) / state.frameCount
        }).catch(() => { /* ignore network errors */ })
      }
    }
    tex.needsUpdate = true
  }
  img.src = dataUrl

  textureCache.set(dataUrl, tex)
  return tex
}

export function disposeTextureCache(): void {
  for (const tex of textureCache.values()) tex.dispose()
  textureCache.clear()
  animatedTextures.length = 0
}

// ---------------------------------------------------------------------------
// Element-level rotation helpers
// ---------------------------------------------------------------------------

type ElemRot = {
  origin: [number, number, number]
  axis: 'x' | 'y' | 'z'
  angle: number
  rescale?: boolean
}

/**
 * Apply a Minecraft element rotation to a corner vertex (0-16 space).
 * When rescale=true the vertex is pre-scaled around the origin so the
 * element keeps full-block coverage after rotation (Minecraft "rescale" flag).
 */
function applyElemRot([x, y, z]: Corner, { origin: [ox, oy, oz], axis, angle, rescale }: ElemRot): Corner {
  const rad  = (angle * Math.PI) / 180
  const cosA = Math.cos(rad)
  const sinA = Math.sin(rad)

  if (rescale) {
    const sf = 1 / cosA
    if      (axis === 'y') { x = ox + (x - ox) * sf; z = oz + (z - oz) * sf }
    else if (axis === 'x') { y = oy + (y - oy) * sf; z = oz + (z - oz) * sf }
    else                   { x = ox + (x - ox) * sf; y = oy + (y - oy) * sf }
  }

  const px = x - ox, py = y - oy, pz = z - oz
  let   rx = px,     ry = py,     rz = pz
  if      (axis === 'y') { rx = px * cosA - pz * sinA; rz = px * sinA + pz * cosA }
  else if (axis === 'x') { ry = py * cosA - pz * sinA; rz = py * sinA + pz * cosA }
  else                   { rx = px * cosA - py * sinA; ry = px * sinA + py * cosA }
  return [rx + ox, ry + oy, rz + oz]
}

/** Rotate a face normal (no translation, no rescale). */
function rotateNormal([nx, ny, nz]: [number, number, number], axis: 'x' | 'y' | 'z', angle: number): [number, number, number] {
  const rad = (angle * Math.PI) / 180
  const c = Math.cos(rad), s = Math.sin(rad)
  if (axis === 'y') return [nx * c - nz * s, ny,             nx * s + nz * c]
  if (axis === 'x') return [nx,              ny * c - nz * s, ny * s + nz * c]
  return                   [nx * c - ny * s, nx * s + ny * c, nz]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a renderable mesh description from a resolved model.
 * Textures are fetched automatically via CDN/IDB/memCache.
 *
 * @param model  Resolved model (elements + textures)
 * @param xRot   Blockstate X rotation (0 | 90 | 180 | 270)
 * @param yRot   Blockstate Y rotation (0 | 90 | 180 | 270)
 */
export async function buildBlockMesh(
  model: ResolvedModel,
  xRot = 0,
  yRot = 0,
): Promise<BlockMesh> {
  // Fluid blocks (lava, water, etc.) have no elements in their model JSON —
  // Minecraft renders them through its own fluid pipeline. Synthesize a plain
  // full-cube element so we can at least show the animated texture.
  let elements = model.elements
  if (elements.length === 0) {
    const fallbackTexId =
      model.textures['particle'] ?? Object.values(model.textures)[0]
    if (fallbackTexId) {
      const allFaces = { uv: [0, 0, 16, 16] as [number, number, number, number], texture: fallbackTexId }
      elements = [{
        from: [0, 0, 0],
        to: [16, 16, 16],
        faces: {
          up: allFaces, down: allFaces,
          north: allFaces, south: allFaces,
          east: allFaces, west: allFaces,
        },
      }]
    }
  }

  // Collect unique texture IDs and resolve them all concurrently
  const texIds = new Set<string>()
  for (const el of elements) {
    for (const face of Object.values(el.faces)) {
      if (face) texIds.add(face.texture)
    }
  }
  const textureDataUrls: Record<string, string> = {}
  await Promise.all([...texIds].map(async (id) => {
    textureDataUrls[id] = await resolveTextureById(id)
  }))

  // Build material array (one per unique texture)
  const texIdList = [...texIds]
  const materials = texIdList.map((texId) => {
    const dataUrl = textureDataUrls[texId]
    const mat = new THREE.MeshLambertMaterial({
      side: THREE.FrontSide,
      alphaTest: 0.5,
    })
    if (dataUrl) {
      mat.map = loadTexture(dataUrl, texId)
      // Water textures are grey/transparent and rely on a biome tint.
      // Apply the vanilla plains water color so the cube isn't grey.
      if (texId.includes('water')) {
        mat.color = new THREE.Color(0x3F76E4)
        mat.transparent = true
        mat.alphaTest = 0.01
      }
      mat.needsUpdate = true
    } else {
      // Fallback: tinted grey
      mat.color = new THREE.Color(0x888888)
    }
    return mat
  })
  const texIndex = new Map(texIdList.map((id, i) => [id, i]))

  // Accumulate per-face geometry data
  const positions: number[] = []
  const uvs: number[] = []
  const normals: number[] = []
  const groups: { start: number; count: number; materialIndex: number }[] = []

  const DIRS: FaceDir[] = ['up', 'down', 'north', 'south', 'west', 'east']
  // up/down/north/south: corners are in [TL,TR,BR,BL] UV order but produce
  // inverted normals with [0,1,2,0,2,3] — reverse the winding.
  // west/east are already correct with standard order.
  const REVERSED_WINDING = new Set<FaceDir>(['up', 'down', 'north', 'south'])

  for (const el of elements) {
    const [x1, y1, z1] = el.from
    const [x2, y2, z2] = el.to

    for (const dir of DIRS) {
      const face = el.faces[dir]
      if (!face) continue

      const matIdx = texIndex.get(face.texture) ?? 0
      const corners = faceCorners(dir, x1, y1, z1, x2, y2, z2)
      const uvCorners = buildUVs(face.uv, face.rotation)
      const rawNormal = FACE_NORMALS[dir]
      const faceNormal: [number, number, number] = el.rotation
        ? rotateNormal(rawNormal, el.rotation.axis, el.rotation.angle)
        : rawNormal

      const triStart = positions.length / 3
      groups.push({ start: triStart, count: 6, materialIndex: matIdx })

      // Reversed: [0,2,1,0,3,2] fixes inverted normals while keeping UV order
      const triIdx = REVERSED_WINDING.has(dir) ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]
      for (const idx of triIdx) {
        const c = el.rotation ? applyElemRot(corners[idx], el.rotation) : corners[idx]
        positions.push(c[0] / 16, c[1] / 16, c[2] / 16)  // 0-16 → 0-1
        uvs.push(...uvCorners[idx])
        normals.push(...faceNormal)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  for (const g of groups) geometry.addGroup(g.start, g.count, g.materialIndex)

  // Apply blockstate rotation (Y then X)
  if (yRot !== 0 || xRot !== 0) {
    const m = new THREE.Matrix4()
    if (yRot !== 0) m.multiply(new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(-yRot)))
    if (xRot !== 0) m.multiply(new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(-xRot)))
    // Rotate around the block centre (0.5, 0.5, 0.5)
    const pivot = new THREE.Matrix4().makeTranslation(0.5, 0.5, 0.5)
    const pivotInv = new THREE.Matrix4().makeTranslation(-0.5, -0.5, -0.5)
    geometry.applyMatrix4(pivot.multiply(m).multiply(pivotInv))
  }

  return { geometry, materials }
}
