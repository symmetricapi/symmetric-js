import config from './config';
import Model from './Model';
import Observable from './Observable';
import Cancelable from './Cancelable';
import { extendObject, generateCid, getAttr } from './utils';

/**
 * Collection is manages an array of items (Model instances).
 * Updates observers with the following:
 * add|remove:<cid>, reset, request|sync|error:fetch|save, and sort
 * @param {Array|Collection} [items] - An array or collection of items to initialy add
 * @class
 */
class Collection extends Observable {
  constructor(items) {
    super();
    this.cid = generateCid();
    this.comparator = this.comparator || null;
    this.items = [];
    this.meta = new Model();
    this.add(Array.isArray(items) ? this.parse(items) : items);
  }

  /** Create a mutable JSON-compatible copy of the items array. */
  toJSON() {
    return Array.from(this.items);
  }

  /** Create a mutable copy of the items array. */
  toArray() {
    return Array.from(this.items);
  }

  /**
   * Creates a copy of the collection without any of the observers.
   * @param {Object|Number} [args] - args to filter or slice begin index on the cloned items
   * @param {Number} [end] - slice end index on the cloned items
   */
  clone(args, end) {
    const proto = Object.getPrototypeOf(this);
    const c = Object.create(proto);
    c.observers = {};
    c.cid = generateCid();
    c.items = typeof args === 'number' ? this.slice(args, end) : this.filter(args || (() => true));
    c.meta = this.meta ? this.meta.clone() : null;
    c.comparator = this.comparator;
    c.sort(c.comparator);
    return c;
  }

  /** @member {Number} */
  get length() {
    return this.items.length;
  }

  /** @member {Boolean} */
  get isEmpty() {
    return !this.items.length;
  }

  /** @member {Boolean} */
  get isSyncing() {
    return !(this._cancelable && this._cancelable.isValid);
  }

  /**
   * Add an item or items to the collection.
   * Invokes an "add" notification and sorts the new array if comparator is set.
   * @param {Model|Collection|Array} items - One or more models to add to items
   * @param {Boolean} [unshift] - If true add as the first item
   */
  add(items, unshift) {
    if (!items) return this;
    if (items instanceof Collection) return this.add(items.items);
    if (Array.isArray(items)) {
      // Add each item individually but wait until the end to autosort
      const { comparator } = this;
      this.comparator = null;
      (unshift ? items.reverse() : items).forEach(item => {
        this.add(item, unshift);
      });
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
   * Invokes a "remove" notification and sorts the new array if comparator is set.
   * @param {Model|string|Array|Function} items - model, cid, array of models/cids, or a filter func
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
      items.forEach(item => {
        removed.push(this.remove(item));
      });
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
    this.items.forEach(item => {
      item.collection = null;
    });
    this.items = [];
    this.invokeObservers('reset');
  }

  /**
   * Returns an array of the collection with items filtered.
   * @param {Object|Function} args - the args or callback to use e.g. () => {} or {id: 12.. params}
   */
  filter(args) {
    let callback = args;
    if (typeof callback !== 'function') {
      const keys = Object.keys(args);
      callback = item => {
        // Allow each arg to be a value or regex
        for (let arg, key, value, i = 0; i < keys.length; i += 1) {
          key = keys[i];
          value = key === 'id' ? item.id : item.get(key);
          arg = args[key];
          // eslint-disable-next-line eqeqeq
          if ((arg instanceof RegExp && !arg.test(value)) || arg != value) return false;
        }
        return true;
      };
    }
    return this.items.filter(callback);
  }

  /**
   * Slice the collection into an array, same as the Array.slice function
   * @param {Number} [begin] - same as Array.slice
   * @param {Number} [end] - same as Array.slice
   */
  slice(begin, end) {
    return this.items.slice(begin, end);
  }

  /** Returns true if there is an item matching the filter args. */
  has(args) {
    if (args instanceof Model) return args.collection === this;
    return this.filter(args).length > 0;
  }

  /** Returns the first item matching the filter args. */
  find(args) {
    return this.filter(args)[0];
  }

  /**
   * Get the item at a 0-based index.
   * @param {Number} index - The index
   */
  at(index) {
    return this.items[index];
  }

  /**
   * Get an item by id.
   * @param {Number|Model} id - The id or model to get by id
   */
  get(id) {
    return this.find({ id: id instanceof Model ? id.id : id });
  }

  /**
   * Call a function for each item in the colleciton.
   * @param {Function} callback - The function to call
   */
  forEach(callback) {
    this.items.forEach(callback);
  }

  /**
   * Map items in the collection.
   * @param {Function} callback  - The function to call
   */
  map(callback, thisArg) {
    return this.items.map(callback, thisArg);
  }

  /**
   * Sort the items in place. When sorting using an attribute key a "-" prefix means descending.
   * @param {Function|string} comparator - A comparator function or attribute key
   */
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
        if (valueA < valueB) return -1;
        else if (valueB < valueA) return 1;
        return 0;
      };
    }
    this.items.sort(fun);
    if (reverse) {
      this.items = this.items.reverse();
    }
    this.invokeObservers('sort');
  }

  /* eslint-disable no-unused-vars */

  /**
   * Override to return the model class necessary to make a new instance with.
   * @param {Object} item - raw attribute data yet to be put into a model
   * @returns {class}
   */
  model(item) {
    return Model;
  }

  /**
   * Override to return the URL of the collection.
   * @param {Object} options - options passed to the sync function
   * @param {string} operation - fetch, save, or destroy
   */
  url(options, operation) {
    if (options.url) return options.url;
    return '';
  }

  /* eslint-enable no-unused-vars */

  /**
   * Override this to set shared options for subclassed collections before calling config.sync().
   * Be sure to call super unless using a different sync backend.
   * @param {Object} [options] - options to pass to the sync function
   * @returns A Promise that will resolve with this collection instance
   */
  sync(options) {
    return config.sync(options);
  }

  /**
   * Override to provide custom parsing of data received from the backend or for a new instance.
   * Do not make assumptions about the data being passed.
   * @param {Array} data
   * @returns An array of parsed data
   */
  parse(data) {
    if (!Array.isArray(data)) return data;
    // Convert each item to a model if not already
    return data.map(item => {
      if (item instanceof Model) return item;
      const ModelCls = this.model(item);
      return new ModelCls(item);
    });
  }

  /**
   * Loads the collection from the backend and merges into any existing items already present.
   * @param {Object} [options] - options to pass to the sync function
   * @returns A Promise that will resolve with this collection instance
   */
  fetch(options = {}) {
    const syncOptions = extendObject({ method: 'GET', meta: this.meta }, options);
    syncOptions.url = this.url(options, 'fetch');
    this._cancelable = syncOptions.cancelable || new Cancelable();
    syncOptions.cancelable = this._cancelable;
    return new Promise((resolve, reject) => {
      this.invokeObservers('request', 'fetch');
      this.sync(syncOptions)
        .then(this.parse.bind(this))
        .then(data => {
          if (options.reset) this.reset();
          this.add(data);
          this.invokeObservers('sync', 'fetch');
          resolve(this);
        })
        .catch(err => {
          this.invokeObservers('error', 'fetch');
          reject(err);
        });
    });
  }

  /**
   * Saves every dirty item to the backend.
   * @param {Object} [options] - options to pass to the sync function
   * @returns A Promise that will resolve with this collection after all dirty items were saved.
   */
  save(options = {}) {
    const syncOptions = extendObject({ method: 'PUT' }, options);
    syncOptions.url = this.url(options, 'save');
    this._cancelable = syncOptions.cancelable || new Cancelable();
    syncOptions.cancelable = this._cancelable;
    const dirtyCollection = this.filter(item => !item.isDirty);
    this.invokeObservers('request', 'fetch');
    return Promise.all(dirtyCollection.forEach(item => item.save(syncOptions)))
      .then(() => {
        this.invokeObservers('sync', 'fetch');
        return this;
      })
      .catch(err => {
        this.invokeObservers('error', 'fetch');
        throw err;
      });
  }

  /** Cancel the current sync operation (fetch or save). */
  cancelSync() {
    if (this._cancelable && this._cancelable.isValid) {
      this._cancelable.cancel();
      this._cancelable = null;
    }
  }

  /**
   * Create a new collection and fetch it.
   * @param {string} url - the url to fetch
   * @param {Object} [options] - options to pass to the sync function
   * @returns A Promise that will later resolve to the new collection
   */
  static fetch(url, options) {
    const collection = new Collection();
    collection.url = () => url;
    return collection.fetch(options);
  }
}

export default Collection;
