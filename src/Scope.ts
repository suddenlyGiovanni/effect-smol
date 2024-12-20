import type * as Context from "./Context.js"
import type { Effect } from "./Effect.js"
import type { Exit } from "./Exit.js"
import * as core from "./internal/core.js"

/**
 * @since 2.0.0
 * @category type ids
 */
export const TypeId: unique symbol = core.ScopeTypeId

/**
 * @since 2.0.0
 * @category type ids
 */
export type TypeId = typeof TypeId

/**
 * @since 2.0.0
 * @category models
 */
export interface Scope {
  readonly [TypeId]: TypeId
  readonly addFinalizer: (
    finalizer: (exit: Exit<unknown, unknown>) => Effect<void>
  ) => Effect<void>
  readonly fork: Effect<Scope.Closeable>
}

/**
 * @since 2.0.0
 * @category models
 */
export declare namespace Scope {
  /**
   * @since 2.0.0
   * @category models
   */
  export interface Closeable extends Scope {
    readonly close: (exit: Exit<any, any>) => Effect<void>
  }
}

/**
 * @since 2.0.0
 * @category tags
 */
export const Scope: Context.Tag<Scope, Scope> = core.scopeTag

/**
 * @since 2.0.0
 * @category constructors
 */
export const make: Effect<Scope.Closeable> = core.scopeMake

/**
 * @since 4.0.0
 * @category constructors
 */
export const unsafeMake: () => Scope.Closeable = core.scopeUnsafeMake

/**
 * @since 4.0.0
 * @category combinators
 */
export const provideScope: {
  (
    scope: Scope
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, Scope>>
  <A, E, R>(
    self: Effect<A, E, R>,
    scope: Scope
  ): Effect<A, E, Exclude<R, Scope>>
} = core.provideScope
