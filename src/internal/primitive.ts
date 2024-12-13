import type { FiberImpl } from "./fiber.js"
import type * as Effect from "../Effect.js"
import type * as Exit from "../Exit.js"
import { identity } from "../Function.js"
import { pipeArguments } from "../Pipeable.js"
import { SingleShotGen, YieldWrap } from "../Utils.js"
import { format, NodeInspectSymbol } from "../Inspectable.js"
import * as Equal from "../Equal.js"
import * as Hash from "../Hash.js"
import { hasProperty } from "../Predicate.js"

/** @internal */
export const TypeId: Effect.TypeId = Symbol.for(
  "effect/Effect",
) as Effect.TypeId

/** @internal */
export const ExitTypeId: Exit.TypeId = Symbol.for("effect/Exit") as Exit.TypeId

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
export interface Primitive {
  readonly [identifier]: string
  readonly [successCont]:
    | ((value: unknown, fiber: FiberImpl) => Primitive | Yield)
    | undefined
  readonly [failureCont]:
    | ((cause: EffectCause<unknown>, fiber: FiberImpl) => Primitive | Yield)
    | undefined
  readonly [ensureCont]:
    | ((
        fiber: FiberImpl,
      ) =>
        | ((value: unknown, fiber: FiberImpl) => Primitive | Yield)
        | undefined)
    | undefined
  [evaluate](fiber: FiberImpl): Primitive | Yield
}

const effectVariance = {
  _A: identity,
  _E: identity,
  _R: identity,
}

const EffectProto = {
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

function defaultEvaluate(_fiber: FiberImpl): Primitive | Yield {
  return exitDie(`Effect.evaluate: Not implemented`) as any
}

const makePrimitiveProto = <Op extends string>(options: {
  readonly op: Op
  readonly eval?: (
    fiber: FiberImpl,
  ) => Primitive | Effect.Effect<any, any, any> | Yield
  readonly contA?: (
    this: Primitive,
    value: any,
    fiber: FiberImpl,
  ) => Primitive | Effect.Effect<any, any, any> | Yield
  readonly contE?: (
    this: Primitive,
    cause: EffectCause<any>,
    fiber: FiberImpl,
  ) => Primitive | Effect.Effect<any, any, any> | Yield
  readonly ensure?: (
    this: Primitive,
    fiber: FiberImpl,
  ) => void | ((value: any, fiber: FiberImpl) => void)
}): Primitive =>
  ({
    ...EffectProto,
    [identifier]: options.op,
    [evaluate]: options.eval ?? defaultEvaluate,
    [successCont]: options.contA,
    [failureCont]: options.contE,
    [ensureCont]: options.ensure,
  }) as any

const makePrimitive = <
  Fn extends (...args: Array<any>) => any,
  Single extends boolean = true,
>(options: {
  readonly op: string
  readonly single?: Single
  readonly eval?: (
    this: Primitive & {
      readonly [args]: Single extends true ? Parameters<Fn>[0] : Parameters<Fn>
    },
    fiber: FiberImpl,
  ) => Primitive | Effect.Effect<any, any, any> | Yield
  readonly contA?: (
    this: Primitive & {
      readonly [args]: Single extends true ? Parameters<Fn>[0] : Parameters<Fn>
    },
    value: any,
    fiber: FiberImpl,
  ) => Primitive | Effect.Effect<any, any, any> | Yield
  readonly contE?: (
    this: Primitive & {
      readonly [args]: Single extends true ? Parameters<Fn>[0] : Parameters<Fn>
    },
    cause: EffectCause<any>,
    fiber: FiberImpl,
  ) => Primitive | Effect.Effect<any, any, any> | Yield
  readonly ensure?: (
    this: Primitive & {
      readonly [args]: Single extends true ? Parameters<Fn>[0] : Parameters<Fn>
    },
    fiber: FiberImpl,
  ) => void | ((value: any, fiber: FiberImpl) => void)
}): Fn => {
  const Proto = makePrimitiveProto(options as any)
  return function () {
    const self = Object.create(Proto)
    self[args] = options.single === false ? arguments : arguments[0]
    return self
  } as Fn
}

const makeExit = <
  Fn extends (...args: Array<any>) => any,
  Prop extends string,
>(options: {
  readonly op: "Success" | "Failure"
  readonly prop: Prop
  readonly eval: (
    this: Exit.Exit<unknown, unknown> & { [args]: Parameters<Fn>[0] },
    fiber: FiberImpl<unknown, unknown>,
  ) => Primitive | Yield
}): Fn => {
  const Proto = {
    ...makePrimitiveProto(options),
    [ExitTypeId]: ExitTypeId,
    _tag: options.op,
    get [options.prop](): any {
      return (this as any)[args]
    },
    toJSON(this: any) {
      return {
        _id: "EffectExit",
        _tag: options.op,
        [options.prop]: this[args],
      }
    },
    [Equal.symbol](this: any, that: any): boolean {
      return (
        isExit(that) &&
        that._tag === options.op &&
        Equal.equals(this[args], (that as any)[args])
      )
    },
    [Hash.symbol](this: any): number {
      return Hash.cached(
        this,
        Hash.combine(Hash.string(options.op))(Hash.hash(this[args])),
      )
    },
  }
  return function (value: unknown) {
    const self = Object.create(Proto)
    self[args] = value
    self[successCont] = undefined
    self[failureCont] = undefined
    self[ensureCont] = undefined
    return self
  } as Fn
}

/** @internal */
export const isExit = (u: unknown): u is Exit.Exit<unknown, unknown> =>
  hasProperty(u, ExitTypeId)

/**
 * @since 3.4.6
 * @experimental
 * @category EffectExit
 */
export const exitSucceed: <A>(a: A) => EffectExit<A, never> = succeed as any

/**
 * @since 3.4.6
 * @experimental
 * @category EffectExit
 */
export const exitFailCause: <E>(cause: EffectCause<E>) => EffectExit<never, E> =
  failCause as any

/**
 * @since 3.4.6
 * @experimental
 * @category EffectExit
 */
export const exitInterrupt: EffectExit<never> = exitFailCause(causeInterrupt())

/**
 * @since 3.4.6
 * @experimental
 * @category EffectExit
 */
export const exitFail = <E>(e: E): EffectExit<never, E> =>
  exitFailCause(causeFail(e))

/**
 * @since 3.4.6
 * @experimental
 * @category EffectExit
 */
export const exitDie = (defect: unknown): EffectExit<never> =>
  exitFailCause(causeDie(defect))

/**
 * @since 3.4.6
 * @experimental
 * @category EffectExit
 */
export const exitIsSuccess = <A, E>(
  self: EffectExit<A, E>,
): self is EffectExit.Success<A, E> => self._tag === "Success"

/**
 * @since 3.4.6
 * @experimental
 * @category EffectExit
 */
export const exitIsFailure = <A, E>(
  self: EffectExit<A, E>,
): self is EffectExit.Failure<A, E> => self._tag === "Failure"

/**
 * @since 3.4.6
 * @experimental
 * @category EffectExit
 */
export const exitIsInterrupt = <A, E>(
  self: EffectExit<A, E>,
): self is EffectExit.Failure<A, E> & {
  readonly cause: EffectCause.Interrupt
} => exitIsFailure(self) && self.cause._tag === "Interrupt"

/**
 * @since 3.4.6
 * @experimental
 * @category EffectExit
 */
export const exitIsFail = <A, E>(
  self: EffectExit<A, E>,
): self is EffectExit.Failure<A, E> & {
  readonly cause: EffectCause.Fail<E>
} => exitIsFailure(self) && self.cause._tag === "Fail"

/**
 * @since 3.4.6
 * @experimental
 * @category EffectExit
 */
export const exitIsDie = <A, E>(
  self: EffectExit<A, E>,
): self is EffectExit.Failure<A, E> & {
  readonly cause: EffectCause.Die
} => exitIsFailure(self) && self.cause._tag === "Die"

/**
 * @since 3.4.6
 * @experimental
 * @category EffectExit
 */
export const exitVoid: EffectExit<void> = exitSucceed(void 0)

/**
 * @since 3.11.0
 * @experimental
 * @category EffectExit
 */
export const exitVoidAll = <I extends Iterable<EffectExit<any, any>>>(
  exits: I,
): EffectExit<
  void,
  I extends Iterable<EffectExit<infer _A, infer _E>> ? _E : never
> => {
  for (const exit of exits) {
    if (exit._tag === "Failure") {
      return exit
    }
  }
  return exitVoid
}
