import type { Effect } from "../Effect.ts"
import { CurrentConcurrency } from "../References.ts"
import type { Concurrency } from "../types/Types.ts"
import * as effect from "./effect.ts"

/** @internal */
export const match = <A, E, R>(
  concurrency: Concurrency | undefined,
  sequential: () => Effect<A, E, R>,
  unbounded: () => Effect<A, E, R>,
  bounded: (limit: number) => Effect<A, E, R>
): Effect<A, E, R> => {
  switch (concurrency) {
    case undefined:
      return sequential()
    case "unbounded":
      return unbounded()
    case "inherit":
      return effect.flatMap(CurrentConcurrency.asEffect(), (concurrency) =>
        concurrency === "unbounded"
          ? unbounded()
          : concurrency > 1
          ? bounded(concurrency)
          : sequential())
    default:
      return concurrency > 1 ? bounded(concurrency) : sequential()
  }
}

/** @internal */
export const matchSimple = <A, E, R>(
  concurrency: Concurrency | undefined,
  sequential: () => Effect<A, E, R>,
  concurrent: () => Effect<A, E, R>
): Effect<A, E, R> => {
  switch (concurrency) {
    case undefined:
      return sequential()
    case "unbounded":
      return concurrent()
    case "inherit":
      return effect.flatMap(
        CurrentConcurrency.asEffect(),
        (concurrency) =>
          concurrency === "unbounded" || concurrency > 1
            ? concurrent()
            : sequential()
      )
    default:
      return concurrency > 1 ? concurrent() : sequential()
  }
}
