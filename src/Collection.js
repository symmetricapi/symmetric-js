import config from './config';
import Model from './Model';
import Observable from './Observable';
import { extendObject, generateCid, getAttr } from './utils';

/**
 * Collection is manages an array of items (Model instances).
 * Updates observers with add:<cid>, remove:<cid>, reset, sync:fetch|save, and sort
 * @class
 */
class Collection extends Observable {
  constructor(items) {
    super();
    this.cid = generateCid();
    this.comparator = null;
    this.items = [];
    this.add(Array.isArray(items) ? this.parse(items) : items);
  }

  toJSON() {
    return Array.from(this.items);
  }

  /** Create a mutable copy of the items array. */
  toArray() {
    return Array.from(this.items);
  }

  /** Creates a copy of the collection without any observers. */
  clone() {
    const proto = Object.getPrototypeOf(this);
    const c = Object.create(proto);
    c.items = Array.from(this.items);
    c.comparator = this.comparator;
    return c;
  }

  get length() {
    return this.items.length;
  }

  add(items, unshift) {
    if (!items) return this;
    if (items instanceof Collection) return this.add(items.items);
    if (Array.isArray(items)) {
      // Add each item individually but wait until the end to autosort
      const { comparator } = this;
      this.comparator = null;
      (unshift ? items.reverse() : items).forEach((item) => { this.add(item, unshift); });
      this.comparator = comparator;
      this.sort(this.comparator);
      return this;
    }
    let item = items;
    if (!(item instanceof Model)) {
      const ModelCls = this.model(item);
      item = new ModelCls(item);
    }
    item.collection = this;
    if (unshift) {
      this.items.unshift(item);
    } else {
      this.items.push(item);
    }
    this.invokeObservers('add', item.cid);
    this.sort(this.comparator);
    return this;
  }

  /**
   * Remove one or more items from the collection.
   * @param {*} items - model, cid, array of models/cids, or a filter function
   * @returns {Array|Object} - the model or array of models removed
   */
  remove(items) {
    if (typeof items === 'function') {
      return this.remove(this.items.filter(items));
    }
    if (Array.isArray(items)) {
      // Remove each item individually but wait until the end to autosort
      const { comparator } = this;
      const removed = [];
      this.comparator = null;
      items.forEach((item) => { removed.push(this.remove(item)); });
      this.comparator = comparator;
      this.sort(this.comparator);
      return removed;
    }
    let item = items;
    if (item instanceof Model) {
      item = item.cid;
    }
    for (let i = 0; i < this.items.length; i += 1) {
      if (this.items[i].cid === item) {
        [item] = this.items.splice(i, 1);
        item.collection = null;
        this.invokeObservers('remove', item.cid);
        this.sort(this.comparator);
        return item;
      }
    }
    return null;
  }

  /** Remove all items and only trigger a single reset event. */
  reset() {
    // eslint-disable-next-line no-param-reassign
    this.items.forEach((item) => { item.collection = null; });
    this.items = [];
    this.invokeObservers('reset');
  }

  /**
   * Returns a new clone of the collection with items filtered.
   * @param {*} args - () => {} or {id: 12.. params} - return a new collection of matching items
   */
  filter(args) {
    let callback = args;
    const clone = this.clone();
    if (typeof callback !== 'function') {
      const keys = Object.keys(args);
      callback = (item) => {
        // Allow each arg to be a value or regex
        for (let arg, value, i = 0; i < keys.length; i += 1) {
          arg = args[i];
          value = item.attributes[keys[i]];
          // eslint-disable-next-line eqeqeq
          if ((arg instanceof RegExp && !arg.test(value)) || arg != value) return false;
        }
        return true;
      };
    }
    clone.items = this.items.filter(callback);
    return clone;
  }

  has(args) {
    if (args instanceof Model) return args.collection === this;
    return this.filter(args).length > 0;
  }

  get(args) {
    return this.filter(args).at(0);
  }

  at(index) {
    return this.items[index];
  }

  forEach(callback) {
    this.items.forEach(callback);
  }

  sort(comparator) {
    let fun = comparator;
    let reverse = false;
    if (!fun) return;
    if (typeof fun !== 'function') {
      let key = fun;
      reverse = key[0] === '-';
      if (reverse) key = key.substr(1);
      fun = (a, b) => {
        const valueA = getAttr(a, key);
        const valueB = getAttr(b, key);
        if (valueA < valueB) return -1; else if (valueB < valueA) return 1;
        return 0;
      };
    }
    this.items.sort(fun);
    if (reverse) {
      this.items = this.items.reverse();
    }
    this.invokeObservers('sort');
  }

  /**
   * Override this method and return the model class necessary to make a new instance with.
   * @param {Object} item - raw attribute data yet to be put into a model
   * @returns {class}
   */
  model(item) { // eslint-disable-line no-unused-vars
    return Model;
  }

  /**
   * Override to return the URL of the collection.
   * @param {Object} options - options passed to the sync function
   * @param {string} operation - fetch, save, or destroy
   */
  url(options, operation) { // eslint-disable-line no-unused-vars
    return '';
  }

  /**
   * Override to provide custom parsing of data received from the backend or for a new instance.
   * Do not make assumptions about the data being passed.
   * @param {Array} data
   */
  parse(data) {
    if (!Array.isArray(data)) return data;
    // Convert each item to a model if not already
    return data.map((item) => {
      if (item instanceof Model) return item;
      const ModelCls = this.model(item);
      return new ModelCls(item);
    });
  }

  /**
   * Loads the collection from the server and merges into any existing items already present.
   * @param {Object} options
   */
  fetch(options = {}) {
    const syncOptions = extendObject({ method: 'GET' }, options);
    syncOptions.url = this.url(options, 'fetch');
    return new Promise((resolve, reject) => {
      config.sync(syncOptions)
        .then(this.parse.bind(this))
        .then((data) => {
          this.add(data);
          this.invokeObservers('sync', 'fetch');
          resolve(this);
        })
        .catch(reject);
    });
  }

  /**
   * Saves every dirty item to the backend.
   * @param {Object} [options] - Options to use during the save operation
   * @returns A single Promise that will resolve after all dirty items were saved.
   */
  save(options = {}) {
    const syncOptions = extendObject({ method: 'PUT' }, options);
    syncOptions.url = this.url(options, 'save');
    const dirtyCollection = this.filter(item => !item.isDirty);
    const cb = (model) => {
      const item = dirtyCollection.remove(model || dirtyCollection.at(0));
      if (!item) return this;
      return item.save(syncOptions).then(cb);
    };
    return Promise.resolve(null).then(cb);
  }
}

export default Collection;
