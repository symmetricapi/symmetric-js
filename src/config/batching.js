import { extendObject, extractRelativeUrl, getRoot } from '../utils';

const Response = getRoot('Response');

const encodeHeaders = headers => Object.keys(headers).map(name => ({ name, value: headers[name] }));
const decodeHeaders = headers => extendObject({}, ...headers.map(h => ({ [h.name]: h.value })));

/**
 * Convert an array of fetch init objects into a single batched fetch init
 * The backend will receive an array of requests in the form of:
 * {
 * body - the body text
 * headers - array of objects with {name, value} pairs
 * method - http method
 * relative_url - the url with the origin removed
 * }
 */
export function batch(inits) {
  // Start with a copy of the options (that should be the same for all) from the first init
  const combined = extendObject({}, inits[0]);
  // Not used or available for a combined request
  delete combined.body;
  delete combined.params;
  delete combined.headers;
  delete combined.meta;
  delete combined.cancelable;
  // Overridden outside this method after combining
  delete combined.method;
  delete combined.url;
  delete combined.batchTimeout;
  delete combined.batchUrl;
  // Create an array of request data to be encoded in sync()
  combined.data = inits.map(init => ({
    body: init.body,
    headers: encodeHeaders(init.headers || {}),
    method: init.method,
    relativeUrl: extractRelativeUrl(init.url),
  }));
  return combined;
}

/**
 * Provide a single Promise that when resolved will have converted
 * a single Response object to many Response objects based on the body
 *
 * The expected format from the server is an request-ordered array
 * with each of the response objects containing:
 * {
 * body - the response body text
 * headers - array of objects with {name, value} pairs
 * code - http status code
 * message - optional status text
 * }
 */
export function unbatch(batchResponse, inits) {
  const decoder = (res, i) => {
    const { url } = inits[i];
    if (!res) return new Response('', { status: 204, url });
    res.headers = decodeHeaders(res.headers || []);
    res.url = url;
    res.status = res.code;
    res.statusText = res.message;
    return new Response(res.body, res);
  };
  return batchResponse.json().then(data => data.map(decoder));
}
