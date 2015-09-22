'use strict';

let _ = require('lodash');
let castDocument = require('./lib/document');
let castFilter = require('./lib/filters');
let debug = require('debug')('monogram:casting:debug');
let handleCast = require('./lib/common').handleCast;
let join = require('./lib/common').join;

module.exports = function(schema) {
  schema.queue(function() {
    this.$ignorePath(function(path) {
      return !schema._paths[path.replace(/\.\d+\./, '.$.')];
    });
  });

  schema.method('document', '$cast', function() {
    castDocument(this, schema);
  });

  schema.method('query', 'cast', function() {
    castFilter(this.s.filter, schema);
  });

  schema.middleware('find', function*(next) {
    this.cast();
    yield next;
  });
};
