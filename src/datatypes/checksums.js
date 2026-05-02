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
  // Convert to signed byte (i8: -128..127) to match the chat_command_signed packet schema.
  // The previous `& 0xff` produced 0..255 which causes RangeError when value > 127.
  const unsigned = checksum & 0xff
  const signed = unsigned > 127 ? unsigned - 256 : unsigned
  return signed === 0 ? 1 : signed
}

module.exports = { computeChatChecksum }
