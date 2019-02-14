import config from './config';
import Observable from './Observable';
import Cancelable from './Cancelable';
import { decode, encode, isPlainObject, copyObject, extendObject, generateCid } from './utils';
import validate from './validate';

/**
 * Model instances manage a set of attributes exposed through get/set methods.
 * Updates observers with the following:
 * change:<key>, request|sync|error:fetch|save|destroy, and validate:true|false
 * @param {Object|Model} [data] - Initial values to set the model's attributes
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
    this.autoValidate = config.autoValidate;
    extendObject(
      this.attributes,
      this.defaults(),
      data instanceof Model ? data.attributes : this.parse(data),
    );
  }

  /** Create a mutable JSON-compatible copy of attributes with values encoded. */
  toJSON() {
    const data = copyObject(this.attributes);
    // Encode anything that should be a string
    Object.keys(data).forEach(key => {
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

  /** @member */
  get id() {
    return this.attributes[this.idAttribute];
  }

  /** @member {Boolean} */
  get isNew() {
    return !(this.idAttribute in this.attributes);
  }

  /** @member {Boolean} */
  get isDeleted() {
    return !(this.idAttribute in this.attributes) && this.idAttribute in this.dirtyAttributes;
  }

  /** @member {Boolean} */
  get isDirty() {
    return !!Object.keys(this.dirtyAttributes).length;
  }

  /** @member {Boolean} */
  get isValid() {
    return !Object.keys(this.errors).length;
  }

  /** Override to return an object to be used as default attributes on a new instance. */
  defaults() {}

  /**
   * Override to return a field specification object for the attribute.
   * @param {string} key - the attribute to get a field spec for
   */
  field(key) {} // eslint-disable-line no-unused-vars

  fieldProp(key, prop) {
    const field = this.field(key);
    return field && field[prop];
  }
  choices(key) {
    return this.fieldProp(key, 'choices');
  }
  encoding(key) {
    return this.fieldProp(key, 'encoding');
  }
  rule(key) {
    return this.fieldProp(key, 'rule');
  }
  title(key) {
    return this.fieldProp(key, 'title');
  }
  subtitle(key) {
    return this.fieldProp(key, 'subtitle');
  }
  instructions(key) {
    return this.fieldProp(key, 'instructions');
  }

  /**
   * Returns true if the attribute key can be found in this model.
   * @param {string} key - The key to check
   */
  has(key) {
    if (key === 'id') return this.idAttribute in this.attributes;
    return key in this.attributes;
  }

  /**
   * Returns the value of the attribute key or undefined if not present.
   * @param {string} key - The key to get
   */
  get(key) {
    if (key === 'id') return this.id;
    return this.attributes[key];
  }

  _setValidateTimeout() {
    const ms = this.autoValidate;
    clearTimeout(this._vtid);
    if (ms !== -1) {
      if (ms) this._vtid = setTimeout(this.validate.bind(this), ms);
      else this.validate();
    }
  }

  /**
   * Sets a value of the attribute key.
   * Invokes change notification and validates the model after setting.
   * @param {string|Object} key - The key to set or an plain object of key/values
   * @param {*} value - The value of the attribute or undefined to unset() the key
   */
  set(key, value) {
    if (this.isDeleted) throw new Error('Attempting to modify model after it has been deleted.');
    if (isPlainObject(key)) {
      Object.keys(key).forEach(k => {
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
      this._setValidateTimeout();
    }
    return this;
  }

  /**
   * Remove the given attribute completely from the model.
   * @param {string} key - The attribute key to remove
   */
  unset(key) {
    if (this.isDeleted) throw new Error('Attempting to modify model after it has been deleted.');
    if (key === 'id' && this.idAttribute !== 'id') return this.unset(this.idAttribute);
    delete this.attributes[key];
    this.invokeObservers('change', key);
    this._setValidateTimeout();
    return this;
  }

  /**
   * Undo any changes made to an attribute back to the original synced value.
   * @param {string} key - The attribute key to revert
   */
  revert(key) {
    if (key === 'id' && this.idAttribute !== 'id') return this.revert(this.idAttribute);
    if (key in this.dirtyAttributes) {
      return this.set(key, this.dirtyAttributes[key]);
    }
    return this;
  }

  /**
   * Encode an attribute into a string form.
   * @param {string} key - The attribute key to encode
   */
  encode(key) {
    return encode(this.attributes[key], this.encoding(key));
  }

  /**
   * Decode a string value into a native Javascript value.
   * @param {string} key - The attribute key to set with the decoded value
   * @param {string} value - The value to decode
   */
  decode(key, value) {
    return this.set(key, decode(value, this.encoding(key)));
  }

  /**
   * Format an validation error into a readable string.
   * @param {*} key - The attribute key
   */
  message(key) {
    const error = this.errors[key];
    return (error && config.formatErrorMessage(this.field(key), error, this.attributes[key])) || '';
  }

  /**
   * Returns true if the key has a validation error.
   * @param {*} key - The attribute key
   */
  hasError(key) {
    return !!this.errors[key];
  }

  /**
   * Validate each attribute according to their rules.
   * Override to do custom validation before calling super with an errors object.
   * @param {Object} [errors] - A plain object of attribute keyed errors
   * @returns true if the model is valid with no errors
   */
  validate(errors) {
    this.errors = extendObject({}, errors);
    Object.keys(this.attributes).forEach(key => {
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
  url(options, operation) {
    if (options.url) return options.url;
    if (this.collection) {
      const url = this.collection.url(options, operation);
      if (!this.isNew()) return `${url.replace(/\/$/, '')}/${this.id}`;
      return url;
    }
    return '';
  }

  /**
   * Override this to set shared options for subclassed models before calling config.sync().
   * Be sure to call super unless using a different sync backend.
   * @param {Object} [options] - options to pass to the sync function
   * @returns A Promise that will resolve with this model instance
   */
  sync(options) {
    return config.sync(options);
  }

  /**
   * Override to provide custom parsing of data received from the backend or for a new instance.
   * Also override to create specific models/collections on any sub-objects/arrays.
   * Do not make assumptions about the data being passed.
   * Remember to call super as the base implementation decodes any string values that need decoding.
   * @param {Object} data
   * @returns The parsed data
   */
  parse(data) {
    if (!data) return data;
    // Decode anything that shouldn't be a string
    Object.keys(data).forEach(key => {
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
      this.invokeObservers('request', operation);
      this.sync(syncOptions)
        .then(this.parse.bind(this))
        .then(data => {
          this.set(data);
          // Remove all keys of the request data from dirtyAttributes
          if (syncOptions.data === this) {
            this.dirtyAttributes = {};
          } else if (isPlainObject(syncOptions.data)) {
            Object.keys(syncOptions.data).forEach(key => {
              delete this.dirtyAttributes[key];
            });
          }
          // Remove all keys of returned results from dirtyAttributes
          Object.keys(data).forEach(key => {
            delete this.dirtyAttributes[key];
          });
          // Clear the validation timeout
          clearTimeout(this._vtid);
          this.invokeObservers('sync', operation);
          resolve(this);
        })
        .catch(err => {
          this.invokeObservers('error', operation);
          reject(err);
        });
    });
  }

  /**
   * Get and set attributes from the backend via the sync function.
   * @param {Object} [options] - options to pass to the sync function
   * @returns A Promise that will resolve with this model instance
   */
  fetch(options = {}) {
    const syncOptions = extendObject({ method: 'GET' }, options);
    syncOptions.url = this.url(options, 'fetch');
    return this._sync(syncOptions, 'fetch');
  }

  /**
   * Sent the model attributes to the backend to be saved.
   * If options.method === 'PATCH' then only the dirtyAttributes will be synced.
   * @param {Object} [options] - options to pass to the sync function
   * @returns A Promise that will resolve with this model instance
   */
  save(options = {}) {
    const syncOptions = extendObject({ method: this.isNew ? 'POST' : 'PUT' }, options);
    syncOptions.url = this.url(options, 'save');
    // Set request data to the model or dirty attributes only if patching
    if (!syncOptions.data) {
      syncOptions.data = this;
      if (syncOptions.method === 'PATCH') {
        syncOptions.data = {};
        Object.keys(this.dirtyAttributes).forEach(key => {
          syncOptions.data[key] = this.attributes[key];
        });
      }
    }
    return this._sync(syncOptions, 'save');
  }

  /**
   * Delete the model from the backend by using the DELETE method.
   * The model will become readonly after the deletion.
   * @param {Object} [options] - options to pass to the sync function
   * @returns A Promise that will resolve with this model instance
   */
  destroy(options = {}) {
    const syncOptions = extendObject({ method: 'DELETE' }, options);
    syncOptions.url = this.url(options, 'destroy');
    this._cancelable = syncOptions.cancelable || new Cancelable();
    syncOptions.cancelable = this._cancelable;
    return new Promise((resolve, reject) => {
      this.invokeObservers('request', 'destroy');
      this.sync(syncOptions)
        .then(() => {
          // Set as deleted by unsetting the id
          this.unset(this.idAttribute);
          // Remove the collection if one is set
          if (this.collection) this.collection.remove(this);
          // Clear the validation timeout
          clearTimeout(this._vtid);
          this.invokeObservers('sync', 'destroy');
          resolve(this);
        })
        .catch(err => {
          this.invokeObservers('error', 'destroy');
          reject(err);
        });
    });
  }

  /** Cancel the current sync operation (fetch, save, or destroy). */
  cancelSync() {
    if (this._cancelable && this._cancelable.isValid) {
      this._cancelable.cancel();
      this._cancelable = null;
    }
  }

  /**
   * Create a new model and fetch it.
   * @param {string} url - the url to fetch
   * @param {Object} [options] - options to pass to the sync function
   * @returns A Promise that will later resolve to the new model
   */
  static fetch(url, options = {}) {
    const model = new Model();
    model.url = () => url;
    return model.fetch(options);
  }
}

export default Model;
