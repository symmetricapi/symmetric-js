const assert = require('assert');
const {
  getRoot,
  isPlainObject,
  copyObject,
  extendObject,
  toCamelCase,
  toUnderscore,
  camelCaseObject,
  underscoreObject,
  generateCid,
} = require('../src/utils');

function TestObj() {}

const camelCased = {
  key: true,
  camelCase: true,
  underscoreKey: true,
  subObject: {
    key: 'value',
    test: new TestObj(),
  },
};

const underscored = {
  key: true,
  camel_case: true,
  underscore_key: true,
  sub_object: {
    key: 'value',
    test: new TestObj(),
  },
};

assert(getRoot() === global);

assert(isPlainObject({}));
assert(isPlainObject(camelCased));
assert(isPlainObject(underscored));
assert(!isPlainObject(null));
assert(!isPlainObject(undefined));
assert(!isPlainObject(100));
assert(!isPlainObject(new TestObj()));

assert(camelCased !== copyObject(camelCased));
assert(underscored !== copyObject(underscored));
assert.deepStrictEqual(camelCased, copyObject(camelCased));
assert.deepStrictEqual(underscored, copyObject(underscored));
// Deep copy, where plain sub-objects are not the same but values are
assert(camelCased.subObject !== copyObject(camelCased).subObject);
assert(underscored.sub_object !== copyObject(underscored).sub_object);
assert(camelCased.subObject.test === copyObject(camelCased).subObject.test);
assert(underscored.sub_object.test === copyObject(underscored).sub_object.test);

const extended = extendObject({}, camelCased, underscored, { key: 'value' });
assert(extended.camelCase);
assert(extended.camel_case);
assert.strictEqual(extended.key, 'value');

assert.strictEqual(toCamelCase('not_camel_case'), 'notCamelCase');
assert.strictEqual(toUnderscore('notUnderscoreCasing'), 'not_underscore_casing');

assert.deepStrictEqual(camelCased, camelCaseObject(underscored));
assert.deepStrictEqual(underscored, underscoreObject(camelCased));

const cid = generateCid();
assert(cid !== generateCid());

console.log('Utils tests passed!');
