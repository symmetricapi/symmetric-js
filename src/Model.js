import config from './config';
import Observable from './Observable';
import Cancelable from './Cancelable';
import { decode, encode, isPlainObject, copyObject, extendObject, generateCid } from './utils';
import validate from './validate';

/**
 * Model instances manage a set of attributes exposed through get/set methods.
 * Updates observers with change:<key>, sync:fetch|save|destroy, and validate:true|false
 * @class
 */
class Model extends Observable {
  constructor(data) {
    super();
    this.cid = generateCid();
    this.idAttribute = 'id';
    this.attributes = {};
    this.dirtyAttributes = {};
    this.errors = {};
    this.collection = null;
    extendObject(
      this.attributes,
      this.defaults(),
      (data instanceof Model ? data.attributes : this.parse(data)),
    );
  }

  /** Create a mutable JSON-compatible copy of attributes with values encoded. */
  toJSON() {
    const data = copyObject(this.attributes);
    // Encode anything that should be a string
    Object.keys(data).forEach((key) => {
      const value = data[key];
      if (value && typeof value === 'object') {
        const field = this.field(key);
        if (field && field.encoding && !(field.encoding in config.inputEncodings)) {
          data[key] = encode(value, field.encoding);
        }
      }
    });
    return data;
  }

  /** Create a deep-mutable copy of the attributes. */
  toObject() {
    return copyObject(this.attributes);
  }

  /** Creates a copy of the model without any observers. */
  clone(asNew) {
    const proto = Object.getPrototypeOf(this);
    const model = Object.create(proto);
    model.cid = generateCid();
    model.idAttribute = this.idAttribute;
    model.attributes = copyObject(this.attributes);
    if (asNew) {
      model.unset(model.idAttribute);
    } else {
      model.dirtyAttributes = copyObject(this.dirtyAttributes);
      model.errors = copyObject(this.errors);
      model.collection = this.collection;
    }
    return model;
  }

  get id() {
    return this.attributes[this.idAttribute];
  }

  get isNew() {
    return !(this.idAttribute in this.attributes);
  }

  get isDeleted() {
    return !(this.idAttribute in this.attributes) && (this.idAttribute in this.dirtyAttributes);
  }

  get isDirty() {
    return !!Object.keys(this.dirtyAttributes).length;
  }

  get isValid() {
    return !Object.keys(this.errors).length;
  }

  /**
   * Override this method to return an object to be used as default attributes on a new instance.
   */
  defaults() {}

  /**
   * Override this method to return a field specification object for the attribute.
   * @param {string} key - the attribute to get a field spec for
   */
  field(key) {} // eslint-disable-line no-unused-vars

  fieldProp(key, prop) {
    const field = this.field(key);
    return field && field[prop];
  }
  choices(key) { return this.fieldProp(key, 'choices'); }
  encoding(key) { return this.fieldProp(key, 'encoding'); }
  rule(key) { return this.fieldProp(key, 'rule'); }
  title(key) { return this.fieldProp(key, 'title'); }
  subtitle(key) { return this.fieldProp(key, 'subtitle'); }
  instructions(key) { return this.fieldProp(key, 'instructions'); }

  has(key) {
    if (key === 'id') return this.idAttribute in this.attributes;
    return key in this.attributes;
  }

  get(key) {
    if (key === 'id') return this.id;
    return this.attributes[key];
  }

  set(key, value) {
    if (this.isDeleted) throw new Error('Attempting to modify model after it has been deleted.');
    if (isPlainObject(key)) {
      Object.keys(key).forEach((k) => {
        this.set(k, key[k]);
      });
      return this;
    }
    if (!key || !key.length) return this;
    if (key === 'id' && this.idAttribute !== 'id') return this.set(this.idAttribute, value);
    if (value === undefined) return this.unset(key);
    if (this.attributes[key] !== value) {
      // Save the key as an official dirty value if first time dirty
      if (!this.isNew && key in this.attributes && !(key in this.dirtyAttributes)) {
        this.dirtyAttributes[key] = this.attributes[key];
      }
      this.attributes[key] = value;
      // Remove dirty if reverted
      if (this.dirtyAttributes[key] === value) {
        delete this.dirtyAttributes[key];
      }
      this.invokeObservers('change', key);
      this.validate(true);
    }
    return this;
  }

  unset(key) {
    if (this.isDeleted) throw new Error('Attempting to modify model after it has been deleted.');
    if (key === 'id' && this.idAttribute !== 'id') return this.unset(this.idAttribute);
    delete this.attributes[key];
    this.invokeObservers('change', key);
    this.validate(true);
    return this;
  }

  revert(key) {
    if (key === 'id' && this.idAttribute !== 'id') return this.revert(this.idAttribute);
    if (key in this.dirtyAttributes) {
      return this.set(key, this.dirtyAttributes[key]);
    }
    return this;
  }

  encode(key) {
    return encode(this.attributes[key], this.encoding(key));
  }

  decode(key, value) {
    return this.set(key, decode(value, this.encoding(key)));
  }

  message(key) {
    const error = this.errors[key];
    return (error && config.formatErrorMessage(this.field(key), error, this.attributes[key])) || '';
  }

  validate(debounce) {
    if (debounce) {
      clearTimeout(this._vtid);
      this._vtid = setTimeout(this.validate.bind(this), config.validateTimeout);
      return true;
    }
    this.errors = {};
    Object.keys(this.attributes).forEach((key) => {
      let rule = this.rule(key);
      if (rule) {
        if ((rule.equals === null || rule.equals === undefined) && this.choices(key)) {
          rule = extendObject(rule, { equals: this.choices(key) });
        }
        const error = validate(rule, this.attributes[key]);
        if (error !== true) {
          this.errors[key] = error;
        }
      }
    });
    this.invokeObservers('validate', this.isValid);
    return this.isValid;
  }

  /**
   * Override to return the URL of the model for the given operation.
   * @param {Object} options - options passed to the sync function
   * @param {string} operation - fetch, save, or destroy
   */
  url(options, operation) { // eslint-disable-line no-unused-vars
    if (this.collection) {
      const url = this.collection.url(options, operation);
      if (!this.isNew()) return `${url.replace(/\/$/, '')}/${this.id}`;
      return url;
    }
    return '';
  }

  /**
   * Override to provide custom parsing of data received from the backend or for a new instance.
   * Do not make assumptions about the data being passed.
   * Use this to create specific collections on any sub arrays within a model.
   * @param {Object} data
   */
  parse(data) {
    if (!data) return data;
    // Decode anything that shouldn't be a string
    Object.keys(data).forEach((key) => {
      if (typeof data[key] === 'string') {
        const field = this.field(key);
        if (field && field.encoding && !(field.encoding in config.inputEncodings)) {
          data[key] = decode(data[key], field.encoding); // eslint-disable-line no-param-reassign
        }
      }
    });
    return data;
  }

  _sync(syncOptions, operation) {
    this._cancelable = syncOptions.cancelable || new Cancelable();
    syncOptions.cancelable = this._cancelable; // eslint-disable-line no-param-reassign
    return new Promise((resolve, reject) => {
      config.sync(syncOptions)
        .then(this.parse.bind(this))
        .then((data) => {
          this.set(data);
          // Remove all keys of the request data from dirtyAttributes
          if (syncOptions.data === this) {
            this.dirtyAttributes = {};
          } else if (isPlainObject(syncOptions.data)) {
            Object.keys(syncOptions.data).forEach((key) => {
              delete this.dirtyAttributes[key];
            });
          }
          // Remove all keys of returned results from dirtyAttributes
          Object.keys(data).forEach((key) => {
            delete this.dirtyAttributes[key];
          });
          // Clear the validation timeout
          clearTimeout(this._vtid);
          this.invokeObservers('sync', operation);
          resolve(this);
        })
        .catch(reject);
    });
  }

  fetch(options = {}) {
    const syncOptions = extendObject({ method: 'GET' }, options);
    syncOptions.url = this.url(options, 'fetch');
    return this._sync(syncOptions, 'fetch');
  }

  save(options = {}) {
    const syncOptions = extendObject({ method: this.isNew ? 'POST' : 'PUT' }, options);
    syncOptions.url = this.url(options, 'save');
    // Set request data to the model or dirty attributes only if patching
    if (!syncOptions.data) {
      syncOptions.data = this;
      if (syncOptions.method === 'PATCH') {
        syncOptions.data = {};
        Object.keys(this.dirtyAttributes).forEach((key) => {
          syncOptions.data[key] = this.attributes[key];
        });
      }
    }
    return this._sync(syncOptions, 'save');
  }

  destroy(options = {}) {
    const syncOptions = extendObject({ method: 'DELETE' }, options);
    syncOptions.url = this.url(options, 'destroy');
    this._cancelable = syncOptions.cancelable || new Cancelable();
    syncOptions.cancelable = this._cancelable;
    return new Promise((resolve, reject) => {
      config.sync(syncOptions).then(() => {
        // Set as deleted by unsetting the id
        this.unset(this.idAttribute);
        // Remove the collection if one is set
        if (this.collection) this.collection.remove(this);
        // Clear the validation timeout
        clearTimeout(this._vtid);
        this.invokeObservers('sync', 'destroy');
        resolve(this);
      }).catch(reject);
    });
  }

  cancelSync() {
    if (this._cancelable && this._cancelable.isValid) {
      this._cancelable.cancel();
      this._cancelable = null;
    }
  }
}

export default Model;
