import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const serverRoot = fileURLToPath(new URL('../', import.meta.url))

test('shared runtime modules load from a server-only deployment package', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'learnmatch-shared-package-'))
  try {
    const directory = path.join(serverRoot, 'shared')
    const files = (await fs.readdir(directory)).filter(name => name.endsWith('.js'))
    assert.ok(files.length > 0)
    await fs.cp(directory, path.join(temporary, 'shared'), { recursive: true })
    for (const file of files) {
      const isolated = await import(pathToFileURL(path.join(temporary, 'shared', file)).href)
      const frontend = await import(new URL(`../../shared/${file}`, import.meta.url))
      const backend = await import(new URL(`../shared/${file}`, import.meta.url))
      assert.deepEqual(Object.keys(isolated), Object.keys(backend))
      assert.deepEqual(Object.keys(frontend), Object.keys(backend))
      for (const key of Object.keys(backend)) assert.equal(frontend[key], backend[key])
    }
    for (const subdirectory of ['routes', 'services', 'data']) {
      const parent = path.join(serverRoot, subdirectory)
      for (const file of (await fs.readdir(parent)).filter(name => name.endsWith('.js'))) {
        const contents = await fs.readFile(path.join(parent, file), 'utf8')
        assert.doesNotMatch(contents, /from\s+['"]\.\.\/\.\.\/shared\//, `${subdirectory}/${file} escapes the server deployment root`)
      }
    }
  } finally {
    assert.equal(path.dirname(path.resolve(temporary)), path.resolve(os.tmpdir()))
    assert.match(path.basename(temporary), /^learnmatch-shared-package-[a-zA-Z0-9]+$/)
    await fs.rm(temporary, { recursive: true, force: true })
  }
})
