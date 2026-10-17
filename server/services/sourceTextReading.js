import { Parser } from 'htmlparser2'

export const PARSER_LIMITS = Object.freeze({ characters: 160000, blocks: 4000, nodes: 30000, depth: 80, pages: 30, milliseconds: 6000 })
const clean = (text) => String(text).replace(/\s+/gu, ' ').trim()
export function htmlBlocks(html) {
  const blocks = []
  let text = '', ignored = 0, depth = 0, nodes = 0, heading = false, characters = 0
  const skipped = new Set(['script', 'style', 'nav', 'footer', 'noscript', 'svg', 'template', 'title'])
  const boundary = new Set(['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'tr', 'br', 'section', 'article', 'dt', 'dd'])
  const flush = () => {
    const value = clean(text); text = ''
    if (value) blocks.push({ text: value, heading, location: `Webpage block ${blocks.length + 1}` })
    if (blocks.length > PARSER_LIMITS.blocks) throw new Error('Parser block limit exceeded.')
  }
  const parser = new Parser({
    onopentag(name) {
      if (++nodes > PARSER_LIMITS.nodes || ++depth > PARSER_LIMITS.depth) throw new Error('Parser structure limit exceeded.')
      if (skipped.has(name) || ignored) { ignored++; return }
      if (boundary.has(name)) { flush(); heading = /^h[1-5]$/.test(name) }
    },
    ontext(value) {
      characters += value.length
      if (characters > PARSER_LIMITS.characters) throw new Error('Parser text limit exceeded.')
      if (ignored) return
      text += value
    },
    onclosetag(name) {
      depth = Math.max(0, depth - 1)
      if (ignored) { ignored--; return }
      if (boundary.has(name)) { flush(); heading = false }
    },
  }, { decodeEntities: true })
  parser.write(html); parser.end(); flush()
  return { blocks }
}
