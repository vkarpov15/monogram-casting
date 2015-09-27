'use strict';

let _ = require('lodash');
let castDocument = require('./lib/document');
let castFilter = require('./lib/filters');
let castUpdate = require('./lib/update');
let debug = require('debug')('monogram:casting:debug');
let handleCast = require('./lib/common').handleCast;
let join = require('./lib/common').join;

module.exports = function(schema) {
  schema.queue(function() {
    // Ignore changes to paths not in the schema
    this.$transform(function(path, change, value) {
      path = path.replace(/\.\d+\./, '.$.');
      if (!schema._paths[path]) {
        return null;
      }
      if (value && typeof value === 'object' && schema._paths[path].$schema) {
        castDocument(value, schema, path);
      }
      return value;
    });
  });

  schema.method('document', '$cast', function() {
    castDocument(this, schema);
  });

  schema.method('query', 'castFilter', function() {
    castFilter(this.s.filter, schema);
  });

  schema.method('query', 'castUpdate', function() {
    castUpdate(this.s.update, schema, this.s.options);
  });

  schema.middleware('find', function*(next) {
    this.cast();
    yield next;
  });
};
