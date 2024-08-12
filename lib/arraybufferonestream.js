'use strict'

const { Readable, Writable } = require('node:stream')
const { read, write } = require('./objects')

const OFFSET = 64
// * 0: writing from worker, reading from main
const WRITTEN = 0
// * 1: writing from main, reading from worker
const READ = 1

class ArrayBufferOneReadable extends Readable {
  #buffer
  #timeout
  #meta

  constructor (buffer, opts) {
    super(opts)

    this.#buffer = buffer
    this.#timeout = opts?.timeout || 1000
    this.#meta = new Int32Array(this.#buffer)
  }

  _actualRead () {
    const chunk = read(this.#buffer, OFFSET)
    this.push(chunk)
    Atomics.store(this.#meta, WRITTEN, 0)
    Atomics.store(this.#meta, READ, 1)
    Atomics.notify(this.#meta, READ)
  }

  _read () {
    const res = Atomics.waitAsync(this.#meta, WRITTEN, 0, this.#timeout)

    if (res.async) {
      res.value.then(() => {
        process._rawDebug('>=== read')
        this._actualRead()
      })
      .catch((err) => {
        process._rawDebug(err)
        this.destroy
      })
    } else if (res.value === 'not-equal') {
      this._actualRead()
    } else if (res.value === 'timed-out') {
      // loop on _read again
      setImmediate(this._read.bind(this))
    }
  }

  _destroy (err, callback) {
    callback(err)
  }
}

class ArrayBufferOneWritable extends Writable {
  #buffer
  #timeout
  #meta

  constructor (buffer, opts) {
    super(opts)
    this.#buffer = buffer
    this.#timeout = opts?.timeout || 1000
    this.#meta = new Int32Array(this.#buffer)
  }

  _write (chunk, encoding, callback) {
    write(this.#buffer, chunk, OFFSET)
    Atomics.store(this.#meta, WRITTEN, 1)
    Atomics.notify(this.#meta, WRITTEN)

    const res = Atomics.waitAsync(this.#meta, READ, 0, this.#timeout)

    if (res.async) {
      res.value.then(() => {
        Atomics.store(this.#meta, READ, 0)
        process.nextTick(callback)
      })
      .catch((err) => {
        process._rawDebug(err)
        process.nextTick(callback, err)
      })
    } else {
      throw new Error('not yet')
    }
  }

  _final (callback) {
    callback()
  }

  _destroy (err, callback) {
    callback(err)
  }
}

module.exports.ArrayBufferOneReadable = ArrayBufferOneReadable
module.exports.ArrayBufferOneWritable = ArrayBufferOneWritable
