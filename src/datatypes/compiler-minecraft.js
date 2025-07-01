/* eslint-disable no-return-assign */
const UUID = require('uuid-1345')
const minecraft = require('./minecraft')

module.exports = {
  Read: {
    varlong: ['native', minecraft.varlong[0]],
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
    }],
    registryEntryHolder: ['parametrizable', (compiler, opts) => {
      return compiler.wrapCode(`
const { value: n, size: nSize } = ${compiler.callType('varint')}
if (n !== 0) {
  return { value: { ${opts.baseName}: n - 1 }, size: nSize }
} else {
  const holder = ${compiler.callType(opts.otherwise.type, 'offset + nSize')}
  return { value: { ${opts.otherwise.name}: holder.value }, size: nSize + holder.size }
}
      `.trim())
    }],
    registryEntryHolderSet: ['parametrizable', (compiler, opts) => {
      return compiler.wrapCode(`
  const { value: n, size: nSize } = ${compiler.callType('varint')}
  if (n === 0) {
    const base = ${compiler.callType(opts.base.type, 'offset + nSize')}
    return { value: { ${opts.base.name}: base.value }, size: base.size + nSize }
  } else {
    const set = []
    let accSize = nSize
    for (let i = 0; i < n - 1; i++) {
      const entry = ${compiler.callType(opts.otherwise.type, 'offset + accSize')}
      set.push(entry.value)
      accSize += entry.size
    }
    return { value: { ${opts.otherwise.name}: set }, size: accSize }
  }
    `.trim())
    }]
  },
  Write: {
    varlong: ['native', minecraft.varlong[1]],
    UUID: ['native', (value, buffer, offset) => {
      const buf = value.length === 32 ? Buffer.from(value, 'hex') : UUID.parse(value)
      buf.copy(buffer, offset)
      return offset + 16
    }],
    restBuffer: ['native', (value, buffer, offset) => {
      value.copy(buffer, offset)
      return offset + value.length
    }],
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
    }],
    registryEntryHolder: ['parametrizable', (compiler, opts) => {
      const baseName = `value.${opts.baseName}`
      const otherwiseName = `value.${opts.otherwise.name}`
      return compiler.wrapCode(`
if (${baseName} != null) {
  offset = ${compiler.callType(`${baseName} + 1`, 'varint')}
} else if (${otherwiseName}) {
  offset += 1
  offset = ${compiler.callType(`${otherwiseName}`, opts.otherwise.type)}
} else {
  throw new Error('registryEntryHolder type requires "${baseName}" or "${otherwiseName}" fields to be set')
}
return offset
      `.trim())
    }],
    registryEntryHolderSet: ['parametrizable', (compiler, opts) => {
      const baseName = `value.${opts.base.name}`
      const otherwiseName = `value.${opts.otherwise.name}`
      return compiler.wrapCode(`
if (${baseName} != null) {
  offset = ${compiler.callType(0, 'varint')}
  offset = ${compiler.callType(`${baseName}`, opts.base.type)}
} else if (${otherwiseName}) {
  offset = ${compiler.callType(`${otherwiseName}.length + 1`, 'varint')}
  for (let i = 0; i < ${otherwiseName}.length; i++) {
    offset = ${compiler.callType(`${otherwiseName}[i]`, opts.otherwise.type)}
  }
} else {
  throw new Error('registryEntryHolder type requires "${opts.base.name}" or "${opts.otherwise.name}" fields to be set')
}
return offset
    `.trim())
    }]
  },
  SizeOf: {
    varlong: ['native', minecraft.varlong[2]],
    UUID: ['native', 16],
    restBuffer: ['native', (value) => {
      return value.length
    }],
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
    }],
    registryEntryHolder: ['parametrizable', (compiler, opts) => {
      const baseName = `value.${opts.baseName}`
      const otherwiseName = `value.${opts.otherwise.name}`
      return compiler.wrapCode(`
let size = 0
if (${baseName} != null) {
  size += ${compiler.callType(`${baseName} + 1`, 'varint')}
} else if (${otherwiseName}) {
  size += 1
  size += ${compiler.callType(`${otherwiseName}`, opts.otherwise.type)}
} else {
  throw new Error('registryEntryHolder type requires "${baseName}" or "${otherwiseName}" fields to be set')
}
return size
      `.trim())
    }],
    registryEntryHolderSet: ['parametrizable', (compiler, opts) => {
      const baseName = `value.${opts.base.name}`
      const otherwiseName = `value.${opts.otherwise.name}`
      return compiler.wrapCode(`
let size = 0
if (${baseName} != null) {
  size += ${compiler.callType(0, 'varint')}
  size += ${compiler.callType(`${baseName}`, opts.base.type)}
} else if (${otherwiseName}) {
  size += ${compiler.callType(`${otherwiseName}.length + 1`, 'varint')}
  for (let i = 0; i < ${otherwiseName}.length; i++) {
    size += ${compiler.callType(`${otherwiseName}[i]`, opts.otherwise.type)}
  }
} else {
  throw new Error('registryEntryHolder type requires "${opts.base.name}" or "${opts.otherwise.name}" fields to be set')
}
return size
      `.trim())
    }]
  }
}
