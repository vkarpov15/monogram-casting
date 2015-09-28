'use strict';

var _ = require('lodash');
var assert = require('assert');
var casting = require('../');
var co = require('co');
var monogram = require('monogram');

describe('document casting', function() {
  it('ignores paths not defined in the schema', function(done) {
    co(function*() {
      let db = yield monogram('mongodb://localhost:27017');

      let schema = new monogram.Schema({
        name: { $type: String }
      });

      casting(schema);

      let Person = db.model({ collection: 'people', schema: schema });

      let axl = new Person({}, false);

      assert.ok(!axl.name);

      axl.name = 'Axl Rose';

      assert.deepEqual(axl.$delta(),
        { $set: { name: 'Axl Rose' }, $unset: {} });

      axl.role = 'Lead Singer';
      axl.$cast();

      assert.deepEqual(_.omit(axl, '_id'), { name: 'Axl Rose' });
      assert.deepEqual(axl.$delta(),
        { $set: { name: 'Axl Rose' }, $unset: {} });

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('casts values to specified types', function(done) {
    co(function*() {
      let db = yield monogram('mongodb://localhost:27017');

      let schema = new monogram.Schema({
        _id: { $type: monogram.ObjectId },
        name: { $type: String },
        born: { $type: Number }
      });

      casting(schema);

      let Person = db.model({ collection: 'people', schema: schema });

      let axl = new Person({}, false);

      axl._id = '000000000000000000000001';
      axl.born = '1962';

      axl.$cast();

      assert.ok(typeof axl.born === 'number');
      assert.ok(axl._id instanceof monogram.ObjectId);
      assert.equal(axl._id.toString(), '000000000000000000000001');
      assert.deepEqual(axl.$delta(), {
        $set: {
          born: 1962,
          _id: new monogram.ObjectId('000000000000000000000001')
        },
        $unset: {}
      });

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('casts into arrays', function(done) {
    co(function*() {
      let db = yield monogram('mongodb://localhost:27017');

      let schema = new monogram.Schema({
        members: [{ $type: monogram.ObjectId }]
      });

      casting(schema);

      let Band = db.model({ collection: 'bands', schema: schema });

      let band = new Band({}, false);

      band.members = '000000000000000000000001';

      band.$cast();

      assert.deepEqual(band.members,
        [new monogram.ObjectId('000000000000000000000001')]);
      assert.deepEqual(band.$delta().$set,
        { members: [new monogram.ObjectId('000000000000000000000001')] });

      // We can cast individual array elements...
      band = new Band({ members: ['000000000000000000000001'] });
      band.$cast();
      assert.deepEqual(band.members,
        [new monogram.ObjectId('000000000000000000000001')]);

      // Or do no casting at all if it isn't necessary
      band = new Band({
        members: [new monogram.ObjectId('000000000000000000000001')]
      });
      band.$cast();
      assert.deepEqual(band.members,
        [new monogram.ObjectId('000000000000000000000001')]);

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('casts deeply nested arrays', function(done) {
    co(function*() {
      let db = yield monogram('mongodb://localhost:27017');

      let schema = new monogram.Schema({
        points: [[{ $type: Number }]]
      });

      casting(schema);

      let Polygon = db.model({ collection: 'polygons', schema: schema });

      let p = new Polygon({}, false);
      p.points = 1;

      p.$cast();

      assert.deepEqual(p.points, [[1]]);
      assert.deepEqual(p.$delta().$set, { points: [[1]] });

      p.points = [[1]];
      p.$cast();
      assert.deepEqual(p.points, [[1]]);

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('returns an error you cast an object to a primitive', function(done) {
    co(function*() {
      let db = yield monogram('mongodb://localhost:27017');

      let schema = new monogram.Schema({
        name: {
          first: { $type: String },
          last: { $type: String }
        }
      });

      casting(schema);

      let User = db.model({ collection: 'users', schema: schema });

      let user = new User({}, false);

      user.name = 'Axl Rose';

      assert.deepEqual(user.$delta(), { $set: {}, $unset: {} });

      let error = user.$cast();
      assert.deepEqual(Object.keys(error.errors), ['name']);
      assert.equal(error.errors['name'].toString(),
        "Error: Could not cast 'Axl Rose' to Object");

      user.name = { first: 'Axl', last: 'Rose' };
      assert.equal(user.$cast(), undefined);

      assert.deepEqual(user.$delta(),
        { $set: { name: { first: 'Axl', last: 'Rose' } }, $unset: {} });

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('ignores if $type not specified', function(done) {
    co(function*() {
      let db = yield monogram('mongodb://localhost:27017');

      let schema = new monogram.Schema({
        members: { $lookUp: { ref: 'Test' } },
        tags: { $type: Array }
      });

      casting(schema);

      let Band = db.model({ collection: 'band', schema: schema });

      let band = new Band({}, false);

      band.members = { x: 1 };

      assert.equal(band.$cast(), undefined);

      band.tags = [1];

      assert.equal(band.$cast(), undefined);

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('throws if you try to set an array of objects to a primitive', function(done) {
    co(function*() {
      let db = yield monogram('mongodb://localhost:27017');

      let schema = new monogram.Schema({
        names: [{
          first: { $type: String },
          last: { $type: String }
        }]
      });

      casting(schema);

      let User = db.model({ collection: 'users', schema: schema });

      let user = new User({}, false);

      user.names = [];
      user.names.push('Axl Rose');

      let error = user.$cast();
      assert.deepEqual(Object.keys(error.errors), ['names.0']);
      assert.equal(error.errors['names.0'].toString(),
        "Error: Could not cast 'Axl Rose' to Object");

      user = new User({}, false);
      user.names = [['Axl Rose']];

      error = user.$cast();
      assert.deepEqual(Object.keys(error.errors), ['names.0']);
      assert.equal(error.errors['names.0'],
        "Error: Could not cast [ 'Axl Rose' ] to Object");

      user = new User({}, false);
      user.names = [{ first: 'Axl', last: 'Rose' }];
      assert.equal(user.$cast(), undefined);

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('removes null object keys', function(done) {
    co(function*() {
      let db = yield monogram('mongodb://localhost:27017');

      let schema = new monogram.Schema({
        name: {
          first: { $type: String },
          last: { $type: String }
        }
      });

      casting(schema);

      let User = db.model({ collection: 'users', schema: schema });

      let user = new User({}, false);

      user.name = null;

      user.$cast();

      assert.deepEqual(Object.keys(user), ['_id']);

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('casting nested sets', function(done) {
    co(function*() {
      let db = yield monogram('mongodb://localhost:27017');

      let schema = new monogram.Schema({
        name: {
          first: { $type: String },
          last: { $type: String }
        }
      });

      casting(schema);

      let User = db.model({ collection: 'users', schema: schema });

      let user = new User({}, false);

      user.name = { first: 'Axl', last: 'Rose', band: "Guns N' Roses" };
      user.other = 'abc';

      assert.deepEqual(user.$delta(),
        { $set: { name: { first: 'Axl', last: 'Rose' } }, $unset: {} });

      user.$cast();

      assert.deepEqual(_.omit(user, '_id'),
        { name: { first: 'Axl', last: 'Rose' } });

      assert.deepEqual(user.$delta(),
        { $set: { name: { first: 'Axl', last: 'Rose' } }, $unset: {} });

      user.name = { first: 'Axl', last: 123, nested: { x : 1 } };
      assert.deepEqual(user.$delta(),
        { $set: { name: { first: 'Axl', last: 123 } }, $unset: {} });

      user.$cast();

      assert.deepEqual(user.$delta(),
        { $set: { name: { first: 'Axl', last: '123' } }, $unset: {} });

      done();
    }).catch(function(error) {
      done(error);
    });
  });
});

describe('query casting', function() {
  let db;

  beforeEach(function(done) {
    co(function*() {
      db = yield monogram('mongodb://localhost:27017');
      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('works', function(done) {
    co(function*() {
      let schema = new monogram.Schema({
        _id: monogram.ObjectId,
        test: Number,
        tags: String
      });

      casting(schema);

      let Test = db.model({ schema: schema, collection: 'test' })

      let query = Test.find({
        _id: '000000000000000000000001',
        test: { $not: { $eq: '123' } },
        tags: { $in: [123] }
      });

      query.castFilter();

      assert.deepEqual(query.s.filter, {
        _id: monogram.ObjectId('000000000000000000000001'),
        test: { $not: { $eq: 123 } },
        tags: { $in: ['123'] }
      });

      query = Test.find({
        test: 'not a number'
      });

      assert.throws(function() {
        query.castFilter();
      }, /Could not cast 'not a number' to Number/g);

      query = Test.find({
        $or: [{ _id: '000000000000000000000001' }, { tags: { $in: [123] } }]
      });

      query.castFilter();

      assert.deepEqual(query.s.filter, {
        $or: [
          { _id: monogram.ObjectId('000000000000000000000001') },
          { tags: { $in: ['123'] } }
        ]
      });

      done();
    }).catch(function(error) {
      done(error);
    });
  });
});

describe('update casting', function() {
  let db;

  beforeEach(function(done) {
    co(function*() {
      db = yield monogram('mongodb://localhost:27017');
      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('works', function(done) {
    co(function*() {
      let schema = new monogram.Schema({
        test: Number,
        tags: String
      });

      casting(schema);

      let Test = db.model({ schema: schema, collection: 'test' })

      let query = Test.updateOne({},
        { $set: { tags: 123 }, $inc: { test: '1' } });

      query.castUpdate();

      assert.deepEqual(query.s.update, {
        $set: { tags: '123' },
        $inc: { test: 1 }
      });

      query = Test.updateOne({},
        { test: 'not a number' });

      assert.throws(function() {
        query.castUpdate();
      }, /Could not cast 'not a number' to Number/g);

      done();
    }).catch(function(error) {
      done(error);
    });
  });
});
