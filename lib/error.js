'use strict';

let _ = require('lodash');

class CastError extends Object {
  constructor() {
    super();
    this.errors = {};
    this.hasError = false;
  }

  markError(path, error) {
    this.errors[path] = error;
    this.hasError = true;
    return this;
  }

  merge(error) {
    _.each(error.errors, (value, key) => {
      this.errors[key] = value;
    });
    this.hasError = Object.keys(this.errors).length > 0;
    return this;
  }

  toString() {
    let str = [];
    _.each(error.errors, function(value, key) {
      str.push(`${key}: ${value}`);
    });
    return str.join(', ');
  }
}

module.exports = CastError;
