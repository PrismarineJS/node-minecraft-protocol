const UUID = require('uuid-1345')
const yggdrasil = require('yggdrasil')
const fs = require('fs').promises
const mcDefaultFolderPath = require('minecraft-folder-path')
const path = require('path')

const launcherDataFile = 'launcher_accounts.json'
const makeUUID = () => UUID.v4().toString().replace(/-/g, '')

module.exports = async function (client, options) {
  // get profiles folder
  if (!options.profilesFolder && options.profilesFolder !== false) { // not defined, but not explicitly false. fallback to default
    let mcFolderExists = true
    try {
      await fs.access(mcDefaultFolderPath)
    } catch (ignoreErr) { // we can't access the minecraft folder
      mcFolderExists = false
    }
    options.profilesFolder = mcFolderExists ? mcDefaultFolderPath : '.' // local folder if mc folder doesn't exist
  }

  const yggdrasilClient = yggdrasil({ agent: options.agent, host: options.authServer || 'https://authserver.mojang.com' })

  const clientToken = options.clientToken || // use clientToken passed to client
  (options.session && options.session.clientToken) || // use session passed to client
  (options.profilesFolder && (await getLauncherProfiles()).mojangClientToken) || // try to get the client token from minecraft folder
  makeUUID() // as a last case make our own client token

  const skipValidation = false || options.skipValidation

  options.accessToken = null

  options.haveCredentials = !!options.password ||
  (clientToken && options.session) ||
  (options.profilesFolder && !!getProfileId(await getLauncherProfiles()))

  async function getLauncherProfiles () { // get launcher profiles
    try {
      return JSON.parse(await fs.readFile(path.join(options.profilesFolder, launcherDataFile), 'utf8'))
    } catch (err) {
      await fs.mkdir(options.profilesFolder, { recursive: true })
      await fs.writeFile(path.join(options.profilesFolder, launcherDataFile), '{}')
      return { accounts: {} }
    }
  }

  function getProfileId (auths) {
    try {
      const lowerUsername = options.username.toLowerCase()
      return Object.keys(auths.accounts).find(key =>
        auths.accounts[key].username.toLowerCase() === lowerUsername ||
          auths.accounts[key].minecraftProfile.name.toLowerCase() === lowerUsername
      )
    } catch (err) {
      return false
    }
  }

  if (options.haveCredentials) {
    // make a request to get the case-correct username before connecting.
    async function saveSession (session) {
      if (options.profilesFolder) {
        try {
          const auths = getLauncherProfiles()
          if (!auths.accounts) auths.accounts = []
          try {
            let profile = getProfileId(auths)
            if (!profile) {
              profile = makeUUID() // create new profile
            }
            if (!auths.mojangClientToken) {
              auths.mojangClientToken = clientToken
            }

            if (clientToken === auths.mojangClientToken) { // only do something when we can save a new clienttoken or they match
              const oldProfileObj = auths.accounts[profile]

              auths.accounts[profile] = {
                accessToken: session.accessToken,
                minecraftProfile: {
                  id: session.selectedProfile.id,
                  name: session.selectedProfile.name
                },
                userProperites: oldProfileObj ? (oldProfileObj.userProperites || []) : [],
                username: options.username
              }
            }
          } catch (ignoreErr) {
            // again, silently fail, just don't save anything
          }

          try { // save file
            await fs.writeFile(path.join(options.profilesFolder, launcherDataFile), JSON.stringify(auths, null, 2))
          } catch (err) {
            // not any error, we just don't save the file
          }
        } catch (err) {
          // not any error, we just don't save the file
        }
      }
    }

    async function handleError (session, err) {
      let auths
      try {
        auths = getLauncherProfiles()
        if (!auths.accounts) auths.accounts = []
        try {
          const profile = getProfileId(auths)
          if (!profile) return

          delete auths.accounts[profile] // profile is invalid, remove
        } catch (error) {
          // not any error, we just don't save the file
        }
      } catch (error) {
        // not any error, we just don't save the file
      }

      try { // save file
        await fs.writeFile(path.join(options.profilesFolder, launcherDataFile), JSON.stringify(auths, null, 2))
      } catch (err) {
        // not any error, we just don't save the file
      }
      if (err) {
        client.emit('error', err)
      } else {
        client.session = session
        client.username = session.selectedProfile.name
        options.accessToken = session.accessToken
        client.emit('session', session)
        options.connect(client)
      }
    }

    if (!options.session && options.profilesFolder) {
      try {
        const auths = await getLauncherProfiles()
        const profile = getProfileId(auths)
        const { username, minecraftProfile: { name, id }, accessToken } = auths.accounts[profile]
        if (profile) {
          const newProfile = { id, name }

          options.session = {
            accessToken,
            clientToken: auths.mojangClientToken,
            selectedProfile: newProfile,
            availableProfiles: [newProfile]
          }
          options.username = username
        }
      } catch (ignoreErr) {
        // skip the error :/
      }
    }

    if (options.session) {
      if (!skipValidation) {
        try { // validate existing session
          await yggdrasilClient.validate(options.session.accessToken)
          await saveSession(options.session)
        } catch (err) {
          let data
          try { // refresh token
            data = await yggdrasilClient.refresh(options.session.accessToken, options.session.clientToken)[1]
            await saveSession(data)
          } catch (err) { // token is invalid
            if (options.username && options.password) { // try logging in
              try {
                data = await yggdrasilClient.auth({
                  user: options.username,
                  pass: options.password,
                  token: clientToken,
                  requestUser: true
                })
                await saveSession(data)
              } catch (err) {
                await handleError(data, err)
              }
            } else { // just return the token with an error
              await handleError(data, err)
            }
          }
        }
      } else {
        // trust that the provided session is a working one
        await saveSession(options.session)
      }
    } else { // no session, so just make our auth with a token
      let data
      try {
        data = await yggdrasilClient.auth({
          user: options.username,
          pass: options.password,
          token: clientToken
        })
        await saveSession(data)
      } catch (err) {
        await handleError(data, err)
      }
    }
  } else {
    // assume the server is in offline mode and just go for it.
    client.username = options.username
    options.connect(client)
  }
}
