'use strict';

let _ = require('lodash');
let debug = require('debug')('monogram:casting:filters');
let handleCast = require('./common').handleCast;
let join = require('./common').join;

const COMPARISON_SELECTORS = ['$eq', '$gt', '$gte', '$lt', '$lte', '$ne'];
const ARRAY_SELECTORS = ['$in', '$nin'];
const LOGICAL_SELECTORS = ['$or', '$and', '$nor'];
const ELEMENT_SELECTORS = {
  $exists: Boolean,
  $type: Number,
  $regex: RegExp,
  $size: Number
};

const IGNORED_SELECTORS = {
  $geoWithin: true,
  $geoIntersects: true,
  $mod: true,
  $near: true,
  $nearSphere: true,
  $text: true
};

module.exports = castFilter;

function castFilter(filters, schema, path) {
  _.each(filters, function(value, key) {
    debug('loop', key, value, path);

    if (LOGICAL_SELECTORS.indexOf(key) !== -1 || key === '$all') {
      if (!Array.isArray(value)) {
        value = filters[key] = [value];
      }
      _.each(value, function(value, key) {
        castFilter(value, schema, path);
      });
      return;
    } else if (key === '$where') {
      // No casting for '$where'
      return;
    } else if (key === '$elemMatch') {
      let newPath = join(path, '$');
      if (!schema._paths[newPath] || !schema._paths[newPath].$type) {
        return;
      }
      if (schema._paths[newPath].$type === Array ||
          schema._paths[newPath].$type === Object) {
        return castFilter(value, schema, newPath);
      }
      return handleCastForQuery(filters, key, schema._paths[newPath].$type);
    }

    if (IGNORED_SELECTORS[key]) {
      // Ignore operators that are tricky to cast
      return;
    }

    let newPath = join(path, key);
    if (!schema._paths[newPath] || !schema._paths[newPath].$type) {
      return;
    }

    if (schema._paths[newPath].$type === Array) {
      castFilter(value, schema, newPath);
    } else if (schema._paths[newPath].$type === Object) {
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Could not cast ' + require('util').inspect(value) +
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
  let hasDollarKey = false;
  debug('cast', obj[key], 'to', type.name);
  if (value && typeof value === 'object') {
    _.each(value, function(v, firstKey) {
      if (firstKey.charAt(0) === '$') {
        hasDollarKey = true;
      }

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
      } else if (ELEMENT_SELECTORS[firstKey]) {
        handleCastForQuery(obj[key], firstKey, ELEMENT_SELECTORS[firstKey]);
        return;
      }
    });
  }

  debug('hasDollarKey', hasDollarKey);

  if (hasDollarKey) {
    return;
  }

  handleCast(obj, key, type);
}
