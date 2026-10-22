/* eslint-env mocha */

const net = require('net')
const assert = require('power-assert')
const mc = require('../')
const { getPort } = require('./common/util')

describe('ping', function () {
  this.timeout(10000)

  it('fails as soon as the server closes the connection without answering', async () => {
    const port = await getPort()
    // accepts the handshake, then hangs up — what vanilla does while it has no status snapshot
    const server = net.createServer(socket => {
      socket.on('data', () => {})
      setTimeout(() => socket.end(), 20)
    })
    await new Promise(resolve => server.listen(port, '127.0.0.1', resolve))

    const start = Date.now()
    const err = await mc.ping({ host: '127.0.0.1', port, closeTimeout: 5000 }).then(() => null, err => err)
    const elapsed = Date.now() - start
    server.close()

    assert.ok(err, 'ping resolved against a server that never answered')
    assert.ok(/closed/.test(err.message), `unexpected error: ${err.message}`)
    assert.ok(elapsed < 5000, `ping waited ${elapsed}ms for closeTimeout instead of failing on close`)
  })
})
