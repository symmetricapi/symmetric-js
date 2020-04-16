require('@babel/register');
// require('whatwg-fetch');
global.fetch = require('node-fetch');

require('./collection');
require('./model');
require('./observable');
require('./serialization');
require('./utils');
require('./validation');

console.log('All tests passed!');
