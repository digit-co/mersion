/* eslint-env mocha */
'use strict'

const assert = require('assert').strict
const mongoose = require('mongoose')
const Schema = mongoose.Schema
const VersionError = mongoose.Error.VersionError
const Mersion = require('../')

const BookSchema = new Schema({
  title: String,
  tags: [String]
})

const Book = mongoose.model('Book', BookSchema)

describe('Mersion', function () {
  before(function () {
    mongoose.connect('mongodb://localhost:27017/mersiontest', {
      useNewUrlParser: true
    })
  })
  after(function () {
    mongoose.disconnect()
  })

  describe('normal save of existing document', function () {
    before(async function () {
      const book = new Book({ title: 'book1' })
      this.book = await book.save()
    })

    it('version should be initialized to 0', function () {
      assert.equal(this.book.__v, 0)
    })

    it('should save succesfully', async function () {
      const mersion = new Mersion({
        loadFn: () => Book.findById(this.book._id),
        saveFn: (book) => {
          book.title = 'book1-modified'
          return book.save()
        }
      })
      const savedBook = await mersion.save()
      assert.equal(mersion.saveCount, 1)
      assert.equal(savedBook.__v, 0)
      assert.equal(savedBook.title, 'book1-modified')
    })
  })

  describe('normal save of a new document', function () {
    it('should save succesfully', async function () {
      const mersion = new Mersion({
        loadFn: () => new Book(),
        saveFn: (book) => {
          book.title = 'book2'
          return book.save()
        }
      })
      const savedBook = await mersion.save()
      assert.equal(mersion.saveCount, 1)
      assert.equal(savedBook.__v, 0)
      assert.equal(savedBook.title, 'book2')
    })
  })

  describe('conflicting save', function () {
    before(async function () {
      this.book3 = await new Book({ title: 'book3' }).save()
      this.book4 = await new Book({ title: 'book4' }).save()
    })

    it('save without mversion should cause VersionError', async function () {
      let errThrown = false
      try {
        await doSaveWithConflict(this.book3, false)
      } catch (err) {
        errThrown = true
        assert(err instanceof VersionError)
      } finally {
        assert(errThrown)
      }
    })

    it('save with mversion should handle VersionError', async function () {
      const mersion = await doSaveWithConflict(this.book4, true)
      await mersion.save()
      assert.equal(mersion.saveCount, 2)
    })
  })

  describe('max retries is reached', function () {
    before(async function () {
      this.book5 = await new Book({ title: 'book5' }).save()
    })
    it('error should be returned', async function () {
      const mersion = await doSaveWithConflict(this.book5, true, { retries: -1 })
      let errThrown
      try {
        await mersion.save()
      } catch (err) {
        errThrown = err
      }
      assert(errThrown)
      assert(/Failed to save document id/.test(errThrown))
    })
  })
})

async function doSaveWithConflict (doc, useMersion, opts = {}) {
  // get a second book instance of same document
  assert(doc.id)
  const doc2 = await Book.findById(doc._id)
  assert.equal(doc2.id, doc.id)

  // create conflict with tags array
  doc2.tags = ['non-fiction']
  await doc2.save()
  const setValues = (doc) => {
    doc.tags = ['fiction']
    return doc.save()
  }

  // attempt save with mersion, smart.
  if (useMersion) {
    return new Mersion(Object.assign({}, {
      loadFn: () => doc,
      saveFn: setValues
    }, opts))
  }

  // attempt save without mersion, not smart.
  doc = await setValues(doc)
  return doc.save()
}
