/**
 * @since 4.0.0
 */

import type * as Option from "../data/Option.ts"
import type * as Effect from "../Effect.ts"
import type * as AST from "./AST.ts"
import * as Getter from "./Getter.ts"
import type * as Issue from "./Issue.ts"

/**
 * @category model
 * @since 4.0.0
 */
export class Middleware<in out T, in out E, RD1, RD2, RE1, RE2> {
  readonly _tag = "Middleware"
  readonly decode: (
    sr: Effect.Effect<Option.Option<E>, Issue.Issue, RD1>,
    options: AST.ParseOptions
  ) => Effect.Effect<Option.Option<T>, Issue.Issue, RD2>
  readonly encode: (
    sr: Effect.Effect<Option.Option<T>, Issue.Issue, RE1>,
    options: AST.ParseOptions
  ) => Effect.Effect<Option.Option<E>, Issue.Issue, RE2>

  constructor(
    decode: (
      sr: Effect.Effect<Option.Option<E>, Issue.Issue, RD1>,
      options: AST.ParseOptions
    ) => Effect.Effect<Option.Option<T>, Issue.Issue, RD2>,
    encode: (
      sr: Effect.Effect<Option.Option<T>, Issue.Issue, RE1>,
      options: AST.ParseOptions
    ) => Effect.Effect<Option.Option<E>, Issue.Issue, RE2>
  ) {
    this.decode = decode
    this.encode = encode
  }
  flip(): Middleware<E, T, RE1, RE2, RD1, RD2> {
    return new Middleware(this.encode, this.decode)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class Transformation<in out T, in out E, RD = never, RE = never> {
  readonly _tag = "Transformation"
  readonly decode: Getter.Getter<T, E, RD>
  readonly encode: Getter.Getter<E, T, RE>

  constructor(
    decode: Getter.Getter<T, E, RD>,
    encode: Getter.Getter<E, T, RE>
  ) {
    this.decode = decode
    this.encode = encode
  }
  flip(): Transformation<E, T, RE, RD> {
    return new Transformation(this.encode, this.decode)
  }
  compose<T2, RD2, RE2>(other: Transformation<T2, T, RD2, RE2>): Transformation<T2, E, RD | RD2, RE | RE2> {
    return new Transformation(
      this.decode.compose(other.decode),
      other.encode.compose(this.encode)
    )
  }
}

/**
 * @since 4.0.0
 */
export const make = <T, E, RD = never, RE = never>(options: {
  readonly decode: Getter.Getter<T, E, RD>
  readonly encode: Getter.Getter<E, T, RE>
}): Transformation<T, E, RD, RE> => {
  if (options instanceof Transformation) {
    return options
  }
  return new Transformation(options.decode, options.encode)
}

/**
 * @since 4.0.0
 */
export function transformOrFail<T, E, RD = never, RE = never>(options: {
  readonly decode: (e: E, options: AST.ParseOptions) => Effect.Effect<T, Issue.Issue, RD>
  readonly encode: (t: T, options: AST.ParseOptions) => Effect.Effect<E, Issue.Issue, RE>
}): Transformation<T, E, RD, RE> {
  return new Transformation(
    Getter.mapOrFail(options.decode),
    Getter.mapOrFail(options.encode)
  )
}

/**
 * @since 4.0.0
 */
export function transform<T, E>(options: {
  readonly decode: (input: E) => T
  readonly encode: (input: T) => E
}): Transformation<T, E> {
  return new Transformation(
    Getter.map(options.decode),
    Getter.map(options.encode)
  )
}

/**
 * @since 4.0.0
 */
export function transformOptional<T, E>(options: {
  readonly decode: (input: Option.Option<E>) => Option.Option<T>
  readonly encode: (input: Option.Option<T>) => Option.Option<E>
}): Transformation<T, E> {
  return new Transformation(
    Getter.mapOptional(options.decode),
    Getter.mapOptional(options.encode)
  )
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function trim(): Transformation<string, string> {
  return new Transformation(
    Getter.trim(),
    Getter.passthrough()
  )
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function snakeToCamel(): Transformation<string, string> {
  return new Transformation(
    Getter.snakeToCamel(),
    Getter.camelToSnake()
  )
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toLowerCase(): Transformation<string, string> {
  return new Transformation(
    Getter.toLowerCase(),
    Getter.passthrough()
  )
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toUpperCase(): Transformation<string, string> {
  return new Transformation(
    Getter.toUpperCase(),
    Getter.passthrough()
  )
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function capitalize(): Transformation<string, string> {
  return new Transformation(
    Getter.capitalize(),
    Getter.passthrough()
  )
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function uncapitalize(): Transformation<string, string> {
  return new Transformation(
    Getter.uncapitalize(),
    Getter.passthrough()
  )
}

/**
 * @since 4.0.0
 */
export interface JsonOptions extends Getter.ParseJsonOptions, Getter.StringifyJsonOptions {}

/**
 * A transformation that parses a JSON string into an unknown value and
 * stringifies an unknown value into a JSON string.
 *
 * @category String transformations
 * @since 4.0.0
 */
export function unknownFromJsonString(options?: JsonOptions): Transformation<unknown, string> {
  return new Transformation(
    Getter.parseJson({ options }),
    Getter.stringifyJson({ options })
  )
}

const passthrough_ = new Transformation(
  Getter.passthrough<any>(),
  Getter.passthrough<any>()
)

/**
 * @since 4.0.0
 */
export function passthrough<T, E>(options: { readonly strict: false }): Transformation<T, E>
export function passthrough<T>(): Transformation<T, T>
export function passthrough<T>(): Transformation<T, T> {
  return passthrough_
}

/**
 * @since 4.0.0
 */
export function passthroughSupertype<T extends E, E>(): Transformation<T, E>
export function passthroughSupertype<T>(): Transformation<T, T> {
  return passthrough_
}

/**
 * @since 4.0.0
 */
export function passthroughSubtype<T, E extends T>(): Transformation<T, E>
export function passthroughSubtype<T>(): Transformation<T, T> {
  return passthrough_
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export const numberFromString = new Transformation(
  Getter.Number(),
  Getter.String()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const bigintFromString = new Transformation(
  Getter.BigInt(),
  Getter.String()
)
