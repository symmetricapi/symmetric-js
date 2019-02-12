import config from './config';
import Model from './Model';

export default function validate(rule, value) {
  if (!rule) return true;
  const { required, type, format, equals, min, max } = rule;
  if (value === null || (value === '' && type === 'string')) {
    return required ? 'required' : true;
  }
  if (
    (type === 'string' && typeof value !== 'string') ||
    (type === 'date' && !(value instanceof Date)) ||
    (type === 'int' && !(+value === value && value % 1 === 0)) ||
    (type === 'float' && typeof value !== 'number') ||
    (type === 'bool' && typeof value !== 'boolean') ||
    (type === 'array' && !Array.isArray(value)) ||
    (type === 'model' && !(value instanceof Model))
  ) {
    return 'type';
  }
  if (equals !== null && equals !== undefined) {
    if (Array.isArray(equals)) {
      if (equals.indexOf(value) === -1) {
        return 'equals';
      }
    } else if (typeof equals === 'object') {
      if (equals[value] === undefined) {
        return 'equals';
      }
    } else if (value !== equals) {
      return 'equals';
    }
  } else if (type === 'string') {
    if (min && value.length < min) return 'min';
    if (max && value.length > max) return 'max';
    if (format) {
      const formats = Array.isArray(format) ? format : [format];
      for (let frmt, i = 0; i < formats.length; i += 1) {
        frmt = formats[i];
        if (typeof frmt === 'string') {
          frmt = config.formats[frmt];
        }
        if (
          (typeof frmt === 'function' && !frmt(value)) ||
          (frmt instanceof RegExp && !frmt.test(value))
        ) {
          return 'format';
        }
      }
    }
  } else {
    if (min && value < min) return 'min';
    if (max && value > max) return 'max';
  }
  return true;
}
