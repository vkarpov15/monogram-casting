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
        },
        docArray: [{ key: String, value: String }],
        stringArray: [String],
        mixedArray: Array
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

      query = Test.find({
        nested: {
          second: '1'
        }
      });

      query.cast();

      assert.deepEqual(query.s.filter, { nested: { second: 1 } });

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('casts $or, etc. to an array', function(done) {
    co(function*() {
      let query = Test.find({
        $or: { test: '1' }
      });

      query.cast();

      assert.deepEqual(query.s.filter, {
        $or: [{ test: 1 }]
      });

      query = Test.find({ test: { $in: '1' } });

      query.cast();

      assert.deepEqual(query.s.filter, { test: { $in: [1] } });

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

  it('ignores $where, etc.', function(done) {
    co(function*() {
      let query = Test.find({
        $where: 'this._id = 3'
      });

      query.cast();

      assert.deepEqual(query.s.filter, {
        $where: 'this._id = 3'
      });

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('$elemMatch', function(done) {
    co(function*() {
      let query = Test.find({
        docArray: {
          $elemMatch: { key: 1, value: 2 }
        }
      });

      query.cast();

      assert.deepEqual(query.s.filter, {
        docArray: {
          $elemMatch: { key: '1', value: '2' }
        }
      });

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('$all', function(done) {
    co(function*() {
      let query = Test.find({
        stringArray: { $all: [1, 2] }
      });

      query.cast();

      assert.deepEqual(query.s.filter, {
        stringArray: { $all: ['1', '2'] }
      });

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('mongoose #3163', function(done) {
    co(function*() {
      let query = Test.find({
        stringArray: {
          $all: [{ $elemMatch: { $regex: 'abc' } }]
        }
      });

      query.cast();

      assert.deepEqual(query.s.filter, {
        stringArray: {
          $all: [{ $elemMatch: { $regex: /abc/ } }]
        }
      });

      query = Test.find({
        stringArray: { $elemMatch: { $regex: 'abc' } }
      });

      query.cast();

      assert.deepEqual(query.s.filter, {
        stringArray: { $elemMatch: { $regex: /abc/ } }
      });

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('multiple comparison selectors', function(done) {
    co(function*() {
      let query = Test.find({
        test: {
          $lte: '5',
          $gte: '0',
          $type: '16'
        }
      });

      query.cast();

      assert.deepEqual(query.s.filter, {
        test: {
          $lte: 5,
          $gte: 0,
          $type: 16
        }
      });

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('ignores paths not in the schema', function(done) {
    co(function*() {
      let query = Test.find({
        notInSchema: 1,
        mixedArray: { $elemMatch: { a: 1 } }
      });

      query.cast();

      assert.deepEqual(query.s.filter, {
        notInSchema: 1,
        mixedArray: { $elemMatch: { a: 1 } }
      });

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('throws if you try to cast an object path to a number', function(done) {
    co(function*() {
      let query = Test.find({
        nested: 1
      });

      assert.throws(function() {
        query.cast();
      }, /Could not cast 1 to Object/);

      query = Test.find({
        nested: [1]
      });

      assert.throws(function() {
        query.cast();
      }, /Could not cast \[ 1 \] to Object/);

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('casts objects to primitives', function(done) {
    co(function*() {
      let query = Test.find({
        _id: new monogram.ObjectId('00000000000000000000000a')
      });

      query.cast();

      assert.deepEqual(query.s.filter, {
        _id: new monogram.ObjectId('00000000000000000000000a')
      });

      done();
    }).catch(function(error) {
      done(error);
    });
  });
});
