'use strict'

const { describe } = require('node:test')
const { Worker } = require('node:worker_threads')
const { join } = require('node:path')
const { ArrayBufferOneWritable } = require('../lib/arraybufferonestream')
const abstract = require('./abstract')

describe('ArrayBufferOneStream', () => {
  abstract({
    build ({ expected, objectMode = false, highWaterMark }) {
      const buffer = new SharedArrayBuffer(1024, { maxByteLength: 64 * 1024 * 1024 })
      const worker = new Worker(join(__dirname, '..', 'fixtures', 'arraybufferonestream-worker.js'), {
        workerData: {
          buffer,
          expected,
          objectMode,
          highWaterMark,
        },
      })
      const writable = new ArrayBufferOneWritable(buffer, {
        objectMode,
        highWaterMark,
      })
      return {
        worker,
        writable,
      }
    },
  })
})
