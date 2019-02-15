import { batch, unbatch } from './batching';
import { encoders, decoders, inputEncodings } from './encoding';
import formats from './formats';
import formatErrorMessage from './messages';
import { sync, syncConfig } from './sync';

export default {
  autoValidate: -1,
  encoders,
  decoders,
  inputEncodings,
  formats,
  formatErrorMessage,
  batch,
  unbatch,
  sync,
  syncConfig,
};
