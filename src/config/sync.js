import CancelError from '../CancelError';
import * as SyncErrorCls from '../SyncError';
import {
  getRoot,
  extendObject,
  prepareUrl,
  isSameOrigin,
  parseLinks,
  toCamelCase,
  camelCaseObject,
  snakeCaseObject,
} from '../utils';

const fetch = getRoot('fetch');
const AbortController = getRoot('AbortController');
const AbortError = getRoot('AbortError');

export const syncConfig = {
  syncCamelCase: true,
  saveSnakeCase: true,
  querySnakeCase: true,
  saveEncoding: 'json',
  csrfCookieName: 'csrftoken',
  csrfHeaderName: 'X-CSRFToken',
  auth: null,
  unwrap: null,
  syncErrorCls: SyncErrorCls,
};

/**
 * Sync function to send or receive information from a backend
 * @param {Object} options - See README for details
 */
export function sync(options) {
  const {
    syncCamelCase = syncConfig.syncCamelCase,
    saveSnakeCase = syncConfig.saveSnakeCase,
    querySnakeCase = syncConfig.querySnakeCase,
    saveEncoding = syncConfig.saveEncoding,
    csrfCookieName = syncConfig.csrfCookieName,
    csrfHeaderName = syncConfig.csrfHeaderName,
    auth = syncConfig.auth,
    unwrap = syncConfig.unwrap,
    syncErrorCls = syncConfig.syncErrorCls,
    meta,
    cancelable,
  } = options;
  const SyncError = syncErrorCls;
  const url = prepareUrl(options.url, options.params, querySnakeCase);
  const headers = extendObject({}, options.headers);
  let { body } = options;
  let signal = null;

  // If url does not include an origin then include csrf tokens
  if (csrfHeaderName && isSameOrigin(options.url)) {
    const document = getRoot('document');
    if (document && document.cookie) {
      const match = new RegExp(`${csrfCookieName}=([^;\\s]*)(?:[;\\s]|$)`).exec(document.cookie);
      if (match) [, headers[csrfHeaderName]] = match;
    }
  }
  // If body is given as data encode it as set in saveEncoding
  if (options.data) {
    const replacer = saveSnakeCase ? (k, v) => snakeCaseObject(v) : null;
    let contentType;
    if (saveEncoding === 'form' || saveEncoding === 'form-json') {
      const formJson = saveEncoding === 'form-json';
      let data = options.data.toJSON();
      if (saveSnakeCase) {
        data = snakeCaseObject(data);
      }
      contentType = 'application/x-www-form-urlencoded';
      body = new FormData();
      Object.keys(data).forEach(key => {
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
  // Prepare the fetch init options and authorization
  const init = extendObject(
    {
      method: 'GET',
      mode: 'same-origin',
      credentials: 'same-origin',
      cache: 'no-cache',
      redirect: 'follow',
      signal,
    },
    options,
    { url, headers, body },
  );
  if (auth) {
    auth.prepare(init, { saveEncoding, saveSnakeCase, querySnakeCase });
  }

  return fetch(init.url, init)
    .then(response => {
      // Detect if there is no AbortController, but the fetch was canceled anyways
      if (cancelable && cancelable.isCanceled) {
        throw new CancelError();
      } else if (!response.ok) {
        throw new SyncError(response);
      }
      // Save all Link and X-Headers to the meta model
      if (meta) {
        response.headers.forEach((value, key) => {
          if (key === 'Link') {
            meta.set('links', parseLinks(value));
          } else if (key[1] === '-' && key[0].toLowerCase() === 'x') {
            const snakeCaseKey = key.substr(2).replace(/-/g, '_');
            meta.set(syncCamelCase ? toCamelCase(snakeCaseKey) : snakeCaseKey, value);
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
    .then(data => (unwrap ? unwrap(data, meta) : data))
    .catch(err => {
      if (err && AbortError && err instanceof AbortError) {
        throw new CancelError();
      }
      throw err;
    });
}
