'use strict';

let _ = require('lodash');
let debug = require('debug')('monogram:casting:document');
let handleCast = require('./common').handleCast;
let join = require('./common').join;
let realPathToSchemaPath = require('./common').realPathToSchemaPath;

module.exports = castDocument;

function castDocument(obj, schema, path) {
  visitObject(obj, schema, path || '');
}

function visitArray(obj, key, path, schema) {
  debug('visitArray', obj, key, path, schema);
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
      visitArray(arr, index, realPath, schema);
    } else if (schema._paths[newPath].$type === Object) {
      visitObject(value, schema, realPath);
    }

    handleCast(arr, index, schema._paths[newPath].$type);
  });
}

function visitObject(obj, schema, path) {
  debug('visitObject', obj, schema, path);
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('Could not cast ' + require('util').inspect(obj) +
      ' to Object');
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
      visitArray(obj, key, path, schema);
      return;
    } else if (schema._paths[newPath].$type === Object) {
      if (value == null) {
        delete obj[key];
      }
      visitObject(value, schema, newPath);
      return;
    }

    handleCast(obj, key, schema._paths[newPath].$type);
  });
}
