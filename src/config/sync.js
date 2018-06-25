import CancelError from '../CancelError';
import { getRoot, extendObject, prepareUrl, isSameOrigin, toCamelCase, camelCaseObject, underscoreObject } from '../utils';

const fetch = getRoot('fetch');
const AbortController = getRoot('AbortController');
const AbortError = getRoot('AbortError');

export const syncConfig = {
  syncCamelCase: true,
  saveUnderscore: true,
  queryUnderscore: true,
  saveEncoding: 'json',
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
    saveEncoding = syncConfig.saveEncoding,
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
  // If body is given as data encode it as set in saveEncoding
  if (options.data) {
    const replacer = (saveUnderscore ? (k, v) => underscoreObject(v) : null);
    let contentType;
    if (saveEncoding === 'form' || saveEncoding === 'form-json') {
      const formJson = (saveEncoding === 'form-json');
      let data = options.data.toJSON();
      if (saveUnderscore) {
        data = underscoreObject(data);
      }
      contentType = 'application/x-www-form-urlencoded';
      body = new FormData();
      Object.keys(data).forEach((key) => {
        body.set(key, formJson ? JSON.stringify(data[key], replacer) : data[key]);
      });
    } else {
      contentType = 'application/json';
      body = JSON.stringify(options.data, replacer);
    }
    if (!headers['content-type']) {
      headers['content-type'] = contentType;
    }
  }
  // If cancelable object is set then create an AbortController if possible
  if (cancelable && AbortController) {
    const controller = new AbortController();
    ({ signal } = controller);
    cancelable.addObserver('cancel', controller.abort);
  }
  // Prepare the fetch options
  const init = extendObject({
    method: 'GET',
    mode: 'same-origin',
    credentials: 'same-origin',
    cache: 'no-cache',
    redirect: 'follow',
    signal,
  }, options, { url, headers, body });

  return fetch(url, init)
    .then((response) => {
      // Detect if there is no AbortController, but the fetch was canceled anyways
      if (cancelable && cancelable.isCanceled) {
        return Promise.reject(new CancelError());
      } else if (!response.ok) {
        return Promise.reject(response);
      }
      // Save all X-Headers to the xheaders model
      if (xheaders) {
        response.headers.forEach((value, key) => {
          if (key[1] === '-' && key[0].toLowerCase() === 'x') {
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
    .then(response => JSON.parse(response, syncCamelCase ? (k, v) => camelCaseObject(v) : null))
    .catch((err) => {
      if (err && AbortError && err instanceof AbortError) {
        throw new CancelError();
      }
      throw err;
    });
}
