/**
 * Set of encoding functions used for translating model data to user inputs or JSON.
 * date: yyyy-MM-dd
 * time: hh:mm
 * datetime-local: yyyy-MM-ddThh:mm:ss
 */
export const encoders = {
  date: value => value.toISOString().substr(0, 10),
  time: value => value.toISOString().substr(11, 5),
  datetime: value => value.toISOString(),
  'datetime-local': value => value.toISOString().substr(0, 19),
};

/**
 * Set of decoding functions used for translating user inputs or JSON data to model data.
 */
export const decoders = {
  number: value => Number(value),
  int: value => parseInt(value, 10),
  float: value => parseFloat(value),
  date: value => new Date(value),
  time: value => new Date(`1970-01-01T${value}`),
  datetime: value => new Date(value),
  'datetime-local': value => new Date(value),
};

/**
 * Set of encoding types which are to be used ONLY for translating user input not JSON.
 */
export const inputEncodings = {
  number: true,
  int: true,
  float: true,
};
