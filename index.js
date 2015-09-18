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

function visitArray(arr, fn, path) {
  let newPath = join(path, '$');
  if (!schema._paths[newPath] || !schema._paths[newPath].$type) {
    return;
  }

  arr.forEach(function(v, index) {
    if (schema._paths[newPath].$type === Array) {
      if (!Array.isArray(value)) {
        value = obj[key] = [value];
      }
      visitArray(value, schema, newPath);
    } else if (schema._paths[newPath].$type === Object) {
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Could not cast ' + require('util').inspect(value) +
          ' to Object');
      }
      if (value == null) {
        delete obj[key];
        return;
      }
      visitObject(value, schema, newPath);
    } else if (!(value instanceof schema._paths[newPath].$type)) {
      obj[key] = new schema._paths[newPath].$type(value);
    }
  });
}

function visitObject(obj, schema, path) {
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
    } else if (schema._paths[newPath].$type === Object) {
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Could not cast ' + require('util').inspect(value) +
          ' to Object');
      }
      if (value == null) {
        delete obj[key];
        return;
      }
      visitObject(value, schema, newPath);
    } else if (!(value instanceof schema._paths[newPath].$type)) {
      obj[key] = schema._paths[newPath].$type(value);
    }
  });
}

function join(path, key) {
  if (path) {
    return path + '.' + key;
  }
  return key;
}
