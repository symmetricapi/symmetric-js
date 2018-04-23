const assert = require('assert');
const Observable = require('../src/Observable').default;

const observerCounts = {};

function getCount(action, path) {
  const key = path ? `${action}:${path}` : action;
  return observerCounts[key];
}

function observer(obj, action, path) {
  const key = path ? `${action}:${path}` : action;
  observerCounts[key] = key in observerCounts ? observerCounts[key] + 1 : 1;
}

const observable = new Observable();
observable.addObserver('change', 'field', observer);
for (let i = 0; i < 10; i += 1) observable.invokeObservers('change', 'field');
assert.strictEqual(getCount('change', 'field'), 10);

// no counts should change with observer removed
observable.removeObserver('change', 'field', observer);
for (let i = 0; i < 10; i += 1) observable.invokeObservers('change', 'field');
assert.strictEqual(getCount('change', 'field'), 10);

// action and action:path observers double the counts
observable.addObserver('change', 'field', observer);
observable.addObserver('change', observer);
for (let i = 0; i < 10; i += 1) observable.invokeObservers('change', 'field');
assert.strictEqual(getCount('change', 'field'), 30);

// Non-matching path should not double the counts
for (let i = 0; i < 10; i += 1) observable.invokeObservers('change', 'other');
assert.strictEqual(getCount('change', 'other'), 10);

// runSilent should not invoke any observers
observable.runSilent(() => {
  for (let i = 0; i < 10; i += 1) observable.invokeObservers('change', 'field');
});
assert.strictEqual(getCount('change', 'field'), 30);

// Remove the path specific observer
observable.removeObserver('change', 'field', observer);
for (let i = 0; i < 10; i += 1) observable.invokeObservers('change', 'field');
assert.strictEqual(getCount('change', 'field'), 40);

console.log('Observable tests passed!');
