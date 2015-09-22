'use strict';

var _ = require('lodash');
var debug = require('debug')('monogram:casting:debug');

const COMPARISON_SELECTORS = ['$eq', '$gt', '$gte', '$lt', '$lte', '$ne'];
const ARRAY_SELECTORS = ['$in', '$nin'];
const LOGICAL_SELECTORS = ['$or', '$and', '$nor'];

let SPECIAL_CASES = new WeakMap();
SPECIAL_CASES.set(Number, function(v) {
  let casted = Number(v);
  if (isNaN(casted)) {
    throw new Error('Could not cast ' + require('util').inspect(v) +
      ' to Number');
  }
  return casted;
});

module.exports = function(schema) {
  schema.queue(function() {
    this.$ignorePath(function(path) {
      return !schema._paths[path.replace(/\.\d+\./, '.$.')];
    });
  });

  schema.method('document', '$cast', function() {
    cast(this, schema);
  });

  schema.method('query', 'cast', function() {
    castFilter(this.s.filter, schema);
  });

  schema.middleware('find', function*(next) {
    this.cast();
    yield next;
  });
};

function castFilter(filters, schema, path) {
  _.each(filters, function(value, key) {
    debug('loop', key, value);

    let newPath = join(path, key);
    if (!schema._paths[newPath] || !schema._paths[newPath].$type) {
      return;
    }

    if (schema._paths[newPath].$type === Array) {
      if (!Array.isArray(value)) {
        value = filters[key] = [value];
      }
      castFilter(value, schema, newPath);
    } else if (schema._paths[newPath].$type === Object) {
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Could not cast ' + require('util').inspect(obj) +
          ' to Object');
      }
      castFilter(value, schema, newPath);
    } else {
      handleCastForQuery(filters, key, schema._paths[newPath].$type);
    }
  });
}

function cast(obj, schema) {
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

    if (LOGICAL_SELECTORS.indexOf(key) !== -1) {
      if (Array.isArray(value)) {
        visitArray(value, schema, path);
      } else {
        visitObject(value, schema, path);
      }
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

function handleCastForQuery(obj, key, type) {
  let value = obj[key];
  if (value && typeof value === 'object') {
    let keys = Object.keys(value);
    if (keys.length > 0) {
      let firstKey = keys[0];
      if (COMPARISON_SELECTORS.indexOf(firstKey) !== -1 ||
          firstKey === '$not') {
        handleCastForQuery(obj[key], firstKey, type);
        return;
      } else if (ARRAY_SELECTORS.indexOf(firstKey) !== -1) {
        if (!Array.isArray(value[firstKey])) {
          value[firstKey] = [value[firstKey]];
        }
        _.each(value[firstKey], function(v, key) {
          handleCastForQuery(value[firstKey], key, type);
        });
        return;
      }
    }
  }

  handleCast(obj, key, type);
}

function handleCast(obj, key, type) {
  if (!(obj[key] instanceof type)) {
    if (SPECIAL_CASES.has(type)) {
      obj[key] = SPECIAL_CASES.get(type)(obj[key]);
    } else {
      obj[key] = type(obj[key]);
    }
  }
}

function join(path, key) {
  if (typeof key === 'number') {
    key = '$';
  }
  if (path) {
    return path + '.' + key;
  }
  return key;
}
