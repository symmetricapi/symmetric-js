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

  /** Set to canceled and invoke the cancel notification. */
  cancel() {
    if (this._canceled) return;
    this._canceled = true;
    this._valid = false;
    this.invokeObservers('cancel');
    this.observers = {};
  }

  /** Set to invalid and invoke the invalidate notification. */
  invalidate() {
    if (!this._valid) return;
    this._valid = false;
    this.invokeObservers('invalidate');
    this.observers = {};
  }
}

export default Cancelable;
