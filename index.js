'use strict';

var _ = require('lodash');
var debug = require('debug')('monogram:casting:debug');

module.exports = function(schema) {
  schema.queue(function() {
    this.$ignorePath(function(path) {
      return !schema._paths[path.replace(/\.\d+\./, '.$.')];
    });
  });

  schema.method('document', '$cast', function() {
    cast(this, schema);
  });
};

function cast(obj, schema) {
  visitObject(obj, schema, '');
}

function visitArray(obj, key, path, schema) {
  debug('visitArray', obj, key, path, schema);
  let curPath = join(path, typeof key === 'number' ? '$' : key);
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
        return;
      }
      visitObject(value, schema, newPath);
      return;
    }

    handleCast(obj, key, schema._paths[newPath].$type);
  });
}

function handleCast(obj, key, type) {
  if (!(obj[key] instanceof type)) {
    obj[key] = type(obj[key]);
  }
}

function join(path, key) {
  if (path) {
    return path + '.' + key;
  }
  return key;
}
