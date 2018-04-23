const assert = require('assert');
const Model = require('../src/Model').default;
const {
  register,
  serialize,
  deserialize,
} = require('../src/serialization');

class MyModel extends Model {

}
register(MyModel);

class Serializable {
  constructor() {
    this.x = 10;
  }
  getX() {
    return this.x;
  }
}
register(Serializable);

const original = {
  model: new MyModel({ name: 'peter' }),
  serializable: new Serializable(),
  key: 'value',
};
const data = deserialize(serialize(original));
assert(data);
assert(data.serializable instanceof Serializable);
assert(data.model instanceof MyModel);
assert.notStrictEqual(original, data);
assert.notStrictEqual(original.model, data.model);
assert.notStrictEqual(original.model.cid, data.model.cid);
original.model.set('name', 'peter2');
assert.strictEqual(data.model.get('name'), 'peter');
assert.notStrictEqual(original.serializable, data.serializable);
assert(data.serializable instanceof Serializable);
assert.strictEqual(data.serializable.x, 10);
assert.strictEqual(data.serializable.getX(), 10);
assert.strictEqual(data.key, 'value');
