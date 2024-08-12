'use strict'

const { it } = require('node:test')
const { once } = require('node:events')

module.exports = function ({ build }) {
  it('should pass through "helloworld"', async () => {
    const {
      worker,
      writable,
    } = await build({ expected: ['hello', 'world'] })

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
    const { worker, writable } = await build({ expected: ['errornow'] })

    writable.write('errornow')

    const [err] = await once(writable, 'error')
    t.assert.strictEqual(err.message, 'errornow')

    await once(worker, 'exit')
  })

  it('should pass through errors from Writable to Readable', async (t) => {
    t.plan(1)
    const { worker, writable } = await build({ expected: ['errornow'] })
    writable.on('error', (err) => {
      t.assert.strictEqual(err.message, 'errornow')
    })
    writable.destroy(new Error('errornow'))

    await once(worker, 'exit')
  })

  it('should support backpressure', async (t) => {
    t.plan(62)

    const expected = Array.from({ length: 1000 }, (_, i) => i.toString())
    const {
      worker,
      writable,
    } = await build({ expected, objectMode: true })

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
    const expected = Array.from({ length: 1000 }, (_, i) => i.toString())
    const {
      worker,
      writable,
    } = await build({ expected, objectMode: true, highWaterMark: 1 })

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
}
