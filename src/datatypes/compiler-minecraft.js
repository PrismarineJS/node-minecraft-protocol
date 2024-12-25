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
    arrayWithLengthOffset: ['parametrizable', (compiler, array) => { // TODO: remove
      let code = ''
      if (array.countType) {
        code += 'const { value: count, size: countSize } = ' + compiler.callType(array.countType) + '\n'
      } else if (array.count) {
        code += 'const count = ' + array.count + '\n'
        code += 'const countSize = 0\n'
      } else {
        throw new Error('Array must contain either count or countType')
      }
      code += 'if (count > 0xffffff) throw new Error("array size is abnormally large, not reading: " + count)\n'
      code += 'const data = []\n'
      code += 'let size = countSize\n'
      code += `for (let i = 0; i < count + ${array.lengthOffset}; i++) {\n`
      code += '  const elem = ' + compiler.callType(array.type, 'offset + size') + '\n'
      code += '  data.push(elem.value)\n'
      code += '  size += elem.size\n'
      code += '}\n'
      code += 'return { value: data, size }'
      return compiler.wrapCode(code)
    }],
    bitflags: ['parametrizable', (compiler, { type, flags, shift, big }) => {
      let fstr = JSON.stringify(flags)
      if (Array.isArray(flags)) {
        fstr = '{'
        for (const [k, v] of Object.entries(flags)) fstr += `"${v}": ${big ? (1n << BigInt(k)) : (1 << k)}` + (big ? 'n,' : ',')
        fstr += '}'
      } else if (shift) {
        fstr = '{'
        for (const key in flags) fstr += `"${key}": ${1 << flags[key]},`
        fstr += '}'
      }
      return compiler.wrapCode(`
        const { value: _value, size } = ${compiler.callType(type, 'offset')}
        const value = { _value }
        const flags = ${fstr}
        for (const key in flags) {
          value[key] = (_value & flags[key]) == flags[key]
        }
        return { value, size }
      `.trim())
    }],
    registryEntryHolder: ['parametrizable', (compiler, opts) => {
      return compiler.wrapCode(`
const { value: n, size: nSize } = ${compiler.callType('varint')}
if (n !== 0) {
  return { value: { ${opts.baseName}: n - 1 }, size: nSize }
} else {
  const holder = ${compiler.callType(opts.otherwise.type)}
  return { value: { ${opts.otherwise.name}: holder.data }, size: nSize + holder.size }
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
    arrayWithLengthOffset: ['parametrizable', (compiler, array) => {
      let code = ''
      if (array.countType) {
        code += 'offset = ' + compiler.callType('value.length', array.countType) + '\n'
      } else if (array.count === null) {
        throw new Error('Array must contain either count or countType')
      }
      code += 'for (let i = 0; i < value.length; i++) {\n'
      code += '  offset = ' + compiler.callType('value[i]', array.type) + '\n'
      code += '}\n'
      code += 'return offset'
      return compiler.wrapCode(code)
    }],
    bitflags: ['parametrizable', (compiler, { type, flags, shift, big }) => {
      let fstr = JSON.stringify(flags)
      if (Array.isArray(flags)) {
        fstr = '{'
        for (const [k, v] of Object.entries(flags)) fstr += `"${v}": ${big ? (1n << BigInt(k)) : (1 << k)}` + (big ? 'n,' : ',')
        fstr += '}'
      } else if (shift) {
        fstr = '{'
        for (const key in flags) fstr += `"${key}": ${1 << flags[key]},`
        fstr += '}'
      }
      return compiler.wrapCode(`
        const flags = ${fstr}
        let val = value._value ${big ? '|| 0n' : ''}
        for (const key in flags) {
          if (value[key]) val |= flags[key]
        }
        return (ctx.${type})(val, buffer, offset)
      `.trim())
    }],
    registryEntryHolder: ['parametrizable', (compiler, opts) => {
      const baseName = `value.${opts.baseName}`
      const otherwiseName = `value.${opts.otherwise.name}`
      return compiler.wrapCode(`
if (${baseName}) {
  offset = ${compiler.callType(`${baseName} + 1`, 'varint')}
} else if (${otherwiseName}) {
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
if (${baseName}) {
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
    arrayWithLengthOffset: ['parametrizable', (compiler, array) => {
      let code = ''
      if (array.countType) {
        code += 'let size = ' + compiler.callType('value.length', array.countType) + '\n'
      } else if (array.count) {
        code += 'let size = 0\n'
      } else {
        throw new Error('Array must contain either count or countType')
      }
      if (!isNaN(compiler.callType('value[i]', array.type))) {
        code += 'size += value.length * ' + compiler.callType('value[i]', array.type) + '\n'
      } else {
        code += 'for (let i = 0; i < value.length; i++) {\n'
        code += '  size += ' + compiler.callType('value[i]', array.type) + '\n'
        code += '}\n'
      }
      code += 'return size'
      return compiler.wrapCode(code)
    }],
    bitflags: ['parametrizable', (compiler, { type, flags, shift, big }) => {
      let fstr = JSON.stringify(flags)
      if (Array.isArray(flags)) {
        fstr = '{'
        for (const [k, v] of Object.entries(flags)) fstr += `"${v}": ${big ? (1n << BigInt(k)) : (1 << k)}` + (big ? 'n,' : ',')
        fstr += '}'
      } else if (shift) {
        fstr = '{'
        for (const key in flags) fstr += `"${key}": ${1 << flags[key]},`
        fstr += '}'
      }
      return compiler.wrapCode(`
        const flags = ${fstr}
        let val = value._value ${big ? '|| 0n' : ''}
        for (const key in flags) {
          if (value[key]) val |= flags[key]
        }
        return (ctx.${type})(val)
      `.trim())
    }],
    registryEntryHolder: ['parametrizable', (compiler, opts) => {
      const baseName = `value.${opts.baseName}`
      const otherwiseName = `value.${opts.otherwise.name}`
      return compiler.wrapCode(`
let size = 0
if (${baseName}) {
  size += ${compiler.callType(`${baseName} + 1`, 'varint')}
} else if (${otherwiseName}) {
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
if (${baseName}) {
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
