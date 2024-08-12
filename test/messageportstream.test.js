'use strict'

const { describe, it } = require('node:test')
const { Worker } = require('node:worker_threads')
const { join } = require('node:path')
const { MessagePortWritable } = require('../lib/messageportstream')
const { once } = require('node:events')

describe('MessagePortStream', () => {
  it('should pass through "helloworld"', async () => {
    const { port1, port2 } = new MessageChannel()
    const worker = new Worker(join(__dirname, '..', 'fixtures', 'messageportstream-worker.js'), {
      workerData: {
        port: port2,
        expected: ['hello', 'world'],
      },
      transferList: [port2],
    })
    const writable = new MessagePortWritable(port1)

    writable.write('hello')
    writable.write('world')
    writable.end()

    await Promise.all([
      once(worker, 'exit'),
      once(writable, 'close'),
    ])
  })

  it('should pass through errors from Readable to Writable', async (t) => {
    t.plan(1)
    const { port1, port2 } = new MessageChannel()
    const worker = new Worker(join(__dirname, '..', 'fixtures', 'messageportstream-worker.js'), {
      workerData: {
        port: port2,
        expected: ['errornow'],
      },
      transferList: [port2],
    })
    const writable = new MessagePortWritable(port1)

    writable.write('errornow')

    const [err] = await once(writable, 'error')
    t.assert.strictEqual(err.message, 'errornow')

    await once(worker, 'exit')
  })

  it('should pass through errors from Writable to Readable', async (t) => {
    t.plan(1)
    const { port1, port2 } = new MessageChannel()
    const worker = new Worker(join(__dirname, '..', 'fixtures', 'messageportstream-worker.js'), {
      workerData: {
        port: port2,
        expected: ['errornow'],
      },
      transferList: [port2],
    })
    const writable = new MessagePortWritable(port1)
    writable.on('error', (err) => {
      t.assert.strictEqual(err.message, 'errornow')
    })
    writable.destroy(new Error('errornow'))

    await once(worker, 'exit')
  })

  it('should support backpressure', async (t) => {
    t.plan(62)

    const { port1, port2 } = new MessageChannel()
    const expected = Array.from({ length: 1000 }, (_, i) => i.toString())
    const worker = new Worker(join(__dirname, '..', 'fixtures', 'messageportstream-worker.js'), {
      workerData: {
        port: port2,
        objectMode: true,
        expected,
      },
      transferList: [port2],
    })
    const writable = new MessagePortWritable(port1, { objectMode: true })

    writable.on('drain', () => {
      t.assert.ok('drain event emitted')
    })

    for (const chunk of expected) {
      const res = writable.write(chunk)
      if (!res) {
        await once(writable, 'drain')
      }
    }

    writable.end()

    await Promise.all([
      once(worker, 'exit'),
      once(writable, 'close'),
    ])
  })

  it('should pass support backpressure from the other side', async () => {
    const { port1, port2 } = new MessageChannel()
    const expected = Array.from({ length: 1000 }, (_, i) => i.toString())
    const worker = new Worker(join(__dirname, '..', 'fixtures', 'messageportstream-worker.js'), {
      workerData: {
        port: port2,
        objectMode: true,
        expected,
        highWaterMark: 1,
      },
      transferList: [port2],
    })
    const writable = new MessagePortWritable(port1)

    for (const chunk of expected) {
      const res = writable.write(chunk)
      if (!res) {
        await once(writable, 'drain')
      }
    }

    writable.end()

    await Promise.all([
      once(worker, 'exit'),
      once(writable, 'close'),
    ])
  })
})
