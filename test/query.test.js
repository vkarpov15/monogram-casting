'use strict';

let assert = require('assert');
let casting = require('../');
let co = require('co');
let monogram = require('monogram');

describe('query casting', function() {
  let Test;

  beforeEach(function(done) {
    co(function*() {
      let db = yield monogram('mongodb://localhost:27017');

      let schema = new monogram.Schema({
        _id: monogram.ObjectId,
        test: Number,
        tags: String,
        nested: {
          first: String,
          second: Number
        }
      });

      casting(schema);

      Test = db.model({ schema: schema, collection: 'test' });

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('element selectors', function(done) {
    co(function*() {
      let query = Test.find({
        _id: { $type: '7' },
        test: { $exists: 1 }
      });

      query.cast();

      assert.deepEqual(query.s.filter, {
        _id: { $type: 7 },
        test: { $exists: true }
      });

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('nested objects', function(done) {
    co(function*() {
      let query = Test.find({
        'nested.second': '1'
      });

      query.cast();

      assert.deepEqual(query.s.filter, {
        'nested.second': 1
      });

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('ignores $text, etc.', function(done) {
    co(function*() {
      let query = Test.find({
        'nested.first': 123,
        $text: { $search: 'abc' }
      });

      query.cast();

      assert.deepEqual(query.s.filter, {
        'nested.first': '123',
        $text: { $search: 'abc' }
      });

      done();
    }).catch(function(error) {
      done(error);
    });
  });
});
