'use strict';

let _ = require('lodash');
let debug = require('debug')('monogram:casting:filters');
let handleCast = require('./common').handleCast;
let join = require('./common').join;

const COMPARISON_SELECTORS = ['$eq', '$gt', '$gte', '$lt', '$lte', '$ne'];
const ARRAY_SELECTORS = ['$in', '$nin'];
const LOGICAL_SELECTORS = ['$or', '$and', '$nor'];

module.exports = castFilter;

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
