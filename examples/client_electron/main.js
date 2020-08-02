'use strict'

const path = require('path')
const { app, ipcMain } = require('electron')
const mc = require('minecraft-protocol')

const Window = require('./Window')

require('electron-reload')(__dirname)

function main () {
  const mainWindow = new Window({
    file: path.join('renderer', 'index.html')
  })

  mainWindow.once('show', () => {
  })

  ipcMain.on('connect', (e, data) => {
    const client = mc.createClient(data)
    client.on('login', () => mainWindow.send('content', 'connected'))
    let chat = ''

    client.on('chat', function (packet) {
      const jsonMsg = JSON.parse(packet.message)
      if (jsonMsg.translate === 'chat.type.announcement' || jsonMsg.translate === 'chat.type.text') {
        const username = jsonMsg.with[0].text
        const msg = jsonMsg.with[1]
        chat += `${username} > ${msg}<br />`
        mainWindow.send('content', chat)
      }
    })
    ipcMain.on('chat', (e, chat2) => {
      client.write('chat', { message: chat2 })
    })
  })
}

app.on('ready', main)

app.on('window-all-closed', function () {
  app.quit()
})
