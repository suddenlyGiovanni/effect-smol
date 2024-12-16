import { identity } from "../Function.js"
import { format, NodeInspectSymbol } from "../Inspectable.js"
import { pipeArguments } from "../Pipeable.js"
import { SingleShotGen, YieldWrap } from "../Utils.js"
import type * as Effect from "../Effect.js"
import type { Primitive } from "./core.js"
import * as Equal from "../Equal.js"
import * as Hash from "../Hash.js"

/** @internal */
export const TypeId: Effect.TypeId = Symbol.for(
  "effect/Effect",
) as Effect.TypeId

const effectVariance = {
  _A: identity,
  _E: identity,
  _R: identity,
}

/** @internal */
export const identifier = Symbol.for("effect/Effect/identifier")
/** @internal */
export type identifier = typeof identifier

/** @internal */
export const args = Symbol.for("effect/Effect/args")
/** @internal */
export type args = typeof args

/** @internal */
export const evaluate = Symbol.for("effect/Effect/evaluate")
/** @internal */
export type evaluate = typeof evaluate

/** @internal */
export const successCont = Symbol.for("effect/Effect/successCont")
/** @internal */
export type successCont = typeof successCont

/** @internal */
export const failureCont = Symbol.for("effect/Effect/failureCont")
/** @internal */
export type failureCont = typeof failureCont

/** @internal */
export const ensureCont = Symbol.for("effect/Effect/ensureCont")
/** @internal */
export type ensureCont = typeof ensureCont

/** @internal */
export const Yield = Symbol.for("effect/Effect/Yield")
/** @internal */
export type Yield = typeof Yield

/** @internal */
export const EffectProto = {
  [TypeId]: effectVariance,
  pipe() {
    return pipeArguments(this, arguments)
  },
  [Symbol.iterator]() {
    return new SingleShotGen(new YieldWrap(this)) as any
  },
  toJSON(this: Primitive) {
    return {
      _id: "Effect",
      op: this[identifier],
      ...(args in this ? { args: this[args] } : undefined),
    }
  },
  toString() {
    return format(this)
  },
  [NodeInspectSymbol]() {
    return format(this)
  },
}

/** @internal */
export const StructuralPrototype: Equal.Equal = {
  [Hash.symbol]() {
    return Hash.cached(this, Hash.structure(this))
  },
  [Equal.symbol](this: Equal.Equal, that: Equal.Equal) {
    const selfKeys = Object.keys(this)
    const thatKeys = Object.keys(that as object)
    if (selfKeys.length !== thatKeys.length) {
      return false
    }
    for (const key of selfKeys) {
      if (
        !(
          key in (that as object) &&
          Equal.equals((this as any)[key], (that as any)[key])
        )
      ) {
        return false
      }
    }
    return true
  },
}
