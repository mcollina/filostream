'use strict'

const { describe } = require('node:test')
const { Worker } = require('node:worker_threads')
const { join } = require('node:path')
const { MessagePortWritable } = require('../lib/messageportstream')
const abstract = require('./abstract')

describe('MessagePortStream', () => {
  abstract({
    build ({ expected, objectMode = false, highWaterMark }) {
      const { port1, port2 } = new MessageChannel()
      const worker = new Worker(join(__dirname, '..', 'fixtures', 'messageportstream-worker.js'), {
        workerData: {
          port: port2,
          expected,
          objectMode,
          highWaterMark,
        },
        transferList: [port2],
      })
      const writable = new MessagePortWritable(port1, {
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
