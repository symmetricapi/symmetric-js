const assert = require('assert');
const {
  getRoot,
  isPlainObject,
  copyObject,
  extendObject,
  toCamelCase,
  toSnakeCase,
  camelCaseObject,
  snakeCaseObject,
  generateCid,
  parseLinks,
} = require('../src/utils');

function TestObj() {}

const camelCased = {
  key: true,
  camelCase: true,
  snakeCaseKey: true,
  subObject: {
    key: 'value',
    test: new TestObj(),
    keyTest: '',
  },
};

const snakeCased = {
  key: true,
  camel_case: true,
  snake_case_key: true,
  sub_object: {
    key: 'value',
    test: new TestObj(),
    key_test: '',
  },
};

const links = [
  {
    url: 'https://api.github.com/user/repos?page=3&per_page=100',
    rel: 'next',
    title: 'Next Page"',
  },
  {
    url: 'https://api.github.com/user/repos?page=50&per_page=100',
    rel: 'last',
  },
];

assert(getRoot() === global);

assert(isPlainObject({}));
assert(isPlainObject(camelCased));
assert(isPlainObject(snakeCased));
assert(!isPlainObject(null));
assert(!isPlainObject(undefined));
assert(!isPlainObject(100));
assert(!isPlainObject(new TestObj()));

assert(camelCased !== copyObject(camelCased));
assert(snakeCased !== copyObject(snakeCased));
assert.deepStrictEqual(camelCased, copyObject(camelCased));
assert.deepStrictEqual(snakeCased, copyObject(snakeCased));
// Deep copy, where plain sub-objects are not the same but values are
assert(camelCased.subObject !== copyObject(camelCased).subObject);
assert(snakeCased.sub_object !== copyObject(snakeCased).sub_object);
assert(camelCased.subObject.test === copyObject(camelCased).subObject.test);
assert(snakeCased.sub_object.test === copyObject(snakeCased).sub_object.test);

const extended = extendObject({}, camelCased, snakeCased, { key: 'value' });
assert(extended.camelCase);
assert(extended.camel_case);
assert.strictEqual(extended.key, 'value');

assert.strictEqual(toCamelCase('not_camel_case'), 'notCamelCase');
assert.strictEqual(toSnakeCase('notSnakeCasing'), 'not_snake_casing');

assert.notDeepStrictEqual(camelCased, camelCaseObject(snakeCased));
assert.notDeepStrictEqual(snakeCased, snakeCaseObject(camelCased));

assert.deepStrictEqual(camelCased, camelCaseObject(snakeCased, true));
assert.deepStrictEqual(snakeCased, snakeCaseObject(camelCased, true));

const cid = generateCid();
assert(cid !== generateCid());

assert.deepStrictEqual(
  links,
  parseLinks(
    '<https://api.github.com/user/repos?page=3&per_page=100>; rel="next"; title="Next Page", <https://api.github.com/user/repos?page=50&per_page=100>; rel="last"',
  ),
);

console.log('Utils tests passed!');
