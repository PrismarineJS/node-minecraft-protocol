const UUID = require('uuid-1345')
const yggdrasil = require('yggdrasil')
const fs = require('fs').promises
const mcDefaultFolderPath = require('minecraft-folder-path')
const path = require('path')

const launcherDataFile = 'launcher_accounts.json'

module.exports = async function (client, options) {
  if (!options.profilesFolder && options.profilesFolder !== false) { // not defined, but not explicitly false. fallback to default
    let mcFolderExists = true
    try {
      await fs.access(mcDefaultFolderPath)
    } catch (ignoreErr) {
      mcFolderExists = false
    }
    options.profilesFolder = mcFolderExists ? mcDefaultFolderPath : '.' // local folder if mc folder doesn't exist
  }

  const yggdrasilClient = yggdrasil({ agent: options.agent, host: options.authServer || 'https://authserver.mojang.com' })
  const clientToken = options.clientToken || (options.session && options.session.clientToken) || (options.profilesFolder && (await getLauncherProfiles()).mojangClientToken) || UUID.v4().toString().replace(/-/g, '')
  const skipValidation = false || options.skipValidation
  options.accessToken = null
  options.haveCredentials = !!options.password || (clientToken != null && options.session != null) || (options.profilesFolder && !!getProfileId(await getLauncherProfiles()))

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
    const cb = function (err, session) {
      if (options.profilesFolder) {
        getLauncherProfiles().then((auths) => {
          if (!auths.accounts) auths.accounts = []
          try {
            let profile = getProfileId(auths)
            if (err) {
              if (profile) { // profile is invalid, remove
                delete auths.accounts[profile]
              }
            } else { // successful login
              if (!profile) {
                profile = UUID.v4().toString().replace(/-/g, '') // create new profile
              }
              if (!auths.mojangClientToken) {
                auths.mojangClientToken = clientToken
              }

              if (clientToken === auths.mojangClientToken) { // only do something when we can save a new clienttoken or they match
                const oldProfileObj = auths.accounts[profile]
                const newProfileObj = {
                  accessToken: session.accessToken,
                  minecraftProfile: {
                    id: session.selectedProfile.id,
                    name: session.selectedProfile.name
                  },
                  userProperites: oldProfileObj ? (oldProfileObj.userProperites || []) : [],
                  username: options.username
                }
                auths.accounts[profile] = newProfileObj
              }
            }
          } catch (ignoreErr) {
            // again, silently fail, just don't save anything
          }
          fs.writeFile(path.join(options.profilesFolder, launcherDataFile), JSON.stringify(auths, null, 2)).then(() => {}, (ignoreErr) => {
            // console.warn("Couldn't save tokens:\n", err) // not any error, we just don't save the file
          })
        }, (ignoreErr) => {
          // console.warn("Skipped saving tokens because of error\n", err) // not any error, we just don't save the file
        })
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

        if (profile) {
          const newUsername = auths.accounts[profile].username
          const displayName = auths.accounts[profile].minecraftProfile.name
          const uuid = auths.accounts[profile].minecraftProfile.id
          const newProfile = {
            id: uuid,
            name: displayName
          }

          options.session = {
            accessToken: auths.accounts[profile].accessToken,
            clientToken: auths.mojangClientToken,
            selectedProfile: newProfile,
            availableProfiles: [newProfile]
          }
          options.username = newUsername
        }
      } catch (ignoreErr) {
        // skip the error :/
      }
    }

    if (options.session) {
      if (!skipValidation) {
        yggdrasilClient.validate(options.session.accessToken, function (err) {
          if (!err) { cb(null, options.session) } else {
            yggdrasilClient.refresh(options.session.accessToken, options.session.clientToken, function (err, accessToken, data) {
              if (!err) {
                cb(null, data)
              } else if (options.username && options.password) {
                yggdrasilClient.auth({
                  user: options.username,
                  pass: options.password,
                  token: clientToken,
                  requestUser: true
                }, cb)
              } else {
                cb(err, data)
              }
            })
          }
        })
      } else {
        // trust that the provided session is a working one
        cb(null, options.session)
      }
    } else {
      yggdrasilClient.auth({
        user: options.username,
        pass: options.password,
        token: clientToken
      }, cb)
    }
  } else {
    // assume the server is in offline mode and just go for it.
    client.username = options.username
    options.connect(client)
  }
}
