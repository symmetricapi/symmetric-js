import { encoders, decoders, inputEncodings } from './encoding';
import formats from './formats';
import formatErrorMessage from './messages';
import { sync, syncConfig } from './sync';

export default {
  Component: Object,
  h: () => {},
  encoders,
  decoders,
  inputEncodings,
  formats,
  formatErrorMessage,
  sync,
  syncConfig,
  validateTimeout: 500,
};
