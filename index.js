'use strict'

const debug = require('debug')('mersion')
const VersionError = require('mongoose').Error.VersionError

class Mersion {
  constructor (opts) {
    this.loadFn = opts.loadFn
    this.saveFn = opts.saveFn
    this.retries = opts.retries || 2

    this.saveCount = 0
  }

  async save () {
    let doc
    try {
      doc = await this.loadFn()
      ++this.saveCount
      const savedDoc = await this.saveFn(doc)
      return savedDoc
    } catch (err) {
      // non-VersionError, rethrow to let app handle
      if (!(err instanceof VersionError)) throw err
    }

    const retriesRemaining = this.retries - (this.saveCount - 1)
    debug('Handling VersionError, saveCount: %d, retriesRemaining: %d', this.saveCount, retriesRemaining)

    if (retriesRemaining <= 0) {
      throw new Error(`Failed to save document id ${doc && doc.id} after ${this.retries} retries`)
    }

    // try to re-save again using fresh document
    this.save()
  }
}

module.exports = Mersion
