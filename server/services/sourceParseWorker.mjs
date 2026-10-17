import { htmlBlocks, PARSER_LIMITS } from './sourceTextReading.js'
import crypto from 'node:crypto'

process.once('message', async ({ bytes, type, allowScannedPdf, allowPartialPdf, byteLimit }) => {
  try {
    let parsed
    if (type !== 'application/pdf') parsed = htmlBlocks(Buffer.from(bytes).toString('utf8'))
    else {
      const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, stopAtErrors: true, disableAutoFetch: true, verbosity: 0 })
      const document = await loading.promise
      const pageCount = document.numPages
      if (pageCount > PARSER_LIMITS.pages && !allowPartialPdf) throw Object.assign(new Error(`PDF has ${pageCount} pages; the parser limit is ${PARSER_LIMITS.pages}. Review the source manually.`), { code: 'PDF_PAGE_LIMIT' })
      const readPages = Math.min(pageCount, PARSER_LIMITS.pages)
      const blocks = []
      let characters = 0
      for (let pageNumber = 1; pageNumber <= readPages; pageNumber++) {
        const page = await document.getPage(pageNumber)
        const content = await page.getTextContent()
        let line = '', lineNumber = 1
        const flush = () => { if (line.trim()) blocks.push({ text: line.trim(), heading: /^Bachelor(?:'s)?\s+(?:of|in)\b/i.test(line.trim()) || /^(?:Description|Program Description|Obtainable Skills|Duration|Program Duration|Abbreviation)$/i.test(line.trim()), location: `PDF page ${pageNumber}, line ${lineNumber++}` }); line = '' }
        for (const item of content.items) {
          characters += item.str?.length || 0
          if (characters > PARSER_LIMITS.characters || blocks.length > PARSER_LIMITS.blocks) throw new Error('PDF text limit exceeded.')
          line += `${item.str || ''} `
          if (item.hasEOL) flush()
        }
        flush(); page.cleanup()
      }
      await loading.destroy()
      if (!blocks.length && !allowScannedPdf) throw Object.assign(new Error('No readable text found. Scanned PDFs require manual review.'), { code: 'PDF_NO_TEXT' })
      parsed = { title: '', blocks, pdf: { confirmed: true, pages: readPages, readable_text: blocks.length > 0,
        ...(readPages < pageCount ? { total_pages: pageCount, partial: true } : {}) } }
      if (readPages < pageCount && !blocks.length) {
        // Page copying runs within this same disposable, time/memory-bounded worker.
        // Never submit the original >30-page scanned document to the model.
        const { PDFDocument, PDFName } = await import('pdf-lib')
        const original = await PDFDocument.load(bytes, { updateMetadata: false })
        const subset = await PDFDocument.create({ updateMetadata: false })
        const pages = await subset.copyPages(original, Array.from({ length: readPages }, (_, i) => i))
        for (const page of pages) { page.node.delete(PDFName.of('Annots')); subset.addPage(page) }
        const inputBytes = Buffer.from(await subset.save({ addDefaultPage: false, updateFieldAppearances: false }))
        if (inputBytes.length > byteLimit) throw Object.assign(new Error('Source exceeds the download limit.'), { code: 'SIZE_LIMIT' })
        parsed.pdf_input_bytes = inputBytes
        parsed.pdf.source_sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
        parsed.pdf.input_sha256 = crypto.createHash('sha256').update(inputBytes).digest('hex')
      }
    }
    process.send({ parsed }, () => process.exit(0))
  } catch (error) {
    process.send({ error: ['PDF_PAGE_LIMIT', 'PDF_NO_TEXT', 'SIZE_LIMIT'].includes(error.code) ? error.message : 'Content is unreadable, unsupported, or exceeds parser limits. Review the source manually.', code: ['PDF_PAGE_LIMIT', 'PDF_NO_TEXT', 'SIZE_LIMIT'].includes(error.code) ? error.code : error.name }, () => process.exit(0))
  }
})
