import test from 'node:test'
import assert from 'node:assert/strict'
import { htmlBlocks, PARSER_LIMITS } from '../services/sourceTextReading.js'
import { parseSourceContent } from '../services/sourceParserService.js'
import { checkUnsavedSource, confirmUnsavedSource, readSourceReceipt } from '../services/sourceCheckService.js'
import { approvedPublisherHosts } from '../services/sourcePublisherPolicy.js'
import { detectCourseSupport } from '../services/sourceDetectionService.js'

function pdf(lines) {
  const content = 'BT\n/F1 12 Tf\n50 750 Td\n' + lines.map((line, i) => `${i ? '0 -20 Td\n' : ''}(${line.replaceAll('(', '\\(').replaceAll(')', '\\)')}) Tj\n`).join('') + 'ET\n'
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>', `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  let text = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(text)); text += `${i + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(text)
  text += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => String(offset).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(text)
}

const target='Bachelor of Science in Biology'
const url='https://official.example.edu/program'
const html=`<h1>${target}</h1><p>Description: Students study biological sciences and laboratory methods.</p>`

test('detects target-specific supporting text, not a list entry, unrelated program, hidden script or generated details',()=>{
  const detect=value=>detectCourseSupport(htmlBlocks(value),target,url)
  const result=detect(html)
  assert.equal(result.status,'Potential Match')
  assert.ok(result.excerpts.every(item=>item.text && item.location && item.url===url))
  assert.ok(!Object.hasOwn(result,'suggestions') && !Object.hasOwn(result,'candidates'))
  for(const content of [`<h1>${target}</h1>`,`<h1>${target}</h1><h1>Bachelor of Arts in History</h1><p>Description: Students study historical events and cultures.</p>`,'<h1>Bachelor of Science in Marine Biology</h1><p>Description: Students study ocean and marine science.</p>',`<script>${target}</script><p>Description: Students study something else.</p>`]) assert.equal(detect(content).status,'Needs Review')
  assert.throws(()=>htmlBlocks(`<p>${'x'.repeat(PARSER_LIMITS.characters+1)}</p>`),/limit/)
})

test('normal PDF reading handles text and bounded larger PDFs; scanned content requires manual review',async()=>{
  const bytes=pdf([target,'Description: Students study biological science and laboratory methods.'])
  const parsed=await parseSourceContent(bytes,'application/pdf')
  const result=detectCourseSupport(parsed,target,url)
  assert.equal(result.status,'Potential Match')
  assert.ok(result.excerpts.every(item=>item.location.startsWith('PDF page 1')))
  assert.ok((await parseSourceContent(Buffer.concat([bytes,Buffer.alloc(2300000,32)]),'application/pdf')).blocks.length)
  await assert.rejects(parseSourceContent(pdf([]),'application/pdf'),{code:'PDF_NO_TEXT'})
  const scan = await parseSourceContent(pdf([]), 'application/pdf', { allowScannedPdf: true })
  assert.deepEqual(scan.blocks, [])
  assert.deepEqual(scan.pdf, { confirmed: true, pages: 1, readable_text: false })
  const readable = await parseSourceContent(bytes, 'application/pdf', { allowScannedPdf: true })
  assert.equal(readable.pdf.readable_text, true)
  assert.ok(readable.blocks.length)
  assert.equal(Object.hasOwn(await parseSourceContent(Buffer.from('<p>No PDF here.</p>'), 'text/html', { allowScannedPdf: true }), 'pdf'), false)
  await assert.rejects(parseSourceContent(Buffer.from('not PDF'),'application/pdf'),/Invalid/)
  await assert.rejects(parseSourceContent(Buffer.alloc(7*1024*1024),'application/pdf'),/oversized/)
})

test('checks require a name before fetching; signed detection reports preserve confirmation and reject stale names/actors',async()=>{
  for (const value of ['*.gov.ph','https://official.example.edu','official.example.edu:443']) assert.throws(()=>approvedPublisherHosts({SOURCE_APPROVED_PUBLISHER_HOSTS:value}))
  const priorSecret=process.env.JWT_SECRET,priorHosts=process.env.SOURCE_APPROVED_PUBLISHER_HOSTS
  process.env.JWT_SECRET='detection-test-secret';process.env.SOURCE_APPROVED_PUBLISHER_HOSTS='official.example.edu'
  const options={courseName:target,fetch:async()=>({bytes:Buffer.from(html),type:'text/html',final_url:url}),parse:async bytes=>htmlBlocks(bytes.toString())}
  try{
    let fetched=false
    await assert.rejects(checkUnsavedSource(url,7,{fetch:async()=>{fetched=true}}),{status:400})
    assert.equal(fetched,false)
    const checked=await checkUnsavedSource(url,7,options)
    assert.equal(checked.report.status,'Potential Match')
    assert.equal(checked.report.target_course_name,target)
    assert.ok(!Object.hasOwn(checked.report,'suggestions') && !Object.hasOwn(checked.report,'candidates'))
    const source={title:'Manual source title',url,supported_fields:['course_name']}
    assert.ok(confirmUnsavedSource({source,course:{course_name:target},confirmed:true,check_receipt:checked.check_receipt},7).confirmation_receipt)
    assert.throws(()=>confirmUnsavedSource({source,course:{course_name:'Changed course'},confirmed:true,check_receipt:checked.check_receipt},7),{status:409})
    assert.throws(()=>readSourceReceipt(checked.check_receipt,'check',8),{status:409})
    for(const final_url of ['https://evil.com/official.example.edu','https://sub.official.example.edu','https://other.gov.ph','https://official.example.edu.evil.com']){
      const result=await checkUnsavedSource(url,7,{...options,fetch:async()=>({bytes:Buffer.from(html),type:'text/html',final_url})})
      assert.equal(result.report.status,'Needs Review')
      assert.equal(result.report.publisher_origin.verified,false)
      assert.deepEqual(result.report.excerpts,[])
      assert.equal(result.report.parse_status,'not_attempted')
    }
    process.env.SOURCE_APPROVED_PUBLISHER_HOSTS=''
    assert.equal(readSourceReceipt(checked.check_receipt,'check',7).status,'Needs Review')
    await assert.rejects(checkUnsavedSource(url,7,options),{status:400})
    process.env.SOURCE_APPROVED_PUBLISHER_HOSTS='official.example.edu'
    const scanned=await checkUnsavedSource(url,7,{courseName:target,fetch:async()=>({bytes:pdf([]),type:'application/pdf',final_url:url})})
    assert.equal(scanned.report.status,'Needs Review')
    assert.match(scanned.report.reasons[0],/scanned.*manually/)
    assert.deepEqual(scanned.report.excerpts,[])
    const failed=await checkUnsavedSource(url,7,{courseName:target,fetch:async()=>{throw Object.assign(new Error('Source exceeds the download limit.'),{code:'SIZE_LIMIT'})}})
    assert.deepEqual(failed.report.reasons,['Source exceeds the download limit.'])
    assert.equal(failed.report.parse_status,'not_attempted')
  }finally{if(priorSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=priorSecret;if(priorHosts===undefined)delete process.env.SOURCE_APPROVED_PUBLISHER_HOSTS;else process.env.SOURCE_APPROVED_PUBLISHER_HOSTS=priorHosts}
})
