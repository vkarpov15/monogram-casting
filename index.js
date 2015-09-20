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

function visitArray(arr, schema, path) {
  let newPath = join(path, '$');
  if (!schema._paths[newPath] || !schema._paths[newPath].$type) {
    return;
  }

  arr.forEach(function(value, index) {
    if (schema._paths[newPath].$type === Array) {
      if (!Array.isArray(value)) {
        value = arr[index] = [value];
      }
      visitArray(value, schema, newPath);
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
    debug(key, value);
    let newPath = join(path, key);
    if (!schema._paths[newPath] || !schema._paths[newPath].$type) {
      return;
    }

    if (schema._paths[newPath].$type === Array) {
      if (!Array.isArray(value)) {
        value = obj[key] = [value];
      }
      visitArray(value, schema, newPath);
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
