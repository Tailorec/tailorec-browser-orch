// Errors
export {
  DomainError,
  ValidationError,
  InvalidInputError,
  BrowserError,
  ElementNotFoundError,
  TimeoutError,
  StaleElementError,
  BrowserNotAvailableError,
} from './errors/index.js';

// Types
export {
  type Optional,
  some,
  none,
  mapOptional,
  getOrElse,
  toNullable,
  toUndefined,
  isPresent,
  isAbsent,
} from './types/index.js';

export {
  type Result,
  ok,
  err,
  mapResult,
  mapErrorResult,
  unwrapResult,
  andThenResult,
  resultToValue,
} from './types/index.js';

// Utils
export {
  toCamelCase,
  toSnakeCase,
  toKebabCase,
  truncate,
  redactSensitiveData,
  randomString,
  escapeRegExp,
  isBlank,
  isNotBlank,
} from './utils/index.js';

export {
  clamp,
  parseNumber,
  formatBytes,
  percentage,
  roundTo,
  inRange,
  lerp,
  mapRange,
} from './utils/index.js';

export {
  sleep,
  withTimeout,
  retry,
  debounce,
  throttle,
} from './utils/index.js';

export {
  deepClone,
  pick,
  omit,
  isEmpty,
  isNotEmpty,
  deepMerge,
  getNestedValue,
  setNestedValue,
} from './utils/index.js';
