# mersion

Retry Mongoose saves that suffer from conflicts via VersionErrors

```js
const mongoose = require('mongoose')
const Mersion = require('mersion')

const Book = mongoose.model('Book', new Schema({
  title: String,
  tags: [String]
}))

(async () => {
  const mersion = new Mersion({
    loadFn: () => Book.findById(bookId),
    saveFn: (book) => {
      // mutating array has the possibility of causing a VersionError
      book.tags = ['fiction']
      return book.save()
    },
    retries: 2
  })

  // Calls `loadFn`, followed by `saveFn()`.
  // If a VersionError occurs, will retry `retries` times
  const savedBook = await mersion.save()
})()
```
