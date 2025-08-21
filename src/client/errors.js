class CustomPayloadParseError extends Error {
  constructor(message, cause, data) {
    super(message)
    this.name = 'CustomPayloadParseError'
    this.cause = cause
    this.data = data
    this.message = `Custom channel: ${data.channel} - ${message}`
  }
}

module.exports = {
  CustomPayloadParseError
}
