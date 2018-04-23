import { getRoot } from './utils';

const clsMap = {};
const root = getRoot();

if (root.Buffer) {
  clsMap.Buffer = root.Buffer;
}

function isRevivable(value) {
  return (
    value && typeof value === 'object' &&
    value.type && value.data &&
    Object.keys(value).length === 2 && value.type in clsMap
  );
}

function reviver(key, value) {
  if (isRevivable(value)) {
    const Cls = clsMap[value.type];
    return new Cls(value.data);
  }
  return value;
}

function isReplaceable(value) {
  return (
    value && typeof value === 'object' &&
    value.constructor && value.constructor.name in clsMap
  );
}

function replacer(key, value) {
  if (isReplaceable(value)) {
    const data = value.toJSON ? value.toJSON() : Object.assign({}, value);
    const type = value.constructor.name;
    if (!isRevivable(data)) {
      return { data, type };
    }
  }
  return value;
}

function replace(rawData) {
  const data = replacer(null, rawData);
  if (data && typeof data === 'object') {
    if (Array.isArray(data)) {
      return data.map(item => replace(item));
    }
    const newData = {};
    Object.keys(data).forEach((key) => {
      newData[key] = replace(data[key]);
    });
    return newData;
  }
  return data;
}

/**
 * Register a class for serialization so that instances can be properly stored and recreated.
 * @param {Class} Cls - The class to add as to enable serializable instances.
 */
export function register(Cls) {
  clsMap[Cls.name] = Cls;
}

/**
 * Serialize any data into JSON for storage where classes are stored with an identifier type.
 * @param {*} data - The data to serialize
 */
export function serialize(data) {
  // NOTE: JSON.stringify runs toJSON before replacer is called so a recursive must be used instead
  return JSON.stringify(replace(data));
}

/**
 * Deserializes any JSON data using a reviver that parses objects into supported class instances.
 * @param {*} data - The data to deserialize
 */
export function deserialize(data) {
  if (!data) {
    return data;
  }
  return JSON.parse(data, reviver);
}
