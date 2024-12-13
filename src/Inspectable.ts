/**
 * @since 2.0.0
 */
import { globalValue } from "./GlobalValue.js"
import { hasProperty, isFunction } from "./Predicate.js"
import * as Context from "./Context.js"

/**
 * @since 2.0.0
 * @category symbols
 */
export const NodeInspectSymbol = Symbol.for("nodejs.util.inspect.custom")

/**
 * @since 2.0.0
 * @category symbols
 */
export type NodeInspectSymbol = typeof NodeInspectSymbol

/**
 * @since 2.0.0
 * @category models
 */
export interface Inspectable {
  toString(): string
  toJSON(): unknown
  [NodeInspectSymbol](): unknown
}

/**
 * @since 2.0.0
 */
export const toJSON = (x: unknown): unknown => {
  try {
    if (
      hasProperty(x, "toJSON") &&
      isFunction(x["toJSON"]) &&
      x["toJSON"].length === 0
    ) {
      return x.toJSON()
    } else if (Array.isArray(x)) {
      return x.map(toJSON)
    }
  } catch (_) {
    return {}
  }
  return redact(x)
}

/**
 * @since 2.0.0
 */
export const format = (x: unknown): string => JSON.stringify(x, null, 2)

/**
 * @since 2.0.0
 */
export const BaseProto: Inspectable = {
  toJSON() {
    return toJSON(this)
  },
  [NodeInspectSymbol]() {
    return this.toJSON()
  },
  toString() {
    return format(this.toJSON())
  },
}

/**
 * @since 2.0.0
 */
export abstract class Class {
  /**
   * @since 2.0.0
   */
  abstract toJSON(): unknown
  /**
   * @since 2.0.0
   */
  [NodeInspectSymbol]() {
    return this.toJSON()
  }
  /**
   * @since 2.0.0
   */
  toString() {
    return format(this.toJSON())
  }
}

/**
 * @since 2.0.0
 */
export const toStringUnknown = (
  u: unknown,
  whitespace: number | string | undefined = 2,
): string => {
  if (typeof u === "string") {
    return u
  }
  try {
    return typeof u === "object" ? stringifyCircular(u, whitespace) : String(u)
  } catch (_) {
    return String(u)
  }
}

/**
 * @since 2.0.0
 */
export const stringifyCircular = (
  obj: unknown,
  whitespace?: number | string | undefined,
): string => {
  let cache: Array<unknown> = []
  const retVal = JSON.stringify(
    obj,
    (_key, value) =>
      typeof value === "object" && value !== null
        ? cache.includes(value)
          ? undefined // circular reference
          : cache.push(value) &&
            (redactableState.context !== undefined && isRedactable(value)
              ? value[symbolRedactable](redactableState.context)
              : value)
        : value,
    whitespace,
  )
  ;(cache as any) = undefined
  return retVal
}

/**
 * @since 3.10.0
 * @category redactable
 */
export interface Redactable {
  readonly [symbolRedactable]: (context: Context.Context<never>) => unknown
}

/**
 * @since 3.10.0
 * @category redactable
 */
export const symbolRedactable: unique symbol = Symbol.for(
  "effect/Inspectable/Redactable",
)

/**
 * @since 3.10.0
 * @category redactable
 */
export const isRedactable = (u: unknown): u is Redactable =>
  typeof u === "object" && u !== null && symbolRedactable in u

const redactableState = globalValue(
  "effect/Inspectable/redactableState",
  () => ({
    context: Context.empty(),
  }),
)

/**
 * @since 3.10.0
 * @category redactable
 */
export const withRedactableContext = <A>(
  context: Context.Context<never>,
  f: () => A,
): A => {
  const prev = redactableState.context
  redactableState.context = context
  try {
    return f()
  } finally {
    redactableState.context = prev
  }
}

/**
 * @since 3.10.0
 * @category redactable
 */
export const redact = (u: unknown): unknown => {
  if (isRedactable(u) && redactableState.context !== undefined) {
    return u[symbolRedactable](redactableState.context)
  }
  return u
}
