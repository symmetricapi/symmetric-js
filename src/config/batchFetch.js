import { batch, unbatch } from './batching';
import { sync } from './sync';
import { extractOrigin, getRoot, extendObject } from '../utils';
import CancelError from '../CancelError';

const fetch = getRoot('fetch');
const queues = {};

function batchSync(url) {
  // Remove any canceled requests
  const queue = queues[url].filter(init => {
    if (init.cancelable && init.cancelable.isCanceled) {
      init._reject(new CancelError());
      return false;
    }
    return true;
  });
  if (!queue.length) return;
  // Peform the actual batched sync
  const combined = extendObject(batch(queue), {
    _batched: true,
    method: 'POST',
    saveArrayName: 'batch',
    batchTimeout: 0,
    batchUrl: url,
    url,
  });
  // Sync with terminated then/catch handlers
  // after each sync Promise will be resolved when sync calls batchFetch
  sync(combined).then(() => {}, () => {});
}

export default function batchFetch(url, init, timeout) {
  // If this was a batched request started by the timeout then inject a then to process the response
  if (init._batched) {
    return fetch(init.url, init).then(response => {
      // unbatch, then resolve each Promise to be handled by sync() logic
      if (response.ok) {
        const queue = queues[url];
        unbatch(response, queue).then(responses => {
          responses.forEach((res, i) => queue[i]._resolve(res));
          queues[url] = [];
        });
      }
      // Skip the normal sync then() handlers and stop silently in batchSync
      throw new Error();
    });
  }

  // If the batchUrl origin don't match the init origin then just fetch immediately
  if (extractOrigin(init.url) !== extractOrigin(url)) return fetch(init.url, init);

  // Add to the queue
  return new Promise((resolve, reject) => {
    const queue = queues[url] || [];
    init._resolve = resolve;
    init._reject = reject;
    queue.push(init);
    // Start the timeout if needed
    if (!queue._tid) queue._tid = setTimeout(batchSync, timeout, url);
  });
}
