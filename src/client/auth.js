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

  /**
   * Reads file at path options.profilesFolder file `launcherDataFile` and returns its content.
   * Or if that fails, it tries to makes a new folder and file at that path and writes an empty json object to it and returns
   * `Promise<{ accounts: {} }>`. Second step dose not include catch and will throw an error if an IO action fails.
   * @returns {Promise<{accounts: object}>}
   */
  async function getLauncherProfiles () { // get launcher profiles
    try {
      return JSON.parse(await fs.readFile(path.join(options.profilesFolder, launcherDataFile), 'utf8'))
    } catch (err) {
      await fs.mkdir(options.profilesFolder, { recursive: true })
      await fs.writeFile(path.join(options.profilesFolder, launcherDataFile), '{}')
      return { accounts: {} }
    }
  }

  /**
   * Returns the first profile id from the given auths object or false if none has been found
   * @param {object} auths
   * @returns {false | string}
   */
  function getProfileId (auths) {
    try {
      const lowerUsername = options.username.toLowerCase()
      return Object.keys(auths.accounts).find(key =>
        auths.accounts[key].username.toLowerCase() === lowerUsername || auths.accounts[key].minecraftProfile.name.toLowerCase() === lowerUsername
      )
    } catch (err) {
      return false
    }
  }

  /**
   * Takes a session or username and calls the client connect function. Username is ignored when session is present. Session default is null.
   * @param {string|null} username Username. Unused if session is given.
   * @param {object?} session The session to connect with. Sets username of client given by the session object.
   */
  const connect = (username, session = null) => {
    if (session) {
      client.session = session
      client.username = session.selectedProfile.name
      options.accessToken = session.accessToken
      client.emit('session', session)
      options.connect(client)
    } else {
      client.username = username
      options.connect(client)
    }
  }

  /**
   * Manage tokens and saving of tokens after authenticating with Mojang/Microsoft
   * @param {null|Error} err Error or null
   * @param {object} session Session
   * @returns {Promise<void>}
   */
  const postAuth = async (err, session) => {
    let auths
    let profile
    const manageAuth = () => {
      if (!profile) {
        profile = UUID.v4().toString().replace(/-/g, '') // create new profile
        throw new Error('Account not found') // TODO: Find a way to calculate remoteId. Launcher ignores account entry and makes a new one if remoteId is incorrect
      }
      if (!auths.accounts[profile].remoteId) {
        delete auths.accounts[profile]
        throw new Error('Account has no remoteId') // TODO: Find a way to calculate remoteId. Launcher ignores account entry and makes a new one if remoteId is incorrect
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
          userProperites: oldProfileObj?.userProperites ?? [],
          remoteId: oldProfileObj?.remoteId ?? '',
          username: options.username,
          localId: profile,
          type: (options.auth?.toLowerCase() === 'microsoft' ? 'Xbox' : 'Mojang'),
          persistent: true
        }
        auths.accounts[profile] = newProfileObj
      }
    }

    if (!options.profilesFolder && err) {
      client.emit('error', err)
      return
    }
    if (err && !session) {
      throw new Error('')
    }
    try {
      auths = await getLauncherProfiles()
      if (!auths.accounts) auths.accounts = []
      profile = getProfileId(auths)
      if (err && profile && auths.accounts[profile].type !== 'Xbox') { // MS accounts are deemed invalid in case someone tries to use one without specifying options.auth, but we shouldn't remove these
        delete auths.accounts[profile] // profile is invalid, remove
      }
      try {
        if (!err) { // successful login
          manageAuth()
        }
      } catch (ignoreErr) {
        // skip the error :/
      }
    } catch (ignoreErr) {
      // console.warn("Skipped saving tokens because of error\n", err) // not any error, we just don't save the file
    }
    try {
      await fs.writeFile(path.join(options.profilesFolder, launcherDataFile), JSON.stringify(auths, null, 2))
    } catch (err) {
      // console.warn("Couldn't save tokens:\n", err) // not any error, we just don't save the file
    }
    connect(null, session)
  }

  if (!options.haveCredentials) {
    // assume the server is in offline mode and just go for it.
    connect(options.username)
    return
  }

  // ! Credentials only zone do not cross without them !

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

  // trust that the provided session is a working one
  if (options.session && skipValidation) {
    postAuth(null, options.session)
    return
  }

  // authentication with provided access and client Token in session
  if (options.session) {
    try {
      await yggdrasilClient.validate(options.session.accessToken)
      postAuth(null, options.session)
    } catch (err) {
      try {
        const [, data] = await yggdrasilClient.refresh(options.session.accessToken, options.session.clientToken)
        postAuth(null, data)
      } catch (err) {
        // fall back to username + password login; Why?
        if (options.password && options.username) {
          try {
            const data = await yggdrasilClient.auth({
              user: options.username,
              pass: options.password,
              token: clientToken
            })
            postAuth(null, data)
          } catch (ignoreErr) {
            // what do?
          }
        }
        postAuth(err) // Throw error that the session is invalid?
      }
    }
    return
  }

  // Login using username + password
  try {
    const data = await yggdrasilClient.auth({
      user: options.username,
      pass: options.password,
      token: clientToken,
      requestUser: true
    })
    postAuth(null, data)
  } catch (err) {
    postAuth(err)
  }
}
