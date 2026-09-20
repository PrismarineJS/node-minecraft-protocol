/* eslint-env mocha */
const assert = require('assert')
const { ProtoDef } = require('protodef')
const { ProtoDefCompiler } = require('protodef').Compiler
const [readVecDelta, writeVecDelta, sizeOfVecDelta] = require('../src/datatypes/vecDelta')

// What a vanilla 26.3 server writes after the entity id of rel_entity_move
const VANILLA_PAYLOADS = [
  ['007fff00000000', { onGround: false, dX: 32767, dY: 0, dZ: 0 }],
  ['01000080000000', { onGround: true, dX: 0, dY: -32768, dZ: 0 }],
  ['0100000000ffff', { onGround: true, dX: 0, dY: 0, dZ: -1 }],
  ['0200000100020003', { onGround: false, steps: [{ ticks: 0, dX: 1, dY: 2, dZ: 3 }] }],
  ['03ffffffff07000100020003', { onGround: true, steps: [{ ticks: 2147483647, dX: 1, dY: 2, dZ: 3 }] }],
  ['050100010002000302fffffffefffd', {
    onGround: true,
    steps: [{ ticks: 1, dX: 1, dY: 2, dZ: 3 }, { ticks: 2, dX: -1, dY: -2, dZ: -3 }]
  }],
  ['06007fff800000007f0000000000008001000100010001', {
    onGround: false,
    steps: [{ ticks: 0, dX: 32767, dY: -32768, dZ: 0 }, { ticks: 127, dX: 0, dY: 0, dZ: 0 }, { ticks: 128, dX: 1, dY: 1, dZ: 1 }]
  }]
]

const protocol = {
  types: {
    varint: 'native',
    vecDelta: 'native',
    rel_entity_move: ['container', [{ name: 'entityId', type: 'varint' }, { name: 'delta', type: 'vecDelta' }]]
  }
}

function write (value) {
  const buffer = Buffer.alloc(sizeOfVecDelta(value))
  assert.strictEqual(writeVecDelta(value, buffer, 0), buffer.length, 'sizeOf and write disagree')
  return buffer
}

describe('vecDelta', () => {
  it('reads vanilla bytes', () => {
    for (const [hex, value] of VANILLA_PAYLOADS) {
      const result = readVecDelta(Buffer.from(hex, 'hex'), 0)
      assert.deepStrictEqual(result.value, value, 'unexpected value for ' + hex)
      assert.strictEqual(result.size, hex.length / 2)
    }
  })

  it('writes the bytes vanilla writes', () => {
    for (const [hex, value] of VANILLA_PAYLOADS) {
      assert.strictEqual(write(value).toString('hex'), hex)
    }
  })

  it('reads from an offset', () => {
    const result = readVecDelta(Buffer.from('ffff0200000100020003', 'hex'), 2)
    assert.deepStrictEqual(result, { value: VANILLA_PAYLOADS[3][1], size: 8 })
  })

  it('spills the step count into a second properties byte at 64 steps', () => {
    const steps = Array.from({ length: 64 }, (_, i) => ({ ticks: i, dX: i, dY: i - 64, dZ: 1 }))
    const buffer = write({ onGround: true, steps })
    assert.strictEqual(buffer.subarray(0, 2).toString('hex'), '8101')
    assert.deepStrictEqual(readVecDelta(buffer, 0), { value: { onGround: true, steps }, size: buffer.length })
  })

  it('is registered for interpreted and compiled protocols', () => {
    const interpreted = new ProtoDef(false)
    interpreted.addTypes(require('../src/datatypes/minecraft'))
    interpreted.addProtocol(protocol, [])

    const compiler = new ProtoDefCompiler()
    compiler.addTypes(require('../src/datatypes/compiler-minecraft'))
    compiler.addProtocol(protocol, [])

    const packet = { entityId: 1, delta: VANILLA_PAYLOADS[4][1] }
    for (const proto of [interpreted, compiler.compileProtoDefSync()]) {
      const buffer = proto.createPacketBuffer('rel_entity_move', packet)
      assert.strictEqual(buffer.toString('hex'), '01' + VANILLA_PAYLOADS[4][0])
      assert.deepStrictEqual(proto.parsePacketBuffer('rel_entity_move', buffer).data, packet)
    }
  })
})
