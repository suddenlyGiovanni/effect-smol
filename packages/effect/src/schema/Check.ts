/**
 * @since 4.0.0
 */

import * as Arr from "../collections/Array.ts"
import type { Brand } from "../data/Brand.ts"
import type * as Equivalence from "../data/Equivalence.ts"
import * as Option from "../data/Option.ts"
import * as Order from "../data/Order.ts"
import * as Predicate from "../data/Predicate.ts"
import { formatUnknown, PipeableClass } from "../internal/schema/util.ts"
import * as Num from "../primitives/Number.ts"
import type * as Annotations from "./Annotations.ts"
import type * as AST from "./AST.ts"
import * as Issue from "./Issue.ts"

/**
 * @category model
 * @since 4.0.0
 */
export class Filter<in E> extends PipeableClass implements Annotations.Annotated {
  readonly _tag = "Filter"
  readonly run: (input: E, self: AST.AST, options: AST.ParseOptions) => Issue.Issue | undefined
  readonly annotations: Annotations.Filter | undefined
  /**
   * Whether the parsing process should be aborted after this check has failed.
   */
  readonly abort: boolean

  constructor(
    run: (input: E, self: AST.AST, options: AST.ParseOptions) => Issue.Issue | undefined,
    annotations: Annotations.Filter | undefined = undefined,
    /**
     * Whether the parsing process should be aborted after this check has failed.
     */
    abort: boolean = false
  ) {
    super()
    this.run = run
    this.annotations = annotations
    this.abort = abort
  }
  annotate(annotations: Annotations.Filter): Filter<E> {
    return new Filter(this.run, { ...this.annotations, ...annotations }, this.abort)
  }
  and<T extends E>(other: Refine<T, E>, annotations?: Annotations.Filter): RefinementGroup<T, E>
  and(other: Check<E>, annotations?: Annotations.Filter): FilterGroup<E>
  and(other: Check<E>, annotations?: Annotations.Filter): FilterGroup<E> {
    return new FilterGroup([this, other], annotations)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class FilterGroup<in E> extends PipeableClass implements Annotations.Annotated {
  readonly _tag = "FilterGroup"
  readonly checks: readonly [Check<E>, Check<E>, ...ReadonlyArray<Check<E>>]
  readonly annotations: Annotations.Filter | undefined

  constructor(
    checks: readonly [Check<E>, Check<E>, ...ReadonlyArray<Check<E>>],
    annotations: Annotations.Filter | undefined = undefined
  ) {
    super()
    this.checks = checks
    this.annotations = annotations
  }
  annotate(annotations: Annotations.Filter): FilterGroup<E> {
    return new FilterGroup(this.checks, { ...this.annotations, ...annotations })
  }
  and<T extends E>(other: Refine<T, E>, annotations?: Annotations.Filter): RefinementGroup<T, E>
  and(other: Check<E>, annotations?: Annotations.Filter): FilterGroup<E>
  and(other: Check<E>, annotations?: Annotations.Filter): FilterGroup<E> {
    return new FilterGroup([this, other], annotations)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export type Check<T> = Filter<T> | FilterGroup<T>

/**
 * @category model
 * @since 4.0.0
 */
export interface Refinement<out T extends E, in E> extends Filter<E> {
  readonly Type: T
  annotate(annotations: Annotations.Filter): Refinement<T, E>
  and<T2 extends E2, E2>(
    other: Refine<T2, E2>,
    annotations?: Annotations.Filter
  ): RefinementGroup<T & T2, E & E2>
  and(other: Check<E>, annotations?: Annotations.Filter): RefinementGroup<T, E>
}

/**
 * @category model
 * @since 4.0.0
 */
export interface RefinementGroup<T extends E, E> extends FilterGroup<E> {
  readonly Type: T
  annotate(annotations: Annotations.Filter): RefinementGroup<T, E>
  and<T2 extends E2, E2>(
    other: Refine<T2, E2>,
    annotations?: Annotations.Filter
  ): RefinementGroup<T & T2, E & E2>
  and(other: Check<E>, annotations?: Annotations.Filter): RefinementGroup<T, E>
}

/**
 * @category model
 * @since 4.0.0
 */
export type Refine<T extends E, E> = Refinement<T, E> | RefinementGroup<T, E>

/** @internal */
export function makeGuard<T extends E, E>(
  is: (value: E) => value is T,
  annotations?: Annotations.Filter
): Refinement<T, E> {
  return new Filter(
    (input: E, ast) => is(input) ? undefined : new Issue.InvalidType(ast, Option.some(input)),
    annotations,
    true // after a guard, we always want to abort
  ) as any
}

/** @internal */
export const BRAND_KEY = "~brand.type"

/** @internal */
export function getBrand<T>(check: Check<T>): string | symbol | undefined {
  const brand = check.annotations?.[BRAND_KEY]
  if (Predicate.isString(brand) || Predicate.isSymbol(brand)) {
    return brand
  }
}

const baseBrand = makeGuard((u): u is any => true)

/** @internal */
export function makeBrand<B extends string | symbol, T>(
  brand: B,
  annotations?: Annotations.Filter
): Refinement<T & Brand<B>, T> {
  return baseBrand.annotate({ ...annotations, [BRAND_KEY]: brand })
}

/**
 * @since 4.0.0
 */
export function guard<T extends E, E>(
  is: (value: E) => value is T,
  annotations?: Annotations.Filter
) {
  return (self: Check<E>): RefinementGroup<T, E> => {
    return self.and(makeGuard(is, annotations))
  }
}

/**
 * @since 4.0.0
 */
export function brand<B extends string | symbol>(brand: B, annotations?: Annotations.Filter) {
  return <T>(self: Check<T>): RefinementGroup<T & Brand<B>, T> => {
    return self.and(makeBrand(brand, annotations))
  }
}

/** @internal */
export function makeIssue(
  input: unknown,
  out: undefined | boolean | string | Issue.Issue | {
    readonly path: ReadonlyArray<PropertyKey>
    readonly message: string
  }
) {
  if (Issue.isIssue(out)) {
    return out
  }
  if (out === undefined) {
    return undefined
  }
  if (Predicate.isBoolean(out)) {
    return out ? undefined : new Issue.InvalidValue(Option.some(input))
  }
  if (Predicate.isString(out)) {
    return new Issue.InvalidValue(Option.some(input), { message: out })
  }
  return new Issue.Pointer(
    out.path,
    new Issue.InvalidValue(Option.some(input), { message: out.message })
  )
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function make<T>(
  filter: (
    input: T,
    ast: AST.AST,
    options: AST.ParseOptions
  ) => undefined | boolean | string | Issue.Issue | {
    readonly path: ReadonlyArray<PropertyKey>
    readonly message: string
  },
  annotations?: Annotations.Filter | undefined,
  abort: boolean = false
): Filter<T> {
  return new Filter(
    (input, ast, options) => makeIssue(input, filter(input, ast, options)),
    annotations,
    abort
  )
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function makeGroup<T>(
  checks: readonly [Check<T>, Check<T>, ...ReadonlyArray<Check<T>>],
  annotations: Annotations.Filter | undefined = undefined
): FilterGroup<T> {
  return new FilterGroup(checks, annotations)
}

/**
 * @since 4.0.0
 */
export function abort<T>(filter: Filter<T>): Filter<T> {
  return new Filter(filter.run, filter.annotations, true)
}

const TRIMMED_PATTERN = "^\\S[\\s\\S]*\\S$|^\\S$|^$"

/**
 * @category String checks
 * @since 4.0.0
 */
export function trimmed(annotations?: Annotations.Filter) {
  return make((s: string) => s.trim() === s, {
    title: "trimmed",
    description: "a string with no leading or trailing whitespace",
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        pattern: TRIMMED_PATTERN
      })
    },
    meta: {
      _tag: "trimmed"
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "StringConstraints",
        patterns: [TRIMMED_PATTERN]
      }
    },
    ...annotations
  })
}

/**
 * @category String checks
 * @since 4.0.0
 */
export function regex(regex: RegExp, annotations?: Annotations.Filter) {
  if (process.env.NODE_ENV !== "production") {
    if (regex.flags !== "") {
      throw new Error("regex flags are not supported")
    }
  }
  const source = regex.source
  return make((s: string) => regex.test(s), {
    title: `regex(${source})`,
    description: `a string matching the pattern ${source}`,
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        pattern: regex.source
      })
    },
    meta: {
      _tag: "regex",
      regex
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "StringConstraints",
        patterns: [regex.source]
      }
    },
    ...annotations
  })
}

/**
 * Returns a regex for validating an RFC 4122 UUID.
 *
 * Optionally specify a version 1-8. If no version is specified, all versions are supported.
 */
const getUUIDRegex = (version?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8): RegExp => {
  if (version) {
    return new RegExp(
      `^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`
    )
  }
  return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000)$/
}

/**
 * Universally Unique Identifier (UUID)
 *
 * To specify a particular UUID version, pass the version number as an argument.
 *
 * @category String checks
 * @since 4.0.0
 */
export function uuid(version?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) {
  return regex(getUUIDRegex(version), {
    title: "uuid"
  })
}

/**
 * @category String checks
 * @since 4.0.0
 */
export function ulid(annotations?: Annotations.Filter) {
  return regex(/^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/, {
    title: "ulid",
    ...annotations
  })
}

/**
 * @category String checks
 * @since 4.0.0
 */
export function base64(annotations?: Annotations.Filter) {
  return regex(/^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/, {
    title: "base64",
    ...annotations
  })
}

/**
 * @category String checks
 * @since 4.0.0
 */
export function base64url(annotations?: Annotations.Filter) {
  return regex(/^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/, {
    title: "base64url",
    ...annotations
  })
}

/**
 * @category String checks
 * @since 4.0.0
 */
export function startsWith(startsWith: string, annotations?: Annotations.Filter) {
  const formatted = JSON.stringify(startsWith)
  return make((s: string) => s.startsWith(startsWith), {
    title: `startsWith(${formatted})`,
    description: `a string starting with ${formatted}`,
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        pattern: `^${startsWith}`
      })
    },
    meta: {
      _tag: "startsWith",
      startsWith
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "StringConstraints",
        patterns: [`^${startsWith}`]
      }
    },
    ...annotations
  })
}

/**
 * @category String checks
 * @since 4.0.0
 */
export function endsWith(endsWith: string, annotations?: Annotations.Filter) {
  const formatted = JSON.stringify(endsWith)
  return make((s: string) => s.endsWith(endsWith), {
    title: `endsWith(${formatted})`,
    description: `a string ending with ${formatted}`,
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        pattern: `${endsWith}$`
      })
    },
    meta: {
      _tag: "endsWith",
      endsWith
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "StringConstraints",
        patterns: [`${endsWith}$`]
      }
    },
    ...annotations
  })
}

/**
 * @category String checks
 * @since 4.0.0
 */
export function includes(includes: string, annotations?: Annotations.Filter) {
  const formatted = JSON.stringify(includes)
  return make((s: string) => s.includes(includes), {
    title: `includes(${formatted})`,
    description: `a string including ${formatted}`,
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        pattern: includes
      })
    },
    meta: {
      _tag: "includes",
      includes
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "StringConstraints",
        patterns: [includes]
      }
    },
    ...annotations
  })
}

const UPPERCASED_PATTERN = "^[^a-z]*$"

/**
 * @category String checks
 * @since 4.0.0
 */
export function uppercased(annotations?: Annotations.Filter) {
  return make((s: string) => s.toUpperCase() === s, {
    title: "uppercased",
    description: "a string with all characters in uppercase",
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        pattern: UPPERCASED_PATTERN
      })
    },
    meta: {
      _tag: "uppercased"
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "StringConstraints",
        patterns: [UPPERCASED_PATTERN]
      }
    },
    ...annotations
  })
}

const LOWERCASED_PATTERN = "^[^A-Z]*$"

/**
 * @category String checks
 * @since 4.0.0
 */
export function lowercased(annotations?: Annotations.Filter) {
  return make((s: string) => s.toLowerCase() === s, {
    title: "lowercased",
    description: "a string with all characters in lowercase",
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        pattern: LOWERCASED_PATTERN
      })
    },
    meta: {
      _tag: "lowercased"
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "StringConstraints",
        patterns: [LOWERCASED_PATTERN]
      }
    },
    ...annotations
  })
}

const CAPITALIZED_PATTERN = "^[^a-z]?.*$"

/**
 * Verifies that a string is capitalized.
 *
 * @category String checks
 * @since 4.0.0
 */
export function capitalized(annotations?: Annotations.Filter) {
  return make((s: string) => s.charAt(0).toUpperCase() === s.charAt(0), {
    title: "capitalized",
    description: "a string with the first character in uppercase",
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        pattern: CAPITALIZED_PATTERN
      })
    },
    meta: {
      _tag: "capitalized"
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "StringConstraints",
        patterns: [CAPITALIZED_PATTERN]
      }
    },
    ...annotations
  })
}

const UNCAPITALIZED_PATTERN = "^[^A-Z]?.*$"

/**
 * Verifies that a string is uncapitalized.
 *
 * @category String checks
 * @since 4.0.0
 */
export function uncapitalized(annotations?: Annotations.Filter) {
  return make((s: string) => s.charAt(0).toLowerCase() === s.charAt(0), {
    title: "uncapitalized",
    description: "a string with the first character in lowercase",
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        pattern: UNCAPITALIZED_PATTERN
      })
    },
    meta: {
      _tag: "uncapitalized"
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "StringConstraints",
        patterns: [UNCAPITALIZED_PATTERN]
      }
    },
    ...annotations
  })
}

/**
 * @category Number checks
 * @since 4.0.0
 */
export function finite(annotations?: Annotations.Filter) {
  return make((n: number) => Number.isFinite(n), {
    title: "finite",
    description: "a finite number",
    meta: {
      _tag: "finite"
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "NumberConstraints",
        noDefaultInfinity: true,
        noNaN: true
      }
    },
    ...annotations
  })
}

/**
 * @category Order checks
 * @since 4.0.0
 */
export function deriveGreaterThan<T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((exclusiveMinimum: T) => Annotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) {
  const greaterThan = Order.greaterThan(options.order)
  const format = options.format ?? formatUnknown
  return (exclusiveMinimum: T, annotations?: Annotations.Filter) => {
    return make<T>((input) => greaterThan(input, exclusiveMinimum), {
      title: `greaterThan(${format(exclusiveMinimum)})`,
      description: `a value greater than ${format(exclusiveMinimum)}`,
      ...options.annotate?.(exclusiveMinimum),
      ...annotations
    })
  }
}

/**
 * @category Order checks
 * @since 4.0.0
 */
export function deriveGreaterThanOrEqualTo<T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((exclusiveMinimum: T) => Annotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) {
  const greaterThanOrEqualTo = Order.greaterThanOrEqualTo(options.order)
  const format = options.format ?? formatUnknown
  return (minimum: T, annotations?: Annotations.Filter) => {
    return make<T>((input) => greaterThanOrEqualTo(input, minimum), {
      title: `greaterThanOrEqualTo(${format(minimum)})`,
      description: `a value greater than or equal to ${format(minimum)}`,
      ...options.annotate?.(minimum),
      ...annotations
    })
  }
}

/**
 * @category Order checks
 * @since 4.0.0
 */
export function deriveLessThan<T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((exclusiveMaximum: T) => Annotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) {
  const lessThan = Order.lessThan(options.order)
  const format = options.format ?? formatUnknown
  return (exclusiveMaximum: T, annotations?: Annotations.Filter) => {
    return make<T>((input) => lessThan(input, exclusiveMaximum), {
      title: `lessThan(${format(exclusiveMaximum)})`,
      description: `a value less than ${format(exclusiveMaximum)}`,
      ...options.annotate?.(exclusiveMaximum),
      ...annotations
    })
  }
}

/**
 * @category Order checks
 * @since 4.0.0
 */
export function deriveLessThanOrEqualTo<T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((exclusiveMaximum: T) => Annotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) {
  const lessThanOrEqualTo = Order.lessThanOrEqualTo(options.order)
  const format = options.format ?? formatUnknown
  return (maximum: T, annotations?: Annotations.Filter) => {
    return make<T>((input) => lessThanOrEqualTo(input, maximum), {
      title: `lessThanOrEqualTo(${format(maximum)})`,
      description: `a value less than or equal to ${format(maximum)}`,
      ...options.annotate?.(maximum),
      ...annotations
    })
  }
}

/**
 * @category Order checks
 * @since 4.0.0
 */
export function deriveBetween<T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((minimum: T, maximum: T) => Annotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) {
  const greaterThanOrEqualTo = Order.greaterThanOrEqualTo(options.order)
  const lessThanOrEqualTo = Order.lessThanOrEqualTo(options.order)
  const format = options.format ?? formatUnknown
  return (minimum: T, maximum: T, annotations?: Annotations.Filter) => {
    return make<T>((input) => greaterThanOrEqualTo(input, minimum) && lessThanOrEqualTo(input, maximum), {
      title: `between(${format(minimum)}, ${format(maximum)})`,
      description: `a value between ${format(minimum)} and ${format(maximum)}`,
      ...options.annotate?.(minimum, maximum),
      ...annotations
    })
  }
}

/**
 * @category Numeric checks
 * @since 4.0.0
 */
export function deriveMultipleOf<T>(options: {
  readonly remainder: (input: T, divisor: T) => T
  readonly zero: NoInfer<T>
  readonly annotate?: ((divisor: T) => Annotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) {
  return (divisor: T, annotations?: Annotations.Filter) => {
    const format = options.format ?? formatUnknown
    return make<T>((input) => options.remainder(input, divisor) === options.zero, {
      title: `multipleOf(${format(divisor)})`,
      description: `a value that is a multiple of ${format(divisor)}`,
      ...options.annotate?.(divisor),
      ...annotations
    })
  }
}

/**
 * @category Number checks
 * @since 4.0.0
 */
export const greaterThan = deriveGreaterThan({
  order: Order.number,
  annotate: (exclusiveMinimum) => ({
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        exclusiveMinimum
      })
    },
    meta: {
      _tag: "greaterThan",
      exclusiveMinimum
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "NumberConstraints",
        min: exclusiveMinimum,
        minExcluded: true
      }
    }
  })
})

/**
 * @category Number checks
 * @since 4.0.0
 */
export const greaterThanOrEqualTo = deriveGreaterThanOrEqualTo({
  order: Order.number,
  annotate: (minimum) => ({
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        minimum
      })
    },
    meta: {
      _tag: "greaterThanOrEqualTo",
      minimum
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "NumberConstraints",
        min: minimum
      }
    }
  })
})

/**
 * @category Number checks
 * @since 4.0.0
 */
export const lessThan = deriveLessThan({
  order: Order.number,
  annotate: (exclusiveMaximum) => ({
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        exclusiveMaximum
      })
    },
    meta: {
      _tag: "lessThan",
      exclusiveMaximum
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "NumberConstraints",
        max: exclusiveMaximum,
        maxExcluded: true
      }
    }
  })
})

/**
 * @category Number checks
 * @since 4.0.0
 */
export const lessThanOrEqualTo = deriveLessThanOrEqualTo({
  order: Order.number,
  annotate: (maximum) => ({
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        maximum
      })
    },
    meta: {
      _tag: "lessThanOrEqualTo",
      maximum
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "NumberConstraints",
        max: maximum
      }
    }
  })
})

/**
 * @category Number checks
 * @since 4.0.0
 */
export const between = deriveBetween({
  order: Order.number,
  annotate: (minimum, maximum) => ({
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        minimum,
        maximum
      })
    },
    meta: {
      _tag: "between",
      minimum,
      maximum
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "NumberConstraints",
        min: minimum,
        max: maximum
      }
    }
  })
})

/**
 * @category Number checks
 * @since 4.0.0
 */
export function positive(annotations?: Annotations.Filter) {
  return greaterThan(0, annotations)
}

/**
 * @category Number checks
 * @since 4.0.0
 */
export function negative(annotations?: Annotations.Filter) {
  return lessThan(0, annotations)
}

/**
 * @category Number checks
 * @since 4.0.0
 */
export function nonNegative(annotations?: Annotations.Filter) {
  return greaterThanOrEqualTo(0, annotations)
}

/**
 * @category Number checks
 * @since 4.0.0
 */
export function nonPositive(annotations?: Annotations.Filter) {
  return lessThanOrEqualTo(0, annotations)
}

/**
 * @category Number checks
 * @since 4.0.0
 */
export const multipleOf = deriveMultipleOf({
  remainder: Num.remainder,
  zero: 0,
  annotate: (divisor) => ({
    title: `multipleOf(${divisor})`,
    description: `a value that is a multiple of ${divisor}`,
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        multipleOf: Math.abs(divisor) // JSON Schema only supports positive divisors
      })
    }
  })
})

/**
 * Restricts to safe integer range
 *
 * @category Integer checks
 * @since 4.0.0
 */
export function int(annotations?: Annotations.Filter) {
  return make((n: number) => Number.isSafeInteger(n), {
    title: "int",
    description: "an integer",
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        type: "integer"
      })
    },
    meta: {
      _tag: "int"
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "NumberConstraints",
        isInteger: true
      }
    },
    ...annotations
  })
}

/**
 * @category Integer checks
 * @since 4.0.0
 */
export function int32(annotations?: Annotations.Filter) {
  return new FilterGroup([
    int(annotations),
    between(-2147483648, 2147483647)
  ], {
    title: "int32",
    description: "a 32-bit integer",
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        format: "int32"
      })
    },
    meta: {
      _tag: "int32"
    },
    ...annotations
  })
}

/**
 * @category Integer checks
 * @since 4.0.0
 */
export function uint32(annotations?: Annotations.Filter) {
  return new FilterGroup([
    int(),
    between(0, 4294967295)
  ], {
    title: "uint32",
    description: "a 32-bit unsigned integer",
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        format: "uint32"
      })
    },
    meta: {
      _tag: "uint32"
    },
    ...annotations
  })
}

/**
 * @category Date checks
 * @since 4.0.0
 */
export function validDate(annotations?: Annotations.Filter) {
  return make<Date>((date) => !isNaN(date.getTime()), {
    meta: {
      _tag: "validDate"
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "DateConstraints",
        noInvalidDate: true
      }
    },
    ...annotations
  })
}

/**
 * @category Date checks
 * @since 4.0.0
 */
export const greaterThanOrEqualToDate = deriveGreaterThanOrEqualTo({
  order: Order.Date,
  annotate: (minimum) => ({
    meta: {
      _tag: "greaterThanOrEqualToDate",
      minimum
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "DateConstraints",
        min: minimum
      }
    }
  })
})

/**
 * @category Date checks
 * @since 4.0.0
 */
export const lessThanOrEqualToDate = deriveLessThanOrEqualTo({
  order: Order.Date,
  annotate: (maximum) => ({
    meta: {
      _tag: "lessThanOrEqualToDate",
      maximum
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "DateConstraints",
        max: maximum
      }
    }
  })
})

/**
 * @category Date checks
 * @since 4.0.0
 */
export const betweenDate = deriveBetween({
  order: Order.Date,
  annotate: (minimum, maximum) => ({
    meta: {
      _tag: "betweenDate",
      minimum,
      maximum
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "DateConstraints",
        min: minimum,
        max: maximum
      }
    }
  })
})

/**
 * @category BigInt checks
 * @since 4.0.0
 */
export const greaterThanOrEqualToBigInt = deriveGreaterThanOrEqualTo({
  order: Order.bigint,
  annotate: (minimum) => ({
    meta: {
      _tag: "greaterThanOrEqualToBigInt",
      minimum
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "BigIntConstraints",
        min: minimum
      }
    }
  })
})

/**
 * @category BigInt checks
 * @since 4.0.0
 */
export const lessThanOrEqualToBigInt = deriveLessThanOrEqualTo({
  order: Order.bigint,
  annotate: (maximum) => ({
    meta: {
      _tag: "lessThanOrEqualToBigInt",
      maximum
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "BigIntConstraints",
        max: maximum
      }
    }
  })
})

/**
 * @category BigInt checks
 * @since 4.0.0
 */
export const betweenBigInt = deriveBetween({
  order: Order.bigint,
  annotate: (minimum, maximum) => ({
    meta: {
      _tag: "betweenBigInt",
      minimum,
      maximum
    },
    arbitrary: {
      _tag: "Constraint",
      constraint: {
        _tag: "BigIntConstraints",
        min: minimum,
        max: maximum
      }
    }
  })
})

/**
 * @category Length checks
 * @since 4.0.0
 */
export function minLength(minLength: number, annotations?: Annotations.Filter) {
  minLength = Math.max(0, Math.floor(minLength))
  return make<{ readonly length: number }>((input) => input.length >= minLength, {
    title: `minLength(${minLength})`,
    description: `a value with a length of at least ${minLength}`,
    jsonSchema: {
      _tag: "Constraint",
      constraint: (type) => {
        switch (type) {
          case "string":
            return { minLength }
          case "array":
            return { minItems: minLength }
          default:
        }
      }
    },
    meta: {
      _tag: "minLength",
      minLength
    },
    "~structural": true,
    arbitrary: {
      _tag: "Constraints",
      constraints: {
        StringConstraints: {
          _tag: "StringConstraints",
          minLength
        },
        ArrayConstraints: {
          _tag: "ArrayConstraints",
          minLength
        }
      }
    },
    ...annotations
  })
}

/**
 * @category Length checks
 * @since 4.0.0
 */
export function nonEmpty(annotations?: Annotations.Filter) {
  return minLength(1, annotations)
}

/**
 * @category Length checks
 * @since 4.0.0
 */
export function maxLength(maxLength: number, annotations?: Annotations.Filter) {
  maxLength = Math.max(0, Math.floor(maxLength))
  return make<{ readonly length: number }>((input) => input.length <= maxLength, {
    title: `maxLength(${maxLength})`,
    description: `a value with a length of at most ${maxLength}`,
    jsonSchema: {
      _tag: "Constraint",
      constraint: (type) => {
        switch (type) {
          case "string":
            return { maxLength }
          case "array":
            return { maxItems: maxLength }
        }
      }
    },
    meta: {
      _tag: "maxLength",
      maxLength
    },
    "~structural": true,
    arbitrary: {
      _tag: "Constraints",
      constraints: {
        StringConstraints: {
          _tag: "StringConstraints",
          maxLength
        },
        ArrayConstraints: {
          _tag: "ArrayConstraints",
          maxLength
        }
      }
    },
    ...annotations
  })
}

/**
 * @category Length checks
 * @since 4.0.0
 */
export function length(length: number, annotations?: Annotations.Filter) {
  length = Math.max(0, Math.floor(length))
  return make<{ readonly length: number }>((input) => input.length === length, {
    title: `length(${length})`,
    description: `a value with a length of ${length}`,
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        length
      })
    },
    meta: {
      _tag: "length",
      length
    },
    "~structural": true,
    arbitrary: {
      _tag: "Constraints",
      constraints: {
        StringConstraints: {
          _tag: "StringConstraints",
          minLength: length,
          maxLength: length
        },
        ArrayConstraints: {
          _tag: "ArrayConstraints",
          minLength: length,
          maxLength: length
        }
      }
    },
    ...annotations
  })
}

/**
 * @category Size checks
 * @since 4.0.0
 */
export function minSize(minSize: number, annotations?: Annotations.Filter) {
  minSize = Math.max(0, Math.floor(minSize))
  return make<{ readonly size: number }>((input) => input.size >= minSize, {
    title: `minSize(${minSize})`,
    description: `a value with a size of at least ${minSize}`,
    meta: {
      _tag: "minSize",
      minSize
    },
    "~structural": true,
    arbitrary: {
      _tag: "Constraints",
      constraints: {
        ArrayConstraints: {
          _tag: "ArrayConstraints",
          minLength: minSize
        }
      }
    },
    ...annotations
  })
}

/**
 * @category Size checks
 * @since 4.0.0
 */
export function maxSize(maxSize: number, annotations?: Annotations.Filter) {
  maxSize = Math.max(0, Math.floor(maxSize))
  return make<{ readonly size: number }>((input) => input.size <= maxSize, {
    title: `maxSize(${maxSize})`,
    description: `a value with a size of at most ${maxSize}`,
    meta: {
      _tag: "maxSize",
      maxSize
    },
    "~structural": true,
    arbitrary: {
      _tag: "Constraints",
      constraints: {
        ArrayConstraints: {
          _tag: "ArrayConstraints",
          maxLength: maxSize
        }
      }
    },
    ...annotations
  })
}

/**
 * @category Size checks
 * @since 4.0.0
 */
export function size(size: number, annotations?: Annotations.Filter) {
  size = Math.max(0, Math.floor(size))
  return make<{ readonly size: number }>((input) => input.size === size, {
    title: `size(${size})`,
    description: `a value with a size of ${size}`,
    meta: {
      _tag: "size",
      size
    },
    "~structural": true,
    arbitrary: {
      _tag: "Constraints",
      constraints: {
        ArrayConstraints: {
          _tag: "ArrayConstraints",
          minLength: size,
          maxLength: size
        }
      }
    },
    ...annotations
  })
}

/**
 * @category Entries checks
 * @since 4.0.0
 */
export function minEntries(minEntries: number, annotations?: Annotations.Filter) {
  minEntries = Math.max(0, Math.floor(minEntries))
  return make<object>((input) => Object.entries(input).length >= minEntries, {
    title: `minEntries(${minEntries})`,
    description: `an object with at least ${minEntries} entries`,
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        minProperties: minEntries
      })
    },
    meta: {
      _tag: "minEntries",
      minEntries
    },
    "~structural": true,
    arbitrary: {
      _tag: "Constraints",
      constraints: {
        ArrayConstraints: {
          _tag: "ArrayConstraints",
          minLength: minEntries
        }
      }
    },
    ...annotations
  })
}

/**
 * @category Entries checks
 * @since 4.0.0
 */
export function maxEntries(maxEntries: number, annotations?: Annotations.Filter) {
  maxEntries = Math.max(0, Math.floor(maxEntries))
  return make<object>((input) => Object.entries(input).length <= maxEntries, {
    title: `maxEntries(${maxEntries})`,
    description: `an object with at most ${maxEntries} entries`,
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        maxProperties: maxEntries
      })
    },
    meta: {
      _tag: "maxEntries",
      maxEntries
    },
    "~structural": true,
    arbitrary: {
      _tag: "Constraints",
      constraints: {
        ArrayConstraints: {
          _tag: "ArrayConstraints",
          maxLength: maxEntries
        }
      }
    },
    ...annotations
  })
}

/**
 * @category Entries checks
 * @since 4.0.0
 */
export function entries(entries: number, annotations?: Annotations.Filter) {
  entries = Math.max(0, Math.floor(entries))
  return make<object>((input) => Object.entries(input).length === entries, {
    title: `entries(${entries})`,
    description: `an object with exactly ${entries} entries`,
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        minProperties: entries,
        maxProperties: entries
      })
    },
    meta: {
      _tag: "entries",
      entries
    },
    "~structural": true,
    arbitrary: {
      _tag: "Constraints",
      constraints: {
        ArrayConstraints: {
          _tag: "ArrayConstraints",
          minLength: entries,
          maxLength: entries
        }
      }
    },
    ...annotations
  })
}

/**
 * @since 4.0.0
 */
export function unique<T>(equivalence: Equivalence.Equivalence<T>, annotations?: Annotations.Filter) {
  return make<ReadonlyArray<T>>((input) => Arr.dedupeWith(input, equivalence).length === input.length, {
    title: "unique",
    jsonSchema: {
      _tag: "Constraint",
      constraint: () => ({
        uniqueItems: true
      })
    },
    meta: {
      _tag: "unique",
      equivalence
    },
    arbitrary: {
      _tag: "Constraints",
      constraints: {
        ArrayConstraints: {
          _tag: "ArrayConstraints",
          comparator: equivalence
        }
      }
    },
    ...annotations
  })
}
