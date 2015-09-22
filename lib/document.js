'use strict';

let _ = require('lodash');
let debug = require('debug')('monogram:casting:document');
let handleCast = require('./common').handleCast;
let join = require('./common').join;

module.exports = castDocument;

function castDocument(obj, schema) {
  visitObject(obj, schema, '');
}

function visitArray(obj, key, path, schema) {
  debug('visitArray', obj, key, path, schema);
  let curPath = join(path, key);
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
      visitArray(arr, index, curPath, schema);
    } else if (schema._paths[newPath].$type === Object) {
      visitObject(value, schema, newPath);
    }

    handleCast(arr, index, schema._paths[newPath].$type);
  });
}

function visitObject(obj, schema, path) {
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('Could not cast ' + require('util').inspect(obj) +
      ' to Object');
  }

  _.each(obj, function(value, key) {
    let newPath = join(path, key);
    if (!schema._paths[newPath] || !schema._paths[newPath].$type) {
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
