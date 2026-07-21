/**
 * Pre-generates vanilla-blocks-1.21.json from minecraft-data.
 * Run once: node scripts/generate-blocks.mjs
 * The output is committed and imported directly in registry.ts.
 */
import { createRequire } from 'module'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const require = createRequire(import.meta.url)
const minecraftData = require('minecraft-data')
const data = minecraftData('1.21')

const blocks = data.blocksArray.map((b) => ({
  id: b.id,
  name: b.name,
  displayName: b.displayName,
}))

const outPath = resolve(__dirname, '../src/lib/blocks/vanilla-blocks-1.21.json')
writeFileSync(outPath, JSON.stringify(blocks, null, 2))
console.log(`Wrote ${blocks.length} blocks to ${outPath}`)
