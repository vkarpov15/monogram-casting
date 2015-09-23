'use strict';

let _ = require('lodash');
let debug = require('debug')('monogram:casting:update');
let handleCast = require('./common').handleCast;
let join = require('./common').join;

module.exports = castUpdate;

function castUpdate(update, schema, options) {
  let hasNonDollarKey = false;
  let firstDollarKey = null;
  let overwrite = _.get(options, 'overwrite');

  _.each(update, function(value, key) {
    if (key.charAt(0) === '$') {
      firstDollarKey = key;

      visitObject(value, schema);
    } else {
      hasNonDollarKey = true;
    }
  });

  if (!!firstDollarKey && hasNonDollarKey) {
    throw new Error(`field names cannot start with $ [${firstDollarKey}]`);
  }

  if (hasNonDollarKey && !overwrite) {
    visitObject(update, schema);
    return { $set: update };
  }

  if (hasNonDollarKey && overwrite) {
    visitObject(update, schema);
  }

  return update;
}

function visitArray(obj, key, path, schema) {
  debug('visitArray', obj, key, path, schema);
  let curPath = join(path, key);
  let newPath = join(curPath, '$');
  if (!schema._paths[newPath].$type) {
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
    if (!schema._paths[newPath]) {
      delete obj[key];
      return;
    }
    if (!schema._paths[newPath].$type) {
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
