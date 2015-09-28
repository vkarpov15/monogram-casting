'use strict';

let _ = require('lodash');
let CastError = require('./error');
let debug = require('debug')('monogram:casting:document');
let handleCast = require('./common').handleCast;
let join = require('./common').join;
let realPathToSchemaPath = require('./common').realPathToSchemaPath;

module.exports = castDocument;

function castDocument(obj, schema, path, skipCast) {
  return visitObject(obj, schema, path || '', skipCast);
}

function visitArray(obj, key, path, schema, skipCast) {
  debug('visitArray', obj, key, path, schema);
  let error = new CastError();
  let realPath = join(path, key, true);
  let curPath = realPathToSchemaPath(realPath);
  let newPath = join(curPath, '$');
  if (!schema._paths[newPath] || !schema._paths[newPath].$type) {
    debug('skipping', newPath);
    return;
  }

  let arr = obj[key];
  if (!Array.isArray(arr)) {
    arr = obj[key] = [arr];
  }

  debug('newPath', newPath, schema._paths[newPath].$type);
  arr.forEach(function(value, index) {
    if (schema._paths[newPath].$type === Array) {
      let err = visitArray(arr, index, realPath, schema, skipCast);
      if (err) {
        error.merge(err);
      }
      return;
    } else if (schema._paths[newPath].$type === Object) {
      let err = visitObject(value, schema, join(realPath, index, true),
        skipCast);
      if (err) {
        error.merge(err);
      }
      return;
    }

    if (!skipCast) {
      try {
        handleCast(arr, index, schema._paths[newPath].$type);
      } catch(err) {
        error.markError(join(realPath, index, true), err);
      }
    }
  });

  if (error.hasError) {
    return error;
  }
}

function visitObject(obj, schema, path, skipCast) {
  debug('visitObject', obj, schema, path);
  let error = new CastError();
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    let err = new Error('Could not cast ' + require('util').inspect(obj) +
      ' to Object');
    error.markError(path, err);
    return error;
  }

  let fakePath = realPathToSchemaPath(path);

  _.each(obj, function(value, key) {
    let newPath = join(path, key);
    if (!schema._paths[newPath]) {
      delete obj[key];
      return;
    }
    if (!schema._paths[newPath].$type) {
      // If type not specified, no type casting
      return;
    }

    if (schema._paths[newPath].$type === Array) {
      let err = visitArray(obj, key, path, schema, skipCast);
      if (err) {
        debug('merge', err.errors);
        error.merge(err);
      }
      return;
    } else if (schema._paths[newPath].$type === Object) {
      if (value == null) {
        delete obj[key];
        return;
      }
      let err = visitObject(value, schema, newPath, skipCast);
      if (err) {
        debug('merge', err.errors);
        error.merge(err);
      }
      return;
    }

    if (!skipCast) {
      try {
        handleCast(obj, key, schema._paths[newPath].$type);
      } catch(err) {
        error.markError(join(path, key, true), err);
      }
    }
  });

  if (error.hasError) {
    return error;
  }
}
