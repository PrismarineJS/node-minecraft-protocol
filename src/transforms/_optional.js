module.exports = function requireOptional (name, def) {
  try { return require(name) } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') { throw e }
    return def && require(def)
  }
}
