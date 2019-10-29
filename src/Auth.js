/* eslint no-param-reassign: 0 */
import Model from './Model';
import { prepareUrl, snakeCaseObject, extendObject } from './utils';

/**
 * A basic Auth model that implements apikey and OAuth2 request preparing.
 * @class
 */
class Auth extends Model {
  defaults() {
    return { authType: 'bearer' };
  }

  /** Return a possibly different origin given a url. */
  // eslint-disable-next-line no-unused-vars
  origin(url) {
    return '';
  }

  /**
   * Given a credentials model, login using with OAuth2 username password grant
   * credentials - A model that should provide username/password fields.
   * options - provide a url here or implement a url() in an Auth subclass
   */
  login(credentials, options = {}) {
    credentials.set('grantType', 'password');
    const syncOptions = extendObject(
      { method: 'POST', saveEncoding: 'form', data: credentials },
      options,
    );
    let url = this.url(syncOptions, 'fetch');
    const origin = this.origin(url);
    if (origin && url.indexOf('://') === -1) {
      url = `${origin}${url}`;
    }
    syncOptions.url = url;
    return this._sync(syncOptions, 'fetch');
  }

  /**
   * Prepare a request with non-cookie-based authorization credentials.
   * @description
   * An attribute of authType must be set in this model to be one of:
   * apikey - just a key to add to the query string of each request taken from apikey attribute
   * bearer - set the authorization: bearer header with the accessToken attribute
   * token - combine the accessToken attribute with the existing request data
   * none - no auth, just update the requests with a common origin
   * @param {Object} request - complete options that will be passed into fetch()
   * @param {Object} options - sync encoding options: saveEncoding, saveSnakeCase, querySnakeCase
   */
  prepare(request, options) {
    const authType = this.get('authType');
    const { saveEncoding, saveSnakeCase, querySnakeCase } = options;
    const origin = this.origin(request.url);

    if (origin && request.url.indexOf('://') === -1) {
      request.url = `${origin}${request.url}`;
    }

    if (authType === 'apikey') {
      request.url = prepareUrl(request.url, { apikey: this.get('apikey') }, querySnakeCase);
    } else if (authType === 'bearer') {
      request.headers.authorization = `Bearer ${this.get('accessToken')}`;
    } else if (authType === 'token') {
      if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'DELETE') {
        // Insert the token into the query string
        request.url = prepareUrl(
          request.url,
          { accessToken: this.get('accessToken') },
          querySnakeCase,
        );
      } else {
        const replacer = saveSnakeCase ? (k, v) => snakeCaseObject(v) : null;
        const jsonData = JSON.stringify({ accessToken: this.get('accessToken') }, replacer);
        if (saveEncoding === 'json') {
          if (!request.body) {
            // Body is missing so just set to JSON with accessToken
            request.body = jsonData;
          } else {
            // Insert the accessToken as the last key of the existing JSON object
            const bodyPrefix = request.body.substr(0, request.body.length - 1);
            const bodySuffix = jsonData.substr(1);
            request.body = `${bodyPrefix},${bodySuffix}`;
          }
        } else if (saveEncoding === 'form' || saveEncoding === 'form-json') {
          let formToken = this.get('accessToken');
          if (saveEncoding === 'form-json') {
            formToken = JSON.stringify(formToken);
          }
          request.body = request.body || new FormData();
          request.body.set(saveSnakeCase ? 'access_token' : 'accessToken', formToken);
        }
      }
    }
  }
}

export default Auth;
