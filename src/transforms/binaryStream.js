const types = {}
Object.assign(types, require('protodef').types)
Object.assign(types, require('../datatypes/minecraft'))

function concat (...args) {
  let allocLen = 0
  for (let i = 0; i < args.length; i += 2) {
    const type = args[i]
    const value = args[i + 1]
    const [,, s] = types[type]
    allocLen += typeof s === 'number' ? s : s(value, {})
  }
  const buffer = Buffer.alloc(allocLen)
  let offset = 0
  for (let i = 0; i < args.length; i += 2) {
    const type = args[i]
    const value = args[i + 1]
    offset = types[type][1](value, buffer, offset, {})
  }
  return buffer
}

// concat('i32', 22, 'i64', 2n) => <Buffer 00 00 00 16 00 00 00 00 00 00 00 02>
module.exports = { concat }
