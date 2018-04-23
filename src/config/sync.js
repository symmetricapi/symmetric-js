import { getRoot, extendObject, prepareUrl, isSameOrigin, isPlainObject, camelCaseObject, underscoreObject } from '../utils';

const fetch = getRoot('fetch');

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
  } = options;
  const url = prepareUrl(options.url, options.params, queryUnderscore);
  const headers = extendObject({}, options.headers);
  let { body } = options;

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
  return fetch(url, extendObject({
    method: 'GET',
    mode: 'same-origin',
    credentials: 'same-origin',
    cache: 'no-cache',
    redirect: 'follow',
  }, options, { headers, body }))
    .then(response => response.text())
    .then(response => JSON.parse(response, syncCamelCase ? camelCaseReviver : null));
  // TODO: grab next page and other headers before response.text
}
