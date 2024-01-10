const fs = require('fs')
const path = require('path')
const mcData = require('minecraft-data')
// const dataPaths = require('../minecraft-data/data/dataPaths.json')

let output = ''

let previousPackets = null

const allPackets = {}

// process in 2 steps for flexibility

for (const version of mcData.supportedVersions.pc) {
  if (version.includes('w') || version.includes('c') || version.includes('pre')) continue
  // if (version !== '1.20') continue
  // const protocolPath = path.join(__dirname, `../minecraft-data/data/pc/${version}/protocol.json`);
  // if (!fs.existsSync(protocolPath)) continue
  // console.log('version', version)
  // const protocol = require(protocolPath)
  const protocol = mcData(version).protocol

  const packetKeys = []
  // from client
  const packets = Object.entries(protocol.play.toServer.types).map(([name, [type, props]]) => {
    name = name.replace(/^packet_/, '')
    packetKeys.push(name)
    if (type !== 'container') {
      console.log('not container', name, type)
      return undefined
    }
    const mapped = props.map(({ name, type }) => {
      if (type === 'container') {
        // console.log('container in container', name, type)
        return undefined
      }
      const posType = '{ x: number, y: number, z: number }'
      const typeTs = {
        byte: 'number',
        varint: 'number',
        int: 'number',
        float: 'number',
        double: 'number',
        long: 'bigint',
        short: 'number',
        string: 'string',
        bool: 'boolean',
        position: posType,
        u8: 'number',
        u16: 'number',
        u32: 'number',
        u64: 'bigint',
        i8: 'number',
        i16: 'number',
        i32: 'number',
        i64: 'bigint',
        f32: 'number',
        f64: 'number'
      }[type] ?? 'any' // todo any
      return `    ${name}: ${typeTs};`
    }).filter(Boolean)
    return [name, mapped.join('\n')]
  }).filter(Boolean)

  const mergedData = {
    new: [],
    removed: [],
    changed: [],
    same: []
  }
  if (previousPackets) {
    packets.forEach(([name, props]) => {
      const previous = previousPackets.find(([n]) => n === name)
      if (!previous) {
        return mergedData.new.push([name, props])
      }
      const dataChanged = previous[1] !== props
      if (dataChanged) {
        mergedData.changed.push([name, props])
      } else {
        mergedData.same.push([name, props])
      }
    })
    previousPackets.forEach(([name]) => {
      const current = packets.find(([n]) => n === name)
      if (!current) {
        mergedData.removed.push(name)
      }
    })
  } else {
    mergedData.new = packets
  }
  if (mergedData.new.length || mergedData.removed.length || mergedData.changed.length) {
    allPackets[version] = mergedData
  }

  previousPackets = packets
}

output += 'export interface ClientWriteMap {\n'

// now we have all packets for each version, we need to merge them into unions

const allPacketsUnions = {}

// removed packets per version
const removedPackets = {}
for (const [version, { new: newPackets, removed, changed }] of Object.entries(allPackets)) {
  Object.assign(allPacketsUnions, Object.fromEntries(newPackets.map(([name, props]) => [name, [[version, props]]])))
  for (const packet of changed) {
    allPacketsUnions[packet[0]].push([version, packet[1]])
  }
  for (const packet of removed) {
    removedPackets[packet] = version
  }
}

for (const [packet, data] of Object.entries(allPacketsUnions)) {
  const typeUnion = data.map(([version, props]) => {
    const jsdoc = `/** ${version} */`
    return `${jsdoc} {\n${props}\n  }`
  }).join(' | ')
  if (removedPackets[packet]) {
    output += `  /** Removed in ${removedPackets[packet]} */\n`
  }
  output += `  ${packet}: ${typeUnion};\n`
}

output += '}\n'
output += '\n'
output += 'export declare const clientWrite: <T extends keyof ClientWriteMap>(name: T, data: ClientWriteMap[T]) => Buffer;\n'

fs.writeFileSync(path.resolve(__dirname, '../src/protocol.d.ts'), output)
// fs.writeFileSync(path.resolve(__dirname, './protocol-diff.json'), JSON.stringify(allPackets, null, 2))
