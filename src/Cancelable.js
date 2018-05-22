import Observable from './Observable';

/**
 * Cancelable instances manage a single cancelable action.
 * Updates observers with cancel or invalidate events
 * @class
 */
class Cancelable extends Observable {
  constructor() {
    super();
    this._canceled = false;
    this._valid = true;
  }

  get isCanceled() {
    return this._canceled;
  }

  get isValid() {
    return this._valid;
  }

  cancel() {
    this._canceled = true;
    this._valid = false;
    this.invokeObservers('cancel');
    this.observers = {};
  }

  invalidate() {
    this._valid = false;
    this.invokeObservers('invalidate');
    this.observers = {};
  }
}

export default Cancelable;
