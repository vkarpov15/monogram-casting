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

function visitArray(arr, schema, path, skipCast) {
  debug('visitArray', arr, path, schema);
  let error = new CastError();
  let curPath = realPathToSchemaPath(path);
  let newPath = join(curPath, '$');
  if (!schema._paths[newPath] || !schema._paths[newPath].$type) {
    debug('skipping', newPath);
    return {
      value: arr,
      error: null
    };
  }

  if (!Array.isArray(arr)) {
    arr = [arr];
  }

  debug('newPath', newPath, schema._paths[newPath].$type);
  arr.forEach(function(value, index) {
    if (schema._paths[newPath].$type === Array) {
      let res = visitArray(value, schema, join(path, index, true),
        skipCast);
      if (res.error) {
        error.merge(res.error);
      }
      arr[index] = res.value;
      return;
    } else if (schema._paths[newPath].$type === Object) {
      let res = visitObject(value, schema, join(path, index, true),
        skipCast);
      if (res.error) {
        error.merge(res.error);
      }
      arr[index] = res.value;
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

  return {
    value: arr,
    error: (error.hasError ? error : null)
  };
}

function visitObject(obj, schema, path, skipCast) {
  debug('visitObject', obj, schema, path);
  let error = new CastError();
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    let err = new Error('Could not cast ' + require('util').inspect(obj) +
      ' to Object');
    error.markError(path, err);
    return {
      value: null,
      error: error
    };
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
      let res = visitArray(value, schema, newPath, skipCast);
      if (res.error) {
        debug('merge', res.error.errors);
        error.merge(res.error);
      }
      obj[key] = res.value;
      return;
    } else if (schema._paths[newPath].$type === Object) {
      if (value == null) {
        delete obj[key];
        return;
      }
      let res = visitObject(value, schema, newPath, skipCast);
      if (res.error) {
        debug('merge', res.error.errors);
        error.merge(res.error);
      }
      obj[key] = res.value;
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

  return {
    value: obj,
    error: (error.hasError ? error : null)
  };
}
