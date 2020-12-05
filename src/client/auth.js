const UUID = require('uuid-1345')
const yggdrasil = require('yggdrasil')
const fs = require('fs').promises
const mcDefaultFolderPath = require('minecraft-folder-path')
const path = require('path')

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
  const clientToken = options.clientToken || (options.session && options.session.clientToken) || (options.profilesFolder && (await getLauncherProfiles()).clientToken) || UUID.v4().toString().replace(/-/g, '')
  const skipValidation = false || options.skipValidation
  options.accessToken = null
  options.haveCredentials = options.password != null || (clientToken != null && options.session != null) || (options.profilesFolder && await hasProfileCredentials())

  async function getLauncherProfiles () { // get launcher profiles
    try {
      return JSON.parse(await fs.readFile(path.join(options.profilesFolder, 'launcher_profiles.json'), 'utf8'))
    } catch (err) {
      await fs.mkdir(options.profilesFolder, { recursive: true })
      await fs.writeFile(path.join(options.profilesFolder, 'launcher_profiles.json'), '{}')
      return { authenticationDatabase: {} }
    }
  }

  async function hasProfileCredentials () {
    try {
      const auths = await getLauncherProfiles()

      const lowerUsername = options.username.toLowerCase()
      return !!Object.keys(auths.authenticationDatabase).find(key =>
        auths.authenticationDatabase[key].username.toLowerCase() === lowerUsername ||
          Object.values(auths.authenticationDatabase[key].profiles)[0].displayName.toLowerCase() === lowerUsername
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
          try {
            const lowerUsername = options.username.toLowerCase()
            let profile = Object.keys(auths.authenticationDatabase).find(key =>
              auths.authenticationDatabase[key].username.toLowerCase() === lowerUsername ||
                Object.values(auths.authenticationDatabase[key].profiles)[0].displayName.toLowerCase() === lowerUsername
            )
            if (err) {
              if (profile) { // profile is invalid, remove
                delete auths.authenticationDatabase[profile]
              }
            } else { // successful login
              if (!profile) {
                profile = UUID.v4().toString().replace(/-/g, '') // create new profile
              }
              if (!auths.clientToken) {
                auths.clientToken = clientToken
              }

              if (clientToken === auths.clientToken) { // only do something when we can save a new clienttoken or they match
                const oldProfileObj = auths.authenticationDatabase[profile]
                const newProfileObj = {
                  accessToken: session.accessToken,
                  profiles: {},
                  properties: oldProfileObj ? (oldProfileObj.properties || []) : [],
                  username: options.username
                }
                newProfileObj.profiles[session.selectedProfile.id] = {
                  displayName: session.selectedProfile.name
                }
                auths.authenticationDatabase[profile] = newProfileObj
              }
            }
          } catch (ignoreErr) {
            // again, silently fail, just don't save anything
          }
          fs.writeFile(path.join(options.profilesFolder, 'launcher_profiles.json'), JSON.stringify(auths, null, 2)).then(() => {}, (ignoreErr) => {
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

        const lowerUsername = options.username.toLowerCase()
        const profile = Object.keys(auths.authenticationDatabase).find(key =>
          auths.authenticationDatabase[key].username.toLowerCase() === lowerUsername ||
            Object.values(auths.authenticationDatabase[key].profiles)[0].displayName.toLowerCase() === lowerUsername
        )

        if (profile) {
          const newUsername = auths.authenticationDatabase[profile].username
          const uuid = Object.keys(auths.authenticationDatabase[profile].profiles)[0]
          const displayName = auths.authenticationDatabase[profile].profiles[uuid].displayName
          const newProfile = {
            name: displayName,
            id: uuid
          }

          options.session = {
            accessToken: auths.authenticationDatabase[profile].accessToken,
            clientToken: auths.clientToken,
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
