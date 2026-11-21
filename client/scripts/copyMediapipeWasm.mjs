import { cp, mkdir } from 'node:fs/promises'

// Self-host the MediaPipe WebAssembly runtime so the strict CSP never needs a CDN.
// Runs before dev/build; output is generated and git-ignored. Models live in public/mediapipe/models.
const source = new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url)
const target = new URL('../public/mediapipe/wasm/', import.meta.url)
await mkdir(target, { recursive: true })
await cp(source, target, { recursive: true })
