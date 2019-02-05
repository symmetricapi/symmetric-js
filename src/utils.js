/* eslint guard-for-in: 0, no-restricted-syntax: 0, no-param-reassign: 0 */
import config from './config';

/** Returns the root window or global object. */
export function getRoot(key) {
  // self will support both in-browser window and WebWorker
  const root = (
    (typeof self === 'object' && self.self === self && self) || // eslint-disable-line
    (typeof global === 'object' && global.global === global && global)
  );
  return key ? root[key] : root;
}

/** Returns true if the given object is an instance of Object and not of a subclass or other type */
export function isPlainObject(obj) {
  // First check of just obj is needed because typeof null is object
  return (obj && typeof obj === 'object' && Object.getPrototypeOf(obj) === Object.prototype);
}

/**
 * Create a deep copy of plain objects
 * Anything not a plain object (subclass, function, array, etc) will be copied by reference
 * @param {Object} obj - The object to copy
 */
export function copyObject(obj) {
  const copy = {};
  let value;
  for (const key in obj) {
    value = obj[key];
    if (isPlainObject(value)) value = copyObject(value);
    copy[key] = value;
  }
  return copy;
}

/**
 * Extends a plain object with values from other objects
 * @param {Object} obj - The target object to extend
 * @param {Array} others - One or more other objects
 */
export function extendObject(obj, ...others) {
  for (let other, i = 0; i < others.length; i += 1) {
    other = others[i] || {};
    for (const key in other) obj[key] = other[key];
  }
  return obj;
}

/**
 * getAttr() will default to the default given or the string '0' so that comparisons work
 * successfully for any type comparing undefined, null, or NaN to any value is always false
 * 0 < 'a' is false and 0 > 'a' is false because converting the non-numeric 'a' to a Number
 * is NaN But with the string: '0' < 'a' is true and '0' > 'a' is false
 */
export function getAttr(obj, key, def) {
  const value = key.split('.').reduce((o, i) => ((o && o.get && o.get(i)) || (o && o[i]) || '0'), obj);
  return (value === '0' && def) ? def : value;
}

export function toCamelCase(str) {
  const components = str.split('_');
  if (components.length === 1) return str;
  let camelCase = components[0].toLowerCase();
  if (components.length > 1) {
    for (let i = 1; i < components.length; i += 1) {
      camelCase += components[i].substr(0, 1).toUpperCase() + components[i].substr(1);
    }
  }
  return camelCase;
}

export function toUnderscore(str) {
  const words = [];
  let wordStart = 0;
  for (let c, i = 0; i < str.length; i += 1) {
    c = str[i];
    if (i && c === c.toUpperCase()) {
      words.push(str.substring(wordStart, i).toLowerCase());
      wordStart = i;
    }
  }
  words.push(str.substr(wordStart).toLowerCase());
  return words.join('_');
}

/**
 * Does a conversion of underscore-based attributes to camelCase.
 * @param {Object} obj
 * @param {Boolean} [deep] - if true will do a deep conversion into any sub-objects
 */
export function camelCaseObject(obj, deep) {
  if (!isPlainObject(obj)) return obj;
  const converted = {};
  for (const key in obj) {
    const value = obj[key];
    converted[toCamelCase(key)] = (deep && typeof value === 'object' ? camelCaseObject(value, deep) : value);
  }
  return converted;
}

/**
 * Does a conversion of camelCase-based attributes to underscore.
 * @param {Object} obj
 * @param {Boolean} [deep] - if true will do a deep conversion into any sub-objects
 */
export function underscoreObject(obj, deep) {
  if (!isPlainObject(obj)) return obj;
  const converted = {};
  for (const key in obj) {
    const value = obj[key];
    converted[toUnderscore(key)] = (deep && typeof value === 'object' ? underscoreObject(value, deep) : value);
  }
  return converted;
}

/** Prepare a url with an optional params dict to be added to the query string. */
export function prepareUrl(url, params, underscoreParams) {
  if (!params) return url;
  const args = underscoreParams ? underscoreObject(params) : params;
  const encoded = Object.keys(args).map(key => `${key}=${encodeURIComponent(args[key])}`).join('&');
  return url.indexOf('?') === -1 ? `${url}?${encoded}` : `${url}&${encoded}`;
}

/** Returns true if a url is of the same origin (protocol, hostname, and port) as the window. */
export function isSameOrigin(url) {
  if (!url) return false;
  if (url[0] === '/' && url[1] !== '/') return true;
  const location = getRoot('location');
  if (!location) return false;
  const port = location.port ? `:${location.port}` : '';
  const origin = location.origin || `${location.protocol}//${location.hostname}${port}`;
  return url.substr(0, origin.length) === origin;
}

export function parseLinks(value) {
  // https://tools.ietf.org/html/rfc5988#page-4
  const links = [];
  const linkRe = /\s*<(.*?)>\s*;\s*([^<]*)\s*/g;
  let match = linkRe.exec(value);
  while (match) {
    const params = {};
    match[2].split(';').forEach((pair) => {
      const [k, v] = pair.trim().split('=');
      params[k] = v.substr(1, v.length - 2);
    });
    links.push(extendObject({ url: match[1] }, params));
    match = linkRe.exec(value);
  }
  return links;
}

/** Encode a value using config.encoders. */
export function encode(value, type) {
  if (value === null || value === undefined) return '';
  if (type in config.encoders) return config.encoders[type](value);
  return value.toString();
}

/** Decode a value using config.decoders. */
export function decode(value, type) {
  if (!value) return null;
  if (type in config.decoders) return config.decoders[type](value);
  return value;
}

let nextCid = 0;

/** Generate a new unique client id. */
export function generateCid() {
  nextCid += 1;
  return nextCid;
}
