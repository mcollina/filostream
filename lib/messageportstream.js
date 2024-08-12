'use strict'

const { Readable, Writable } = require('node:stream')

class MessagePortReadable extends Readable {
  constructor (port, opts) {
    super(opts)
    this.port = port
    this.port.on('message', ({ type, chunk, err }) => {
      if (type === 'closeWritable') {
        this.push(null)

        this.once('end', () => {
          this.port.postMessage({
            type: 'closeReadable',
          })
        })
        return
      } else if (type === 'error') {
        this.destroy(err)
        this.port.close()
        return
        /* c8 ignore next 3 */
      } else if (type !== 'chunk') {
        return
      }

      const res = this.push(chunk)

      if (!res) {
        this.port.postMessage({
          type: 'ack',
        })
      }
    })
  }

  _read () {
    // Send a "drain" message.
    this.port.postMessage({
      type: 'ack',
    })
  }

  _destroy (err, callback) {
    // Send a "drain" message.
    this.port.postMessage({
      type: 'error',
      err,
    })
    this.port.close()
    setImmediate(callback, err)
  }
}

class MessagePortWritable extends Writable {
  constructor (port, opts) {
    super(opts)
    this.port = port
    this.port.on('close', () => {
      this.destroy()
    })

    this.port.on('message', ({ type, err }) => {
      if (type === 'error') {
        this.destroy(err)
        this.port.close()
      }
    })
  }

  _write (chunk, encoding, callback) {
    this.port.postMessage({
      type: 'chunk',
      chunk,
    })

    const ack = ({ type }) => {
      if (type === 'ack') {
        this.port.off('message', ack)
        // TODO handle errors?
        callback()
      }
    }
    this.port.on('message', ack)
  }

  _final (callback) {
    this.port.postMessage({
      type: 'closeWritable',
    })

    this.port.on('message', ({ type }) => {
      if (type === 'closeReadable') {
        this.port.close()
        callback()
      }
    })
  }

  _destroy (err, callback) {
    // Send a "drain" message.
    this.port.postMessage({
      type: 'error',
      err,
    })
    this.port.close()
    setImmediate(callback, err)
  }
}

module.exports.MessagePortReadable = MessagePortReadable
module.exports.MessagePortWritable = MessagePortWritable
