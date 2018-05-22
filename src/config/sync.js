import CancelError from '../CancelError';
import { getRoot, extendObject, prepareUrl, isSameOrigin, isPlainObject, toCamelCase, camelCaseObject, underscoreObject } from '../utils';

const fetch = getRoot('fetch');
const AbortController = getRoot('AbortController');
const AbortError = getRoot('AbortError');

export function camelCaseReviver(key, value) {
  if (isPlainObject(value)) return camelCaseObject(value);
  return value;
}

export function underscoreReplacer(key, value) {
  if (isPlainObject(value)) return underscoreObject(value);
  return value;
}

export const syncConfig = {
  syncCamelCase: true,
  saveUnderscore: true,
  queryUnderscore: true,
  csrfCookieName: 'csrftoken',
  csrfHeaderName: 'X-CSRFToken',
};

/**
 * Sync function to send or receive information from a backend
 * @param {Object} options - See README for details
 */
export function sync(options) {
  const {
    syncCamelCase = syncConfig.syncCamelCase,
    saveUnderscore = syncConfig.saveUnderscore,
    queryUnderscore = syncConfig.queryUnderscore,
    csrfCookieName = syncConfig.csrfCookieName,
    csrfHeaderName = syncConfig.csrfHeaderName,
    xheaders,
    cancelable,
  } = options;
  const url = prepareUrl(options.url, options.params, queryUnderscore);
  const headers = extendObject({}, options.headers);
  let { body } = options;
  let signal = null;

  // If url does not include an origin then include csrf tokens
  if (csrfHeaderName && isSameOrigin(options.url)) {
    const document = getRoot('document');
    if (document && document.cookie) {
      const match = (new RegExp(`${csrfCookieName}=([^;\\s]*)(?:[;\\s]|$)`)).exec(document.cookie);
      if (match) [, headers[csrfHeaderName]] = match;
    }
  }
  // If body is given as data convert it to JSON and force the Content-Type header
  if (options.data) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.data, (saveUnderscore ? underscoreReplacer : null));
  }
  // If cancelable object is set then create an AbortController if possible
  if (cancelable && AbortController) {
    const controller = new AbortController();
    ({ signal } = controller);
    cancelable.addObserver('cancel', controller.abort);
  }
  return fetch(url, extendObject({
    method: 'GET',
    mode: 'same-origin',
    credentials: 'same-origin',
    cache: 'no-cache',
    redirect: 'follow',
  }, options, { headers, body, signal }))
    .then((response) => {
      // Detect if there is no AbortController, but the fetch was canceled anyways
      if (cancelable && cancelable.isCanceled) {
        return Promise.reject(new CancelError('Canceled'));
      } else if (!response.ok) {
        return Promise.reject(response);
      }
      // Save all X-Headers to the xheaders model
      if (xheaders) {
        response.headers.forEach((value, key) => {
          if (key[0] === 'X' && key[1] === '-') {
            const underscoreKey = key.substr(2).replace(/-/g, '_');
            xheaders.set(syncCamelCase ? toCamelCase(underscoreKey) : underscoreKey, value);
          }
        });
      }
      // Invalidate the cancelable
      if (cancelable) {
        cancelable.invalidate();
      }
      return response.text();
    })
    .then(response => JSON.parse(response, syncCamelCase ? camelCaseReviver : null))
    .catch((err) => {
      if (err && AbortError && err instanceof AbortError) {
        throw new CancelError('Canceled');
      }
      throw err;
    });
}
