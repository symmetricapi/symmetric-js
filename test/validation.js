const assert = require('assert');
const validate = require('../src/validate').default;

// Validate integer testing true
assert(validate({ type: 'int' }, 10) === true);
assert(validate({ type: 'int', min: 1 }, 10) === true);
assert(validate({ type: 'int', min: 1, max: 13 }, 10) === true);
assert(validate({
  type: 'int', min: 1, max: 13, equals: 10,
}, 10) === true);
assert(validate({
  type: 'int', min: 1, max: 13, equals: [20, 10],
}, 10) === true);

// Validate integer testing errors
assert(validate({
  type: 'int', min: 1, max: 13, equals: [20, 30],
}, 10) === 'equals');
assert(validate({
  type: 'int', min: 1, max: 9,
}, 10) === 'max');
assert(validate({
  type: 'int', min: 100,
}, 10) === 'min');
assert(validate({ type: 'int' }, '10') === 'type');

// Validate string testing true
assert(validate({ type: 'string' }, 'dog') === true);
assert(validate({ type: 'string', min: 1 }, 'dog') === true);
assert(validate({ type: 'string', min: 1, max: 13 }, 'dog') === true);
assert(validate({
  type: 'string', min: 1, max: 13, equals: 'dog',
}, 'dog') === true);
assert(validate({
  type: 'string', min: 1, max: 13, equals: ['pet', 'dog'],
}, 'dog') === true);

// Validate string testing errors
assert(validate({
  type: 'string', min: 1, max: 13, equals: [20, 30],
}, 'dog') === 'equals');
assert(validate({
  type: 'string', min: 1, max: 2,
}, 'dog') === 'max');
assert(validate({
  type: 'string', min: 100,
}, 'dog') === 'min');
assert(validate({ type: 'string' }, 10) === 'type');

// Test required
assert(validate({ type: 'string' }, null) === true);
assert(validate({ type: 'string' }, '') === true);
assert(validate({ type: 'string', required: true }, null) === 'required');
assert(validate({ type: 'string', required: true }, '') === 'required');

// Test formats
assert(validate({ type: 'string', format: 'email' }, 'dog@') === 'format');
assert(validate({ type: 'string', format: 'email' }, 'dog@pet.com') === true);

assert(validate({ type: 'string', format: 'ip' }, '192.168.0') === 'format');
assert(validate({ type: 'string', format: 'ip' }, '192.168.0.1') === true);


console.log('Validation tests passed!');
