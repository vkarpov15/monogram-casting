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
      if (value && schema._paths[path].$schema) {
        value = castDocument(value, schema, path, true).value;
      }
      return value;
    });
  });

  schema.method('document', '$cast', function() {
    return castDocument(this, schema).error;
  });

  schema.method('query', 'castFilter', function() {
    castFilter(this.s.filter, schema);
  });

  schema.method('query', 'castUpdate', function() {
    castUpdate(this.s.update, schema, this.s.options);
  });

  schema.middleware('$save', function*(next) {
    let error = this.$cast();
    if (error.hasError) {
      throw error;
    }
    yield next;
  });

  let castFilter = function*(next) {
    this.castFilter();
    yield next;
  };
  let castUpdate = function*(next) {
    this.castUpdate();
    yield next;
  }

  [
    'count', 'distinct', 'find', 'findOne', 'deleteOne', 'deleteMany',
    'replaceOne', 'updateOne', 'updateMany', 'findOneAndDelete',
    'findOneAndReplace', 'findOneAndUpdate',
    'cursor'
  ].forEach(function(method) {
    schema.middleware(method, castFilter);
  });

  [
    'replaceOne', 'updateOne', 'updateMany', 'findOneAndReplace',
    'findOneAndUpdate'
  ].forEach(function(method) {
    schema.middleware(method, castUpdate);
  });
};
