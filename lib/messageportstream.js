'use strict'

const { Readable, Writable } = require('node:stream')

class MessagePortReadable extends Readable {
  constructor (port, opts) {
    super(opts)
    this.port = port
    this.port.on('message', ({ type, chunk }) => {
      if (type === 'closeWritable') {
        this.push(null)

        this.once('end', () => {
          this.port.postMessage({
            type: 'closeReadable',
          })
        })
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
}

class MessagePortWritable extends Writable {
  constructor (port, opts) {
    super(opts)
    this.port = port
    this.port.on('close', () => {
      this.destroy()
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
}

module.exports.MessagePortReadable = MessagePortReadable
module.exports.MessagePortWritable = MessagePortWritable
