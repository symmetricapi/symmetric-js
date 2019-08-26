import batchFetch from './batchFetch';
import CancelError from '../CancelError';
import * as SyncErrorCls from '../SyncError';
import {
  getRoot,
  getData,
  extendObject,
  prepareUrl,
  isSameOrigin,
  parseLinks,
  toCamelCase,
  camelCaseObject,
  snakeCaseObject,
} from '../utils';
import { deserialize } from '../serialization';

const fetch = getRoot('fetch');
const AbortController = getRoot('AbortController');
const AbortError = getRoot('AbortError');

export const syncConfig = {
  syncCamelCase: true,
  saveSnakeCase: true,
  querySnakeCase: true,
  saveEncoding: 'json',
  saveArrayName: 'data',
  csrfCookieName: 'csrftoken',
  csrfHeaderName: 'X-CSRFToken',
  requestedWith: 'XMLHttpRequest',
  batchTimeout: -1,
  batchUrl: '/',
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
    saveArrayName = syncConfig.saveArrayName,
    csrfCookieName = syncConfig.csrfCookieName,
    csrfHeaderName = syncConfig.csrfHeaderName,
    requestedWith = syncConfig.requestedWith,
    batchTimeout = syncConfig.batchTimeout,
    batchUrl = syncConfig.batchUrl,
    auth = syncConfig.auth,
    unwrap = syncConfig.unwrap,
    syncErrorCls = syncConfig.syncErrorCls,
    meta,
    cancelable,
  } = options;
  const SyncError = syncErrorCls;
  const url = prepareUrl(options.url, getData(options.params), querySnakeCase);
  const headers = extendObject({ 'X-Requested-With': requestedWith }, options.headers);
  let { body } = options;
  let signal = null;

  // If url does not include an origin then include csrf tokens
  if (csrfHeaderName && isSameOrigin(url)) {
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
      let data = getData(options.data);
      if (Array.isArray(data)) data = { [saveArrayName]: data };
      if (saveSnakeCase) data = snakeCaseObject(data);
      contentType = 'application/x-www-form-urlencoded';
      body = Object.keys(data)
        .map(
          key =>
            `${key}=${encodeURIComponent(
              formJson ? JSON.stringify(data[key], replacer) : data[key],
            )}`,
        )
        .join('&');
    } else {
      contentType = 'application/json';
      body = JSON.stringify(options.data, replacer);
    }
    if (!headers['Content-Type']) {
      headers['Content-Type'] = contentType;
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

  return (batchTimeout === -1 ? fetch(init.url, init) : batchFetch(batchUrl, init, batchTimeout))
    .then(response => {
      // Detect if there is no AbortController, but the fetch was canceled anyways
      if (cancelable && cancelable.isCanceled) {
        throw new CancelError();
      } else if (!response.ok) {
        throw new SyncError(response);
      }
      // Invalidate the cancelable
      if (cancelable) cancelable.invalidate();
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
      return response.text();
    })
    .then(response => JSON.parse(response, syncCamelCase ? (k, v) => camelCaseObject(v) : null))
    .then(data => (unwrap ? unwrap(data, meta) : data))
    .then(data => (meta.get('mixed') ? deserialize(data) : data))
    .catch(err => {
      // Invalidate the cancelable
      if (cancelable) cancelable.invalidate();
      // Throw a CancelError if needed
      if (err && AbortError && err instanceof AbortError) {
        throw new CancelError();
      }
      throw err;
    });
}
