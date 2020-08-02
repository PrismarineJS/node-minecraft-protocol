'use strict'

const { ipcRenderer } = require('electron')

function setContent (content) {
  const contentItem = document.getElementById('content')

  contentItem.innerHTML = content
}

document.getElementById('connect').addEventListener('click', () => {
  setContent('connecting...')
  const data = {
    host: document.getElementById('host').value,
    port: parseInt(document.getElementById('port').value),
    username: document.getElementById('username').value,
    password: document.getElementById('password').value === '' ? undefined : document.getElementById('password').value
  }
  ipcRenderer.send('connect', data)
})

function chat () {
  ipcRenderer.send('chat', document.getElementById('chat').value)
  document.getElementById('chat').value = ''
}
document.getElementById('chat').addEventListener('keyup', function onEvent (e) {
  if (e.keyCode === 13) {
    chat()
  }
})

document.getElementById('send').addEventListener('click', () => {
  chat()
})

ipcRenderer.on('content', (event, content) => {
  setContent(content)
})
