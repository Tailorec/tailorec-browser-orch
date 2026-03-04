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
} from './optional.type.js';
export {
  type Result,
  ok,
  err,
  mapResult,
  mapErrorResult,
  unwrapResult,
  andThenResult,
  resultToValue,
} from './result.type.js';
