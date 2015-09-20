'use strict';

var assert = require('assert');
var casting = require('../');
var co = require('co');
var monogram = require('monogram');

describe('casting', function() {
  it('ignores paths not defined in the schema', function(done) {
    co(function*() {
      let db = yield monogram('mongodb://localhost:27017');

      let schema = new monogram.Schema({
        name: { $type: String }
      });

      casting(schema);

      let Person = db.model({ collection: 'people', schema: schema });

      let axl = new Person({}, false);

      assert.ok(!axl.$ignorePath('name'));
      assert.ok(axl.$ignorePath('role'));

      axl.name = 'Axl Rose';

      assert.deepEqual(axl.$delta(),
        { $set: { name: 'Axl Rose' }, $unset: {} });

      axl.role = 'Lead Singer';

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

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('throws if you cast an object to a primitive', function(done) {
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

      assert.throws(function() {
        user.$cast();
      }, /Could not cast 'Axl Rose' to Object/g);

      user = new User({}, false);

      user.name = { first: 'Axl', last: 'Rose' };
      assert.doesNotThrow(function() {
        user.$cast();
      });

      done();
    }).catch(function(error) {
      done(error);
    });
  });

  it('ignores if $type not specified', function(done) {
    co(function*() {
      let db = yield monogram('mongodb://localhost:27017');

      let schema = new monogram.Schema({
        members: { $lookUp: { ref: 'Test' } }
      });

      casting(schema);

      let Band = db.model({ collection: 'band', schema: schema });

      let band = new Band({}, false);

      band.members = { x: 1 };

      assert.doesNotThrow(function() {
        band.$cast();
      });

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

      assert.throws(function() {
        user.$cast();
      }, /Could not cast 'Axl Rose' to Object/g);

      user = new User({}, false);
      user.names = [['Axl Rose']];

      assert.throws(function() {
        user.$cast();
      }, /Could not cast \[ 'Axl Rose' \] to Object/g);

      user = new User({}, false);
      user.names = [{ first: 'Axl', last: 'Rose' }];
      assert.doesNotThrow(function() {
        user.$cast();
      });

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

      assert.equal(Object.keys(user).length, 0);

      done();
    }).catch(function(error) {
      done(error);
    });
  });
});
