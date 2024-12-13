/**
 * @since 2.0.0
 */
import * as Context from "./Context.js"
import { constVoid, identity } from "./Function.js"
import { globalValue } from "./GlobalValue.js"
import * as InternalContext from "./internal/context.js"
import { hasProperty } from "./Predicate.js"
import type { Covariant } from "./Types.js"
import * as internal from "./internal/fiber.js"

/**
 * @since 3.11.0
 * @category Fiber
 */
export const TypeId: unique symbol = internal.TypeId

/**
 * @since 3.11.0
 * @category Fiber
 */
export type TypeId = typeof TypeId

/**
 * @since 3.11.0
 * @category Fiber
 */
export interface Fiber<out A, out E = never> {
  readonly [TypeId]: Fiber.Variance<A, E>

  readonly currentOpCount: number
  readonly getRef: <I, A>(ref: Context.Reference<I, A>) => A
  readonly context: Context.Context<never>
  readonly addObserver: (cb: (exit: EffectExit<A, E>) => void) => () => void
  readonly unsafeInterrupt: () => void
  readonly unsafePoll: () => EffectExit<A, E> | undefined
}

/**
 * @since 3.11.0
 * @experimental
 * @category Fiber
 */
export declare namespace Fiber {
  /**
   * @since 3.11.0
   * @experimental
   * @category Fiber
   */
  export interface Variance<out A, out E = never> {
    readonly _A: Covariant<A>
    readonly _E: Covariant<E>
  }
}

/**
 * @since 3.11.0
 * @experimental
 * @category Fiber
 */
export const fiberAwait = <A, E>(self: Fiber<A, E>): Effect<EffectExit<A, E>> =>
  async((resume) => sync(self.addObserver((exit) => resume(succeed(exit)))))

/**
 * @since 3.11.2
 * @experimental
 * @category Fiber
 */
export const fiberJoin = <A, E>(self: Fiber<A, E>): Effect<A, E> =>
  flatten(fiberAwait(self))

/**
 * @since 3.11.0
 * @experimental
 * @category Fiber
 */
export const fiberInterrupt = <A, E>(self: Fiber<A, E>): Effect<void> =>
  suspend(() => {
    self.unsafeInterrupt()
    return asVoid(fiberAwait(self))
  })

/**
 * @since 3.11.0
 * @experimental
 * @category Fiber
 */
export const fiberInterruptAll = <A extends Iterable<Fiber<any, any>>>(
  fibers: A,
): Effect<void> =>
  suspend(() => {
    for (const fiber of fibers) fiber.unsafeInterrupt()
    const iter = fibers[Symbol.iterator]()
    const wait: Effect<void> = suspend(() => {
      let result = iter.next()
      while (!result.done) {
        if (result.value.unsafePoll()) {
          result = iter.next()
          continue
        }
        const fiber = result.value
        return async((resume) => {
          fiber.addObserver((_) => {
            resume(wait)
          })
        })
      }
      return exitVoid
    })
    return wait
  })
