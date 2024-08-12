'use strict'

const { workerData } = require('node:worker_threads')
const { ArrayBufferOneReadable } = require('../lib/arraybufferonestream')

const readable = new ArrayBufferOneReadable(workerData.buffer, {
  objectMode: workerData.objectMode,
  highWaterMark: workerData.highWaterMark,
})

const expected = workerData.expected

readable.setEncoding('utf8')

function run () {
  readable.on('readable', () => {
    let chunk
    while ((chunk = readable.read()) != null) {
      process._rawDebug('chunk', chunk)
      const expectedChunk = expected.shift()

      if (chunk !== expectedChunk) {
        throw new Error(`Expected ${expectedChunk}, got ${chunk}`)
      }

      if (chunk === 'errornow') {
        readable.destroy(new Error('errornow'))
      }
    }
  })
}

readable.on('error', () => {
  // ignore error
})

readable.on('close', () => {
  // This exists the worker thread
  process.exit(0)
})

run()
