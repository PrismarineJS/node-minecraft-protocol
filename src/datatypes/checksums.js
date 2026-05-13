// Compute chat checksum using Java's Arrays.hashCode algorithm to match vanilla client
function computeChatChecksum (lastSeenMessages) {
  if (!lastSeenMessages || lastSeenMessages.length === 0) return 1

  let checksum = 1
  for (const message of lastSeenMessages) {
    if (message.signature) {
      let sigHash = 1
      for (let i = 0; i < message.signature.length; i++) {
        sigHash = (31 * sigHash + message.signature[i]) & 0xffffffff
      }
      checksum = (31 * checksum + sigHash) & 0xffffffff
    }
  }
  // Convert to byte
  const result = checksum & 0xff
  return result === 0 ? 1 : result
}

module.exports = { computeChatChecksum }
