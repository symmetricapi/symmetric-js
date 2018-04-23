const assert = require('assert');
const Collection = require('../src/Collection').default;

const users = new Collection();
users.comparator = 'username';
users.url = () => 'http://jsonplaceholder.typicode.com/users';
users.fetch().then(() => {
  assert.strictEqual(users.length, 10);
  const user = users.at(0);
  assert.strictEqual(user.get('username'), 'Antonette');
  assert(!user.isDirty);
  user.set('username', 'test');
  assert(user.isDirty);
  user.revert('username');
  assert.strictEqual(user.get('username'), 'Antonette');
  // Auto sorting should work
  users.add({ id: 11, username: 'Carl' });
  assert.strictEqual(users.at(2).id, 11);

  const filtered = users.filter(item => (item.id < 6));
  assert(filtered instanceof Collection);
  assert.strictEqual(filtered.length, 5);
}).catch((err) => {
  console.log(err);
});

console.log('Collection tests passed!');
