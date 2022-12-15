const CHAT_PREVIEW_MODES = require('./chatPreviewModes')
const ping = require('../ping')

module.exports = (client, options) => {
  options.chatPreviewMode ??= CHAT_PREVIEW_MODES.LIVE // default in minecraft

  const mcData = require('minecraft-data')(client.version)
  client.useChatPreview = false
  client.chatPreviewMode = CHAT_PREVIEW_MODES.OFF

  // autoversion ping called too late
  ping(options).then((reponse) => {
    if (mcData.version['==']('1.19.2') && reponse.previewsChat && client.chatPreviewSetting !== CHAT_PREVIEW_MODES.OFF) {
      console.log('enabling chat preview')
      client.useChatPreview = true // default state before receiving packet
      client.chatPreviewMode = options.chatPreviewMode
    }
  }).catch(() => { })

  client.on('should_display_chat_preview', ({ should_display_chat_preview: shouldDisplayChatPreview }) => {
    client.useChatPreview = shouldDisplayChatPreview
    client.chatPreviewMode = client.useChatPreview ? options.chatPreviewMode : CHAT_PREVIEW_MODES.OFF
  })
}
