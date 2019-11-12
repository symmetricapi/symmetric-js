## About

Symmetric provides observable model and collection classes with support for field specifications that mirror backend sources with encoding functions and validation rules.

## Requirements

The built-in sync function requires a fetch compatible function on window/self/ or global.

- https://github.com/github/fetch
- https://github.com/bitinn/node-fetch
- https://github.com/matthew-andrews/isomorphic-fetch

**NOTE:** When using create-react-app, fetch is already included. No need to add an additional dependency.

## Configuration

- `autoValidate` - auto validate model rules after X ms from a change - use -1 (default) to disable or 0 to run immediate
- `encoders` - dictionary of encoding (converting to a string) functions keyed by types
- `decoders` - dictionary of decoding (converting from a string) functions keyed by types
- `inputEncodings` - dictionary of field types that are be used ONLY with encoding/decoding user input
- `formats` - dictionary of field types to RegExp objects or functions that return a boolean
- `formatErrorMessage` - function to format errors
- `batch` - function to convert an array of fetch init objects into a single batched fetch init
- `unbatch` - function to convert a single Response object to many Response objects
- `sync` - function that wraps the call to `fetch()`
- `syncConfig` - additional settings for the built-in sync function, see sync below

## sync function

Basic options are:

- `url` - required url to fetch
- `params` - will be added to url as query string args
- `data` - will set body with `JSON.stringify(data)` and `Content-Type` to `application/json`
- `auth` - any authorization object that implements a `prepare(request, opts)` function
- `meta` - provide an object here to receive with `meta.set(key, value)` the `Link` and `X-Headers` from the response as well as any meta data from unwrapping

Standard fetch options are:

https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch

- `method` - defaults to 'GET'
- `headers` - a dictionary of http headers to use, if setting 'Content-Type' note it is case-sensitive to avoid conflicts
- `body` - the body of the request
- `mode` - defaults to 'same-origin'
- `credentials` - defaults to 'same-origin'
- `cache` - defaults to 'no-cache'
- `redirect` - defaults to 'follow'

Additional options with defaults provided by `config.syncConfig` are:

- `syncCamelCase` - converts responses to camelCase keys before parsing. defaults to true
- `saveSnakeCase` - defaults to true
- `querySnakeCase` - defaults to true
- `saveEncoding` - one of the following strings `json`, `form`, or `form-json`, defaults to `json`
- `saveArrayName` - when `saveEncoding` is `form` or `form-json`, the form name to use when data is just an array
- `csrfCookieName` - defaults to `csrftoken`
- `csrfHeaderName` - defaults to `X-CSRFToken`
- `requestedWith` - value of the `X-Requested-With` header, defaults to `XMLHttpRequest`
- `batchTimeout` - will queue requests that happen within this timeframe into a single request, -1 (default) to disable or >= 0 to enable
- `batchUrl` - the backend url that accepts batched requests
- `auth` - an optional single auth object to use for all sync operations, defaults to null
- `unwrap` - function to unwrap and enveloped response and return the extracted data `unwrap(data, meta) => unwrapped`, defaults to null
- `errorFactory` - receives a Response object and should throw an error or return a Promise that will eventually throw an error
- `errorHandler` - a callback to globally handle errors before they are thrown to the next Promise rejection handler

## Subclassing

### Model

- `toJSON()` - return data for JSON stringification. The base method will encode each field
- `defaults()` - return an object of default values for the fields when creating a new instance
- `field(key)` - return the field specification for the given attribute key
- `url(options, operation)` - return the url to use with the fetch, save, or delete
- `parse(data)` - The base method will decode all fields that are a string and have an encoding type

### Collection

The following methods should be implemented on subclasses:

- `model(attrs)` - return a model class used to construct with the given attributes
- `url(options, operation)` - return the url to use with the fetch or save
- `parse(data)` - parse raw data from a fetch. The base method converts each item into models using the `model()` method.

### Parsing

The base behavior of the `parse()` method on the model class is to decode any string values that have a specified encoding. The base behavior of the `parse()` method on the collection class is to pass each item in the data array to a model class constructor and create model instances inside the returned array. This is where the `model()` method is used.

When subclassing and providing custom parsing it is a good idea to call the base method and use the data it returns.

### Field Specifications

Each field can specify one or more of the following:

- `choices` - an array of valid choices the value must match
- `encoding` - type of encoding to use, keys will match up to config `encoders` and `decoders`
- `rule` - the validation rule, see below
- `title` - title of an input for this field
- `subtitle` - subtitle of an input for this field
- `instructions` - string of instructions to present to the user for how to enter a value. Will be returned by `formatErrorMessage()` if set

### Validation Rules

Each rule is a dictionary with one or more of the following:

- `required` - if true, then the value may not be null or an empty string
- `type` - checks to make sure that the value is properly decoded as this type
- `format` - key into config formats to choose a RegExp or function to check
- `equals` - value should exactly equal this or if an array match one of the values
- `min` - values needs to pass a > test with this or the length must be longer than this if a string
- `max` - values needs to pass a < test with this or the length must be less than this if a string

## Serialization

`serialize` and `deserialize` Functions are provided to make it easier for storing and retrieving already loaded models and collections to and from local or session storage.

## License

MIT
