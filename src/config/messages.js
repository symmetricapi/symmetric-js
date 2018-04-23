export default function formatErrorMessage({ instructions, rule, title = 'This field' }, error, value) { // eslint-disable-line no-unused-vars
  if (error === 'format' && instructions) return instructions;
  const len = rule.type === 'string' ? 'The length of ' : '';
  const chars = rule.type === 'string' ? ' characters' : '';
  switch (error) {
    case 'required':
      return `${title} is required`;
    case 'min':
      return `${len}${title} must be greater than or equal to ${rule.min}${chars}`;
    case 'max':
      return `${len}${title} must be less than or equal to ${rule.max}${chars}`;
    case 'format':
      if (typeof rule.format === 'string') {
        return `${title} is not a valid ${rule.format}`;
      }
      break;
    default:
      break;
  }
  return `${title} is not valid`;
}
