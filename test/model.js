const assert = require('assert');
const Model = require('../src/Model').default;

const model = new Model({ name: 'peter' });
assert.strictEqual(model.get('name'), 'peter');
assert(model.has('name'));
assert(!model.has('lastName'));

// Make model not new by assigning id
assert(model.isNew);
assert(!model.isDirty);

// Make the model dirty and then revert
model.set('id', 123);
model.set('name', 'peter2');
assert(!model.isNew);
assert(model.isDirty);
assert.strictEqual(model.get('name'), 'peter2');
assert.strictEqual(model.dirtyAttributes.name, 'peter');
model.revert('name');
assert(!model.isNew);
assert(!model.isDirty);
assert.strictEqual(model.get('name'), 'peter');
assert(!model.dirtyAttributes.name);

// Test unsetting
model.set('test', true);
assert(model.has('test'));
model.unset('test');
assert(!model.has('test'));
model.set({ test: true, test2: true });
assert(model.has('test') && model.has('test2'));
model.set({ test: undefined, test2: true });
assert(!model.has('test') && model.has('test2'));

// Test encoding
model.field = () => ({ encoding: 'date' });
model.set('day', new Date(1523760174833));
assert(model.get('day') instanceof Date);
assert(model.encode('day').indexOf('2018-04-15') === 0);

// Test cloning
const clone = model.clone();
assert.deepStrictEqual(model.attributes, clone.attributes);
assert(model.attributes !== clone.attributes);

console.log('Model tests passed!');
