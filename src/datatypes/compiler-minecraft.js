const UUID = require('uuid-1345')
const minecraft = require('./minecraft')

module.exports = {
  Read: {
    UUID: ['native', (buffer, offset) => {
      return {
        value: UUID.stringify(buffer.slice(offset, 16 + offset)),
        size: 16
      }
    }],
    restBuffer: ['native', (buffer, offset) => {
      return {
        value: buffer.slice(offset),
        size: buffer.length - offset
      }
    }],
    nbt: ['native', minecraft.nbt[0]],
    optionalNbt: ['native', minecraft.optionalNbt[0]],
    compressedNbt: ['native', minecraft.compressedNbt[0]],
    entityMetadataLoop: ['parametrizable', (compiler, { type, endVal }) => {
      let code = 'let cursor = offset\n'
      code += 'const data = []\n'
      code += 'while (true) {\n'
      code += `  if (ctx.u8(buffer, cursor).value === ${endVal}) return { value: data, size: cursor + 1 - offset }\n`
      code += '  const elem = ' + compiler.callType(type, 'cursor') + '\n'
      code += '  data.push(elem.value)\n'
      code += '  cursor += elem.size\n'
      code += '}'
      return compiler.wrapCode(code)
    }],
    topBitSetTerminatedArray: ['parametrizable', (compiler, { type, endVal }) => {
      let code = 'let cursor = offset\n'
      code += 'const data = []\n'
      code += 'while (true) {\n'
      code += '  const item = ctx.u8(buffer, cursor).value\n'
      code += '  buffer[cursor] = buffer[cursor] & 127\n'
      code += '  const elem = ' + compiler.callType(type, 'cursor') + '\n'
      code += '  data.push(elem.value)\n'
      code += '  cursor += elem.size\n'
      code += '  if ((item & 128) === 0) return { value: data, size: cursor - offset }\n'
      code += '}'
      return compiler.wrapCode(code)
    }]
  },
  Write: {
    UUID: ['native', (value, buffer, offset) => {
      const buf = UUID.parse(value)
      buf.copy(buffer, offset)
      return offset + 16
    }],
    restBuffer: ['native', (value, buffer, offset) => {
      value.copy(buffer, offset)
      return offset + value.length
    }],
    nbt: ['native', minecraft.nbt[1]],
    optionalNbt: ['native', minecraft.optionalNbt[1]],
    compressedNbt: ['native', minecraft.compressedNbt[1]],
    entityMetadataLoop: ['parametrizable', (compiler, { type, endVal }) => {
      let code = 'for (const i in value) {\n'
      code += '  offset = ' + compiler.callType('value[i]', type) + '\n'
      code += '}\n'
      code += `return offset + ctx.u8(${endVal}, buffer, offset)`
      return compiler.wrapCode(code)
    }],
    topBitSetTerminatedArray: ['parametrizable', (compiler, { type }) => {
      let code = 'let prevOffset = offset\n'
      code += 'let ind = 0\n'
      code += 'for (const i in value) {\n'
      code += '  prevOffset = offset\n'
      code += '  offset = ' + compiler.callType('value[i]', type) + '\n'
      code += '  buffer[prevOffset] = ind !== value.length-1 ? (buffer[prevOffset] | 128) : buffer[prevOffset]\n'
      code += '  ind++\n'
      code += '}\n'
      code += 'return offset'
      return compiler.wrapCode(code)
    }]
  },
  SizeOf: {
    UUID: ['native', 16],
    restBuffer: ['native', (value) => {
      return value.length
    }],
    nbt: ['native', minecraft.nbt[2]],
    optionalNbt: ['native', minecraft.optionalNbt[2]],
    compressedNbt: ['native', minecraft.compressedNbt[2]],
    entityMetadataLoop: ['parametrizable', (compiler, { type }) => {
      let code = 'let size = 1\n'
      code += 'for (const i in value) {\n'
      code += '  size += ' + compiler.callType('value[i]', type) + '\n'
      code += '}\n'
      code += 'return size'
      return compiler.wrapCode(code)
    }],
    topBitSetTerminatedArray: ['parametrizable', (compiler, { type }) => {
      let code = 'let size = 0\n'
      code += 'for (const i in value) {\n'
      code += '  size += ' + compiler.callType('value[i]', type) + '\n'
      code += '}\n'
      code += 'return size'
      return compiler.wrapCode(code)
    }]
  }
}
