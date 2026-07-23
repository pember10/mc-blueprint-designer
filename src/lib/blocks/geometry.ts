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

function loadTexture(dataUrl: string): THREE.Texture {
  if (textureCache.has(dataUrl)) return textureCache.get(dataUrl)!

  const tex = new THREE.Texture()
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false

  const img = new Image()
  img.onload = () => { tex.image = img; tex.needsUpdate = true }
  img.src = dataUrl

  textureCache.set(dataUrl, tex)
  return tex
}

export function disposeTextureCache(): void {
  for (const tex of textureCache.values()) tex.dispose()
  textureCache.clear()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a renderable mesh description from a resolved model and a texture data-URL map.
 *
 * @param model         Resolved model (elements + textures)
 * @param textureDataUrls   Map from texture ID (e.g. "minecraft:block/oak_planks") to data URL
 * @param xRot          Blockstate X rotation (0 | 90 | 180 | 270)
 * @param yRot          Blockstate Y rotation (0 | 90 | 180 | 270)
 */
export function buildBlockMesh(
  model: ResolvedModel,
  textureDataUrls: Record<string, string>,
  xRot = 0,
  yRot = 0,
): BlockMesh {
  // Collect all unique texture IDs referenced by the model
  const texIds = new Set<string>()
  for (const el of model.elements) {
    for (const face of Object.values(el.faces)) {
      if (face) texIds.add(face.texture)
    }
  }

  // Build material array (one per unique texture)
  const texIdList = [...texIds]
  const materials = texIdList.map((texId) => {
    const dataUrl = textureDataUrls[texId]
    const mat = new THREE.MeshLambertMaterial({
      side: THREE.FrontSide,
      transparent: false,
    })
    if (dataUrl) {
      mat.map = loadTexture(dataUrl)
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

  for (const el of model.elements) {
    const [x1, y1, z1] = el.from
    const [x2, y2, z2] = el.to

    for (const dir of DIRS) {
      const face = el.faces[dir]
      if (!face) continue

      const matIdx = texIndex.get(face.texture) ?? 0
      const corners = faceCorners(dir, x1, y1, z1, x2, y2, z2)
      const uvCorners = buildUVs(face.uv, face.rotation)
      const normal = FACE_NORMALS[dir]

      const triStart = positions.length / 3
      groups.push({ start: triStart, count: 6, materialIndex: matIdx })

      // Two triangles: [0,1,2] and [0,2,3]
      for (const idx of [0, 1, 2, 0, 2, 3]) {
        const [cx, cy, cz] = corners[idx]
        positions.push(cx / 16, cy / 16, cz / 16)  // 0-16 → 0-1
        uvs.push(...uvCorners[idx])
        normals.push(...normal)
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
