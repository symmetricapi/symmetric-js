/* eslint no-param-reassign: 0 */

/**
 * Observable is a base class for both Model and Collection.
 * It manages observers and dispatches events to them.
 * @class
 */
class Observable {
  constructor() {
    this.observers = {};
  }

  toJSON() {
    return {};
  }

  /**
   * Call each observer listening to the action and action:path combination.
   * @param {string} action - The action that took place.
   * @param {string} [path] - Optional path which describes where the action that took place.
   */
  invokeObservers(action, path) {
    const observers = this.observers[action];
    if (observers) {
      observers.forEach(observer => {
        observer(this, action, path);
      });
    }
    if (path) {
      const pathObservers = this.observers[`${action}:${path}`];
      if (pathObservers) {
        pathObservers.forEach(observer => {
          observer(this, action, path);
        });
      }
    }
  }

  /**
   * Add a observer to listen for action or action:path combination.
   * @param {string} action - The action to listen for.
   * @param {string} [path] - Optional path to only listen for actions originating with path.
   * @param {function} observer - Required callback that takes (observable, action, path) args.
   */
  addObserver(action, path, observer) {
    if (typeof path === 'function') {
      observer = path;
      path = null;
    }
    const key = path ? `${action}:${path}` : action;
    this.observers[key] = this.observers[key] || [];
    this.observers[key].push(observer);
  }

  /**
   * Remove a observer from listening to an action or action:path combination.
   * @param {string} action - Same action used from the addObserver call.
   * @param {Object} [path] - Same path used from the addObserver call.
   * @param {function} observer - Same observer used from the addObserver call.
   */
  removeObserver(action, path, observer) {
    if (typeof path === 'function') {
      observer = path;
      path = null;
    }
    const key = path ? `${action}:${path}` : action;
    const observers = this.observers[key];
    if (observers && observers.length) {
      for (let i = observers.length - 1; i >= 0; i -= 1) {
        if (observers[i] === observer) {
          observers.splice(i, 1);
        }
      }
    }
  }

  /**
   * Run a one or more synchronous operations without invoking any observers.
   * @param {function} callback - A function that takes the Observable as an argument.
   */
  runSilent(callback) {
    const current = this.observers;
    this.observers = {};
    callback(this);
    this.observers = current;
  }
}

export default Observable;
