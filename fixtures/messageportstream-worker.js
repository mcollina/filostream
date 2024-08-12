'use strict'

const { workerData } = require('node:worker_threads')
const { MessagePortReadable } = require('../lib/messageportstream')

const readable = new MessagePortReadable(workerData.port, {
  objectMode: workerData.objectMode,
  highWaterMark: workerData.highWaterMark,
})

const expected = workerData.expected

readable.setEncoding('utf8')

function run () {
  readable.on('readable', () => {
    let chunk
    while ((chunk = readable.read()) != null) {
      const expectedChunk = expected.shift()

      if (chunk !== expectedChunk) {
        throw new Error(`Expected ${expectedChunk}, got ${chunk}`)
      }
    }
  })
}

run()

readable.on('close', () => {
  // This exists the worker thread
  process.exit(0)
})
