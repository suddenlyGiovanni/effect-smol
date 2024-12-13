import * as Arr from "../Array.js"
import * as Context from "../Context.js"
import * as Either from "../Either.js"
import * as Equal from "../Equal.js"
import type { LazyArg } from "../Function.js"
import { constTrue, constVoid, dual, identity } from "../Function.js"
import { globalValue } from "../GlobalValue.js"
import * as Hash from "../Hash.js"
import type { Inspectable } from "../Inspectable.js"
import { format, NodeInspectSymbol } from "../Inspectable.js"
import * as InternalContext from "./context.js"
import * as doNotation from "./doNotation.js"
import * as Option from "../Option.js"
import type { Pipeable } from "../Pipeable.js"
import { pipeArguments } from "../Pipeable.js"
import type { Predicate, Refinement } from "../Predicate.js"
import { hasProperty, isIterable, isObject, isTagged } from "../Predicate.js"
import type { Concurrency, Equals, NotFunction, Simplify } from "../Types.js"
import { SingleShotGen, YieldWrap, yieldWrapGet } from "../Utils.js"
import * as Data from "../Data.js"
import type * as Effect from "../Effect.js"
import type * as Exit from "../Exit.js"
import type * as Cause from "../Cause.js"
import type * as Fiber from "../Fiber.js"

/** @internal */
export const TypeId: Effect.TypeId = Symbol.for(
  "effect/Effect",
) as Effect.TypeId

/** @internal */
export const ExitTypeId: Exit.TypeId = Symbol.for("effect/Exit") as Exit.TypeId

// ----------------------------------------------------------------------------
// Cause
// ----------------------------------------------------------------------------

/** @internal */
export const CauseTypeId: Cause.TypeId = Symbol.for(
  "effect/Cause",
) as Cause.TypeId

/** @internal */
export const isCause = (self: unknown): self is Cause.Cause<unknown> =>
  hasProperty(self, CauseTypeId)

class CauseImpl<E> implements Cause.Cause<E> {
  readonly [CauseTypeId]: Cause.TypeId
  constructor(
    readonly failures: ReadonlyArray<
      Cause.Fail<E> | Cause.Die | Cause.Interrupt
    >,
  ) {
    this[CauseTypeId] = CauseTypeId
  }
  pipe() {
    return pipeArguments(this, arguments)
  }
  toJSON(): unknown {
    return {
      _id: "Cause",
      failures: this.failures.map((f) => f.toJSON()),
    }
  }
  toString() {
    return format(this)
  }
  [NodeInspectSymbol]() {
    return this.toString()
  }
}

const errorAnnotations = globalValue(
  "effect/Cause/errorAnnotations",
  () => new WeakMap<object, Context.Context<never>>(),
)

abstract class FailureBase<Tag extends string>
  implements Cause.Cause.FailureProto<Tag>
{
  readonly annotations: Context.Context<never>

  constructor(
    readonly _tag: Tag,
    annotations: Context.Context<never>,
    originalError: unknown,
  ) {
    if (isObject(originalError)) {
      if (errorAnnotations.has(originalError)) {
        annotations = Context.merge(
          errorAnnotations.get(originalError)!,
          annotations,
        )
      }
      errorAnnotations.set(originalError, annotations)
    }
    this.annotations = annotations
  }

  abstract annotate<I, S>(this: any, tag: Context.Tag<I, S>, value: S): this

  pipe() {
    return pipeArguments(this, arguments)
  }

  abstract toJSON(): unknown

  toString() {
    return format(this)
  }

  [NodeInspectSymbol]() {
    return this.toString()
  }
}

class Fail<E> extends FailureBase<"Fail"> implements Cause.Fail<E> {
  constructor(
    readonly error: E,
    annotations = Context.empty(),
  ) {
    super("Fail", annotations, error)
  }
  toJSON(): unknown {
    return {
      _tag: "Fail",
      error: this.error,
    }
  }
  annotate<I, S>(tag: Context.Tag<I, S>, value: S): this {
    return new Fail(
      this.error,
      Context.add(this.annotations, tag, value),
    ) as this
  }
}

/** @internal */
export const causeFail = <E>(error: E): Cause.Cause<E> =>
  new CauseImpl([new Fail(error)])

class Die extends FailureBase<"Die"> implements Cause.Die {
  constructor(
    readonly defect: unknown,
    annotations = Context.empty(),
  ) {
    super("Die", annotations, defect)
  }
  toJSON(): unknown {
    return {
      _tag: "Die",
      defect: this.defect,
    }
  }
  annotate<I, S>(tag: Context.Tag<I, S>, value: S): this {
    return new Die(
      this.defect,
      Context.add(this.annotations, tag, value),
    ) as this
  }
}

/** @internal */
export const causeDie = (defect: unknown): Cause.Cause<never> =>
  new CauseImpl([new Die(defect)])

// TODO: add fiber ids?
class Interrupt extends FailureBase<"Interrupt"> implements Cause.Interrupt {
  constructor(annotations = Context.empty()) {
    super("Interrupt", annotations, new Error("Interrupted"))
  }
  toJSON(): unknown {
    return {
      _tag: "Interrupt",
    }
  }
  annotate<I, S>(tag: Context.Tag<I, S>, value: S): this {
    return new Interrupt(Context.add(this.annotations, tag, value)) as this
  }
}

/** @internal */
export const causeInterrupt: Cause.Cause<never> = new CauseImpl([
  new Interrupt(),
])

/** @internal */
export const causeIsFail = <E>(self: Cause.Cause<E>): boolean =>
  self.failures.some((f) => f._tag === "Fail")

/** @internal */
export const causeIsDie = <E>(self: Cause.Cause<E>): boolean =>
  self.failures.some((f) => f._tag === "Die")

/** @internal */
export const causeIsInterrupt = <E>(self: Cause.Cause<E>): boolean =>
  self.failures.some((f) => f._tag === "Interrupt")

/** @internal */
export const causePartition = <E>(
  self: Cause.Cause<E>,
): {
  readonly Fail: ReadonlyArray<Cause.Fail<E>>
  readonly Die: ReadonlyArray<Cause.Die>
  readonly Interrupt: ReadonlyArray<Cause.Interrupt>
} => {
  const obj = {
    Fail: [] as Cause.Fail<E>[],
    Die: [] as Cause.Die[],
    Interrupt: [] as Cause.Interrupt[],
  }
  for (let i = 0; i < self.failures.length; i++) {
    obj[self.failures[i]._tag].push(self.failures[i] as any)
  }
  return obj
}

/** @internal */
export const causeSquash = <E>(self: Cause.Cause<E>): unknown => {
  const partitioned = causePartition(self)
  if (partitioned.Fail.length > 0) {
    return partitioned.Fail[0].error
  } else if (partitioned.Die.length > 0) {
    return partitioned.Die[0].defect
  } else if (partitioned.Interrupt.length > 0) {
    return new globalThis.Error("Interrupted")
  }
  return new globalThis.Error("Empty cause")
}

/** @internal */
export const causeAnnotate: {
  <I, S>(
    tag: Context.Tag<I, S>,
    value: S,
  ): <E>(self: Cause.Cause<E>) => Cause.Cause<E>
  <E, I, S>(
    self: Cause.Cause<E>,
    tag: Context.Tag<I, S>,
    value: S,
  ): Cause.Cause<E>
} = dual(
  3,
  <E, I, S>(
    self: Cause.Cause<E>,
    tag: Context.Tag<I, S>,
    value: S,
  ): Cause.Cause<E> =>
    new CauseImpl(self.failures.map((f) => f.annotate(tag, value))),
)

// ----------------------------------------------------------------------------
// Fiber
// ----------------------------------------------------------------------------

/** @internal */
export const FiberTypeId: Fiber.TypeId = Symbol.for(
  "effect/Fiber",
) as Fiber.TypeId

const fiberVariance = {
  _A: identity,
  _E: identity,
}

class FiberImpl<in out A = any, in out E = any> implements Fiber.Fiber<A, E> {
  readonly [FiberTypeId]: Fiber.Fiber.Variance<A, E>

  readonly _stack: Array<Primitive> = []
  readonly _observers: Array<(exit: Exit.Exit<A, E>) => void> = []
  _exit: Exit.Exit<A, E> | undefined
  public _children: Set<FiberImpl<any, any>> | undefined

  public currentOpCount = 0

  constructor(
    public context: Context.Context<never>,
    public interruptible = true,
  ) {
    this[FiberTypeId] = fiberVariance
  }

  getRef<I, A>(ref: Context.Reference<I, A>): A {
    return InternalContext.unsafeGetReference(this.context, ref)
  }

  addObserver(cb: (exit: Exit.Exit<A, E>) => void): () => void {
    if (this._exit) {
      cb(this._exit)
      return constVoid
    }
    this._observers.push(cb)
    return () => {
      const index = this._observers.indexOf(cb)
      if (index >= 0) {
        this._observers.splice(index, 1)
      }
    }
  }

  _interrupted = false
  unsafeInterrupt(): void {
    if (this._exit) {
      return
    }
    this._interrupted = true
    if (this.interruptible) {
      this.evaluate(exitInterrupt as any)
    }
  }

  unsafePoll(): Exit.Exit<A, E> | undefined {
    return this._exit
  }

  evaluate(effect: Primitive): void {
    if (this._exit) {
      return
    } else if (this._yielded !== undefined) {
      const yielded = this._yielded as () => void
      this._yielded = undefined
      yielded()
    }
    const exit = this.runLoop(effect)
    if (exit === Yield) {
      return
    }

    // the interruptChildren middlware is added in Effect.fork, so it can be
    // tree-shaken if not used
    const interruptChildren =
      fiberMiddleware.interruptChildren &&
      fiberMiddleware.interruptChildren(this)
    if (interruptChildren !== undefined) {
      return this.evaluate(flatMap(interruptChildren, () => exit) as any)
    }

    this._exit = exit
    for (let i = 0; i < this._observers.length; i++) {
      this._observers[i](exit)
    }
    this._observers.length = 0
  }

  runLoop(effect: Primitive): Exit.Exit<A, E> | Yield {
    let yielding = false
    let current: Primitive | Yield = effect
    this.currentOpCount = 0
    try {
      while (true) {
        this.currentOpCount++
        if (
          !yielding &&
          this.getRef(CurrentScheduler).shouldYield(this as any)
        ) {
          yielding = true
          const prev = current
          current = flatMap(yieldNow, () => prev as any) as any
        }
        current = (current as any)[evaluate](this)
        if (current === Yield) {
          const yielded = this._yielded!
          if (ExitTypeId in yielded) {
            this._yielded = undefined
            return yielded
          }
          return Yield
        }
      }
    } catch (error) {
      if (!hasProperty(current, evaluate)) {
        return exitDie(`Fiber.runLoop: Not a valid effect: ${String(current)}`)
      }
      return exitDie(error)
    }
  }

  getCont<S extends successCont | failureCont>(
    symbol: S,
  ):
    | (Primitive & Record<S, (value: any, fiber: FiberImpl) => Primitive>)
    | undefined {
    while (true) {
      const op = this._stack.pop()
      if (!op) return undefined
      const cont = op[ensureCont] && op[ensureCont](this)
      if (cont) return { [symbol]: cont } as any
      if (op[symbol]) return op as any
    }
  }

  // cancel the yielded operation, or for the yielded exit value
  _yielded: Exit.Exit<any, any> | (() => void) | undefined = undefined
  yieldWith(value: Exit.Exit<any, any> | (() => void)): Yield {
    this._yielded = value
    return Yield
  }

  children(): Set<Fiber.Fiber<any, any>> {
    return (this._children ??= new Set())
  }
}

const fiberMiddleware = globalValue("effect/Fiber/fiberMiddleware", () => ({
  interruptChildren: undefined as
    | ((fiber: FiberImpl) => Effect.Effect<void> | undefined)
    | undefined,
}))

const fiberInterruptChildren = (fiber: FiberImpl) => {
  if (fiber._children === undefined || fiber._children.size === 0) {
    return undefined
  }
  return fiberInterruptAll(fiber._children)
}

/** @internal */
export const fiberAwait = <A, E>(
  self: Fiber.Fiber<A, E>,
): Effect.Effect<Exit.Exit<A, E>> =>
  async((resume) => sync(self.addObserver((exit) => resume(succeed(exit)))))

/** @internal */
export const fiberJoin = <A, E>(self: Fiber.Fiber<A, E>): Effect.Effect<A, E> =>
  flatten(fiberAwait(self))

/** @internal */
export const fiberInterrupt = <A, E>(
  self: Fiber.Fiber<A, E>,
): Effect.Effect<void> =>
  suspend(() => {
    self.unsafeInterrupt()
    return asVoid(fiberAwait(self))
  })

/** @internal */
export const fiberInterruptAll = <A extends Iterable<Fiber.Fiber<any, any>>>(
  fibers: A,
): Effect.Effect<void> =>
  suspend(() => {
    for (const fiber of fibers) fiber.unsafeInterrupt()
    const iter = fibers[Symbol.iterator]()
    const wait: Effect.Effect<void> = suspend(() => {
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

const identifier = Symbol.for("effect/Effect/identifier")
type identifier = typeof identifier

const args = Symbol.for("effect/Effect/args")
type args = typeof args

const evaluate = Symbol.for("effect/Effect/evaluate")
type evaluate = typeof evaluate

const successCont = Symbol.for("effect/Effect/successCont")
type successCont = typeof successCont

const failureCont = Symbol.for("effect/Effect/failureCont")
type failureCont = typeof failureCont

const ensureCont = Symbol.for("effect/Effect/ensureCont")
type ensureCont = typeof ensureCont

const Yield = Symbol.for("effect/Effect/Yield")
type Yield = typeof Yield

interface Primitive {
  readonly [identifier]: string
  readonly [successCont]:
    | ((value: unknown, fiber: FiberImpl) => Primitive | Yield)
    | undefined
  readonly [failureCont]:
    | ((cause: Cause.Cause<unknown>, fiber: FiberImpl) => Primitive | Yield)
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
    cause: Cause.Cause<any>,
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
    cause: Cause.Cause<any>,
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
        _id: "Exit",
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
export const succeed: <A>(value: A) => Effect.Effect<A> = makeExit({
  op: "Success",
  prop: "value",
  eval(fiber) {
    const cont = fiber.getCont(successCont)
    return cont ? cont[successCont](this[args], fiber) : fiber.yieldWith(this)
  },
})

/** @internal */
export const failCause: <E>(cause: Cause.Cause<E>) => Effect.Effect<never, E> =
  makeExit({
    op: "Failure",
    prop: "cause",
    eval(fiber) {
      let cont = fiber.getCont(failureCont)
      while (causeIsInterrupt(this[args]) && cont && fiber.interruptible) {
        cont = fiber.getCont(failureCont)
      }
      return cont ? cont[failureCont](this[args], fiber) : fiber.yieldWith(this)
    },
  })

/** @internal */
export const fail = <E>(error: E): Effect.Effect<never, E> =>
  failCause(causeFail(error))

/** @internal */
export const sync: <A>(evaluate: LazyArg<A>) => Effect.Effect<A> =
  makePrimitive({
    op: "Sync",
    eval(fiber): Primitive | Yield {
      const value = this[args]()
      const cont = fiber.getCont(successCont)
      return cont
        ? cont[successCont](value, fiber)
        : fiber.yieldWith(exitSucceed(value))
    },
  })

/** @internal */
export const suspend: <A, E, R>(
  evaluate: LazyArg<Effect.Effect<A, E, R>>,
) => Effect.Effect<A, E, R> = makePrimitive({
  op: "Suspend",
  eval(_fiber) {
    return this[args]()
  },
})

/** @internal */
export const yieldNowWith: (priority?: number) => Effect.Effect<void> =
  makePrimitive({
    op: "Yield",
    eval(fiber) {
      let resumed = false
      fiber.getRef(CurrentScheduler).scheduleTask(() => {
        if (resumed) return
        fiber.evaluate(exitVoid as any)
      }, this[args] ?? 0)
      return fiber.yieldWith(() => {
        resumed = true
      })
    },
  })

/** @internal */
export const yieldNow: Effect.Effect<void> = yieldNowWith(0)

/** @internal */
export const succeedSome = <A>(a: A): Effect.Effect<Option.Option<A>> =>
  succeed(Option.some(a))

/** @internal */
export const succeedNone: Effect.Effect<Option.Option<never>> = succeed(
  Option.none(),
)

/** @internal */
export const failCauseSync = <E>(
  evaluate: LazyArg<Cause.Cause<E>>,
): Effect.Effect<never, E> => suspend(() => failCause(evaluate()))

/** @internal */
export const die = (defect: unknown): Effect.Effect<never> => exitDie(defect)

/** @internal */
export const failSync = <E>(error: LazyArg<E>): Effect.Effect<never, E> =>
  suspend(() => fail(error()))

/** @internal */
export const fromOption = <A>(
  option: Option.Option<A>,
): Effect.Effect<A, NoSuchElementException> =>
  option._tag === "Some"
    ? succeed(option.value)
    : fail(new NoSuchElementException({}))

/** @internal */
export const fromEither = <R, L>(
  either: Either.Either<R, L>,
): Effect.Effect<R, L> =>
  either._tag === "Right" ? succeed(either.right) : fail(either.left)

const void_: Effect.Effect<void> = succeed(void 0)
export {
  /** @internal */
  void_ as void,
}

const try_ = <A, E>(options: {
  try: LazyArg<A>
  catch: (error: unknown) => E
}): Effect.Effect<A, E> =>
  suspend(() => {
    try {
      return succeed(options.try())
    } catch (err) {
      return fail(options.catch(err))
    }
  })
export {
  /** @internal */
  try_ as try,
}

/** @internal */
export const promise = <A>(
  evaluate: (signal: AbortSignal) => PromiseLike<A>,
): Effect.Effect<A> =>
  asyncOptions<A>(function (resume, signal) {
    evaluate(signal!).then(
      (a) => resume(succeed(a)),
      (e) => resume(die(e)),
    )
  }, evaluate.length !== 0)

/**
 * Wrap a `Promise` into a `Effect` effect. Any errors will be caught and
 * converted into a specific error type.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * Effect.tryPromise({
 *   try: () => Promise.resolve("success"),
 *   catch: (cause) => new Error("caught", { cause })
 * })
 * ```
 *
 * @since 3.4.0
 * @experimental
 * @category constructors
 */
export const tryPromise = <A, E>(options: {
  readonly try: (signal: AbortSignal) => PromiseLike<A>
  readonly catch: (error: unknown) => E
}): Effect<A, E> =>
  asyncOptions<A, E>(function (resume, signal) {
    try {
      options.try(signal!).then(
        (a) => resume(succeed(a)),
        (e) => resume(fail(options.catch(e))),
      )
    } catch (err) {
      resume(fail(options.catch(err)))
    }
  }, options.try.length !== 0)

/**
 * Create a `Effect` effect using the current `Fiber`.
 *
 * @since 3.4.0
 * @experimental
 * @category constructors
 */
export const withFiber: <A, E = never, R = never>(
  evaluate: (fiber: FiberImpl<A, E>) => Effect<A, E, R>,
) => Effect<A, E, R> = makePrimitive({
  op: "WithFiber",
  eval(fiber) {
    return this[args](fiber)
  },
})

/**
 * Flush any yielded effects that are waiting to be executed.
 *
 * @since 3.4.0
 * @experimental
 * @category constructors
 */
export const yieldFlush: Effect<void> = withFiber((fiber) => {
  fiber.getRef(CurrentScheduler).flush()
  return exitVoid
})

const asyncOptions: <A, E = never, R = never>(
  register: (
    resume: (effect: Effect<A, E, R>) => void,
    signal?: AbortSignal,
  ) => void | Effect<void, never, R>,
  withSignal: boolean,
) => Effect<A, E, R> = makePrimitive({
  op: "Async",
  single: false,
  eval(fiber) {
    const register = this[args][0]
    let resumed = false
    let yielded: boolean | Primitive = false
    const controller = this[args][1] ? new AbortController() : undefined
    const onCancel = register((effect) => {
      if (resumed) return
      resumed = true
      if (yielded) {
        fiber.evaluate(effect as any)
      } else {
        yielded = effect as any
      }
    }, controller?.signal)
    if (yielded !== false) return yielded
    yielded = true
    fiber._yielded = () => {
      resumed = true
    }
    if (controller === undefined && onCancel === undefined) {
      return Yield
    }
    fiber._stack.push(
      asyncFinalizer(() => {
        resumed = true
        controller?.abort()
        return onCancel ?? exitVoid
      }),
    )
    return Yield
  },
})
const asyncFinalizer: (onInterrupt: () => Effect<void, any, any>) => Primitive =
  makePrimitive({
    op: "AsyncFinalizer",
    ensure(fiber) {
      if (fiber.interruptible) {
        fiber.interruptible = false
        fiber._stack.push(setInterruptible(true))
      }
    },
    contE(cause, _fiber) {
      return causeIsInterrupt(cause)
        ? flatMap(this[args](), () => failCause(cause))
        : failCause(cause)
    },
  })

/**
 * Create a `Effect` effect from an asynchronous computation.
 *
 * You can return a cleanup effect that will be run when the effect is aborted.
 * It is also passed an `AbortSignal` that is triggered when the effect is
 * aborted.
 *
 * @since 3.4.0
 * @experimental
 * @category constructors
 */
export const async = <A, E = never, R = never>(
  register: (
    resume: (effect: Effect<A, E, R>) => void,
    signal: AbortSignal,
  ) => void | Effect<void, never, R>,
): Effect<A, E, R> => asyncOptions(register as any, register.length >= 2)

/**
 * A `Effect` that will never succeed or fail. It wraps `setInterval` to prevent
 * the Javascript runtime from exiting.
 *
 * @since 3.4.0
 * @experimental
 * @category constructors
 */
export const never: Effect<never> = async<never>(function () {
  const interval = setInterval(constVoid, 2147483646)
  return sync(() => clearInterval(interval))
})

/**
 * @since 3.4.0
 * @experimental
 * @category constructors
 */
export const gen = <Self, Eff extends YieldWrap<Effect<any, any, any>>, AEff>(
  ...args:
    | [self: Self, body: (this: Self) => Generator<Eff, AEff, never>]
    | [body: () => Generator<Eff, AEff, never>]
): Effect<
  AEff,
  [Eff] extends [never]
    ? never
    : [Eff] extends [YieldWrap<Effect<infer _A, infer E, infer _R>>]
      ? E
      : never,
  [Eff] extends [never]
    ? never
    : [Eff] extends [YieldWrap<Effect<infer _A, infer _E, infer R>>]
      ? R
      : never
> =>
  suspend(() =>
    fromIterator(
      args.length === 1 ? args[0]() : (args[1].call(args[0]) as any),
    ),
  )

const fromIterator: (
  iterator: Iterator<any, YieldWrap<Effect<any, any, any>>>,
) => Effect<any, any, any> = makePrimitive({
  op: "Iterator",
  contA(value, fiber) {
    const state = this[args].next(value)
    if (state.done) return succeed(state.value)
    fiber._stack.push(this)
    return yieldWrapGet(state.value)
  },
  eval(this: any, fiber: FiberImpl) {
    return this[successCont](undefined, fiber)
  },
})

// ----------------------------------------------------------------------------
// mapping & sequencing
// ----------------------------------------------------------------------------

/**
 * Create a `Effect` effect that will replace the success value of the given
 * effect.
 *
 * @since 3.4.0
 * @experimental
 * @category mapping & sequencing
 */
export const as: {
  <A, B>(value: B): <E, R>(self: Effect<A, E, R>) => Effect<B, E, R>
  <A, E, R, B>(self: Effect<A, E, R>, value: B): Effect<B, E, R>
} = dual(
  2,
  <A, E, R, B>(self: Effect<A, E, R>, value: B): Effect<B, E, R> =>
    map(self, (_) => value),
)

/**
 * Wrap the success value of this `Effect` effect in a `Some`.
 *
 * @since 3.4.0
 * @experimental
 * @category mapping & sequencing
 */
export const asSome = <A, E, R>(
  self: Effect<A, E, R>,
): Effect<Option.Option<A>, E, R> => map(self, Option.some)

/**
 * Swap the error and success types of the `Effect` effect.
 *
 * @since 3.4.0
 * @experimental
 * @category mapping & sequencing
 */
export const flip = <A, E, R>(self: Effect<A, E, R>): Effect<E, A, R> =>
  matchEffect(self, {
    onFailure: succeed,
    onSuccess: fail,
  })

/**
 * A more flexible version of `flatMap` that combines `map` and `flatMap` into a
 * single API.
 *
 * It also lets you directly pass a `Effect` effect, which will be executed after
 * the current effect.
 *
 * @since 3.4.0
 * @experimental
 * @category mapping & sequencing
 */
export const andThen: {
  <A, X>(
    f: (a: A) => X,
  ): <E, R>(
    self: Effect<A, E, R>,
  ) => [X] extends [Effect<infer A1, infer E1, infer R1>]
    ? Effect<A1, E | E1, R | R1>
    : Effect<X, E, R>
  <X>(
    f: NotFunction<X>,
  ): <A, E, R>(
    self: Effect<A, E, R>,
  ) => [X] extends [Effect<infer A1, infer E1, infer R1>]
    ? Effect<A1, E | E1, R | R1>
    : Effect<X, E, R>
  <A, E, R, X>(
    self: Effect<A, E, R>,
    f: (a: A) => X,
  ): [X] extends [Effect<infer A1, infer E1, infer R1>]
    ? Effect<A1, E | E1, R | R1>
    : Effect<X, E, R>
  <A, E, R, X>(
    self: Effect<A, E, R>,
    f: NotFunction<X>,
  ): [X] extends [Effect<infer A1, infer E1, infer R1>]
    ? Effect<A1, E | E1, R | R1>
    : Effect<X, E, R>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    f: any,
  ): Effect<B, E | E2, R | R2> =>
    flatMap(self, (a) => {
      const value = isEffect(f) ? f : typeof f === "function" ? f(a) : f
      return isEffect(value) ? value : succeed(value)
    }),
)

/**
 * Execute a side effect from the success value of the `Effect` effect.
 *
 * It is similar to the `andThen` api, but the success value is ignored.
 *
 * @since 3.4.0
 * @experimental
 * @category mapping & sequencing
 */
export const tap: {
  <A, X>(
    f: (a: NoInfer<A>) => X,
  ): <E, R>(
    self: Effect<A, E, R>,
  ) => [X] extends [Effect<infer _A1, infer E1, infer R1>]
    ? Effect<A, E | E1, R | R1>
    : Effect<A, E, R>
  <X>(
    f: NotFunction<X>,
  ): <A, E, R>(
    self: Effect<A, E, R>,
  ) => [X] extends [Effect<infer _A1, infer E1, infer R1>]
    ? Effect<A, E | E1, R | R1>
    : Effect<A, E, R>
  <A, E, R, X>(
    self: Effect<A, E, R>,
    f: (a: NoInfer<A>) => X,
  ): [X] extends [Effect<infer _A1, infer E1, infer R1>]
    ? Effect<A, E | E1, R | R1>
    : Effect<A, E, R>
  <A, E, R, X>(
    self: Effect<A, E, R>,
    f: NotFunction<X>,
  ): [X] extends [Effect<infer _A1, infer E1, infer R1>]
    ? Effect<A, E | E1, R | R1>
    : Effect<A, E, R>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    f: (a: A) => Effect<B, E2, R2>,
  ): Effect<A, E | E2, R | R2> =>
    flatMap(self, (a) => {
      const value = isEffect(f) ? f : typeof f === "function" ? f(a) : f
      return isEffect(value) ? as(value, a) : succeed(a)
    }),
)

/**
 * Replace the success value of the `Effect` effect with `void`.
 *
 * @since 3.4.0
 * @experimental
 * @category mapping & sequencing
 */
export const asVoid = <A, E, R>(self: Effect<A, E, R>): Effect<void, E, R> =>
  flatMap(self, (_) => exitVoid)

/**
 * Access the `Exit` of the given `Effect` effect.
 *
 * @since 3.4.6
 * @experimental
 * @category mapping & sequencing
 */
export const exit = <A, E, R>(
  self: Effect<A, E, R>,
): Effect<Exit<A, E>, never, R> =>
  matchCause(self, {
    onFailure: exitFailCause,
    onSuccess: exitSucceed,
  })

/**
 * Replace the error type of the given `Effect` with the full `Cause` object.
 *
 * @since 3.4.0
 * @experimental
 * @category mapping & sequencing
 */
export const sandbox = <A, E, R>(
  self: Effect<A, E, R>,
): Effect<A, Cause<E>, R> => catchAllCause(self, fail)

/**
 * Returns an effect that races all the specified effects,
 * yielding the value of the first effect to succeed with a value. Losers of
 * the race will be interrupted immediately
 *
 * @since 3.4.0
 * @experimental
 * @category sequencing
 */
export const raceAll = <Eff extends Effect<any, any, any>>(
  all: Iterable<Eff>,
): Effect<Effect.Success<Eff>, Effect.Error<Eff>, Effect.Context<Eff>> =>
  withFiber((parent) =>
    async((resume) => {
      const effects = Arr.fromIterable(all)
      const len = effects.length
      let doneCount = 0
      let done = false
      const fibers = new Set<Fiber<any, any>>()
      const causes: Array<Cause<any>> = []
      const onExit = (exit: Exit<any, any>) => {
        doneCount++
        if (exit._tag === "Failure") {
          causes.push(exit.cause)
          if (doneCount >= len) {
            resume(failCause(causes[0]))
          }
          return
        }
        done = true
        resume(
          fibers.size === 0
            ? exit
            : flatMap(uninterruptible(fiberInterruptAll(fibers)), () => exit),
        )
      }

      for (let i = 0; i < len; i++) {
        if (done) break
        const fiber = unsafeFork(parent, interruptible(effects[i]), true, true)
        fibers.add(fiber)
        fiber.addObserver((exit) => {
          fibers.delete(fiber)
          onExit(exit)
        })
      }

      return fiberInterruptAll(fibers)
    }),
  )

/**
 * Returns an effect that races all the specified effects,
 * yielding the value of the first effect to succeed or fail. Losers of
 * the race will be interrupted immediately.
 *
 * @since 3.4.0
 * @experimental
 * @category sequencing
 */
export const raceAllFirst = <Eff extends Effect<any, any, any>>(
  all: Iterable<Eff>,
): Effect<Effect.Success<Eff>, Effect.Error<Eff>, Effect.Context<Eff>> =>
  withFiber((parent) =>
    async((resume) => {
      let done = false
      const fibers = new Set<Fiber<any, any>>()
      const onExit = (exit: Exit<any, any>) => {
        done = true
        resume(
          fibers.size === 0
            ? exit
            : flatMap(fiberInterruptAll(fibers), () => exit),
        )
      }

      for (const effect of all) {
        if (done) break
        const fiber = unsafeFork(parent, interruptible(effect), true, true)
        fibers.add(fiber)
        fiber.addObserver((exit) => {
          fibers.delete(fiber)
          onExit(exit)
        })
      }

      return fiberInterruptAll(fibers)
    }),
  )

/**
 * Returns an effect that races two effects, yielding the value of the first
 * effect to succeed. Losers of the race will be interrupted immediately.
 *
 * @since 3.4.0
 * @experimental
 * @category sequencing
 */
export const race: {
  <A2, E2, R2>(
    that: Effect<A2, E2, R2>,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A | A2, E | E2, R | R2>
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    that: Effect<A2, E2, R2>,
  ): Effect<A | A2, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    that: Effect<A2, E2, R2>,
  ): Effect<A | A2, E | E2, R | R2> => raceAll([self, that]),
)

/**
 * Returns an effect that races two effects, yielding the value of the first
 * effect to succeed *or* fail. Losers of the race will be interrupted immediately.
 *
 * @since 3.4.0
 * @experimental
 * @category sequencing
 */
export const raceFirst: {
  <A2, E2, R2>(
    that: Effect<A2, E2, R2>,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A | A2, E | E2, R | R2>
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    that: Effect<A2, E2, R2>,
  ): Effect<A | A2, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    that: Effect<A2, E2, R2>,
  ): Effect<A | A2, E | E2, R | R2> => raceAllFirst([self, that]),
)

/**
 * Map the success value of this `Effect` effect to another `Effect` effect, then
 * flatten the result.
 *
 * @since 3.4.0
 * @experimental
 * @category mapping & sequencing
 */
export const flatMap: {
  <A, B, E2, R2>(
    f: (a: A) => Effect<B, E2, R2>,
  ): <E, R>(self: Effect<A, E, R>) => Effect<B, E | E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    f: (a: A) => Effect<B, E2, R2>,
  ): Effect<B, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    f: (a: A) => Effect<B, E2, R2>,
  ): Effect<B, E | E2, R | R2> => {
    const onSuccess = Object.create(OnSuccessProto)
    onSuccess[args] = self
    onSuccess[successCont] = f
    return onSuccess
  },
)
const OnSuccessProto = makePrimitiveProto({
  op: "OnSuccess",
  eval(this: any, fiber: FiberImpl): Primitive {
    fiber._stack.push(this)
    return this[args]
  },
})

// ----------------------------------------------------------------------------
// mapping & sequencing
// ----------------------------------------------------------------------------

/**
 * Flattens any nested `Effect` effects, merging the error and requirement types.
 *
 * @since 3.4.0
 * @experimental
 * @category mapping & sequencing
 */
export const flatten = <A, E, R, E2, R2>(
  self: Effect<Effect<A, E, R>, E2, R2>,
): Effect<A, E | E2, R | R2> => flatMap(self, identity)

/**
 * Transforms the success value of the `Effect` effect with the specified
 * function.
 *
 * @since 3.4.0
 * @experimental
 * @category mapping & sequencing
 */
export const map: {
  <A, B>(f: (a: A) => B): <E, R>(self: Effect<A, E, R>) => Effect<B, E, R>
  <A, E, R, B>(self: Effect<A, E, R>, f: (a: A) => B): Effect<B, E, R>
} = dual(
  2,
  <A, E, R, B>(self: Effect<A, E, R>, f: (a: A) => B): Effect<B, E, R> =>
    flatMap(self, (a) => succeed(f(a))),
)

// ----------------------------------------------------------------------------
// Exit
// ----------------------------------------------------------------------------

/** @internal */
export const isExit = (u: unknown): u is Exit.Exit<unknown, unknown> =>
  hasProperty(u, ExitTypeId)

/** @internal */
export const exitSucceed: <A>(a: A) => Exit.Exit<A> = succeed as any

/** @internal */
export const exitFailCause: <E>(cause: Cause.Cause<E>) => Exit.Exit<never, E> =
  failCause as any

/** @internal */
export const exitInterrupt: Exit.Exit<never> = exitFailCause(causeInterrupt)

/** @internal */
export const exitFail = <E>(e: E): Exit.Exit<never, E> =>
  exitFailCause(causeFail(e))

/** @internal */
export const exitDie = (defect: unknown): Exit.Exit<never> =>
  exitFailCause(causeDie(defect))

/** @internal */
export const exitIsSuccess = <A, E>(
  self: Exit.Exit<A, E>,
): self is Exit.Success<A, E> => self._tag === "Success"

/** @internal */
export const exitIsFailure = <A, E>(
  self: Exit.Exit<A, E>,
): self is Exit.Failure<A, E> => self._tag === "Failure"

/** @internal */
export const exitVoid: Exit.Exit<void> = exitSucceed(void 0)

/** @internal */
export const exitVoidAll = <I extends Iterable<Exit.Exit<any, any>>>(
  exits: I,
): Exit.Exit<
  void,
  I extends Iterable<Exit.Exit<infer _A, infer _E>> ? _E : never
> => {
  for (const exit of exits) {
    if (exit._tag === "Failure") {
      return exit
    }
  }
  return exitVoid
}

// ----------------------------------------------------------------------------
// scheduler
// ----------------------------------------------------------------------------

/**
 * @since 3.5.9
 * @experimental
 * @category scheduler
 */
export interface EffectScheduler {
  readonly scheduleTask: (task: () => void, priority: number) => void
  readonly shouldYield: (fiber: Fiber<unknown, unknown>) => boolean
  readonly flush: () => void
}

const setImmediate =
  "setImmediate" in globalThis
    ? globalThis.setImmediate
    : (f: () => void) => setTimeout(f, 0)

/**
 * @since 3.5.9
 * @experimental
 * @category scheduler
 */
export class EffectSchedulerDefault implements EffectScheduler {
  private tasks: Array<() => void> = []
  private running = false

  /**
   * @since 3.5.9
   */
  scheduleTask(task: () => void, _priority: number) {
    this.tasks.push(task)
    if (!this.running) {
      this.running = true
      setImmediate(this.afterScheduled)
    }
  }

  /**
   * @since 3.5.9
   */
  afterScheduled = () => {
    this.running = false
    this.runTasks()
  }

  /**
   * @since 3.5.9
   */
  runTasks() {
    const tasks = this.tasks
    this.tasks = []
    for (let i = 0, len = tasks.length; i < len; i++) {
      tasks[i]()
    }
  }

  /**
   * @since 3.5.9
   */
  shouldYield(fiber: Fiber<unknown, unknown>) {
    return fiber.currentOpCount >= fiber.getRef(MaxOpsBeforeYield)
  }

  /**
   * @since 3.5.9
   */
  flush() {
    while (this.tasks.length > 0) {
      this.runTasks()
    }
  }
}

/**
 * Access the given `Context.Tag` from the environment.
 *
 * @since 3.4.0
 * @experimental
 * @category environment
 */
export const service: {
  <I, S>(tag: Context.Reference<I, S>): Effect<S>
  <I, S>(tag: Context.Tag<I, S>): Effect<S, never, I>
} = (<I, S>(tag: Context.Tag<I, S>): Effect<S, never, I> =>
  withFiber((fiber) => succeed(Context.unsafeGet(fiber.context, tag)))) as any

/**
 * Access the given `Context.Tag` from the environment, without tracking the
 * dependency at the type level.
 *
 * It will return an `Option` of the service, depending on whether it is
 * available in the environment or not.
 *
 * @since 3.4.0
 * @experimental
 * @category environment
 */
export const serviceOption = <I, S>(
  tag: Context.Tag<I, S>,
): Effect<Option.Option<S>> =>
  withFiber((fiber) => succeed(Context.getOption(fiber.context, tag)))

/**
 * Update the Context with the given mapping function.
 *
 * @since 3.11.0
 * @experimental
 * @category environment
 */
export const updateContext: {
  <R2, R>(
    f: (context: Context.Context<R2>) => Context.Context<NoInfer<R>>,
  ): <A, E>(self: Effect<A, E, R>) => Effect<A, E, R2>
  <A, E, R, R2>(
    self: Effect<A, E, R>,
    f: (context: Context.Context<R2>) => Context.Context<NoInfer<R>>,
  ): Effect<A, E, R2>
} = dual(
  2,
  <A, E, R, R2>(
    self: Effect<A, E, R>,
    f: (context: Context.Context<R2>) => Context.Context<NoInfer<R>>,
  ): Effect<A, E, R2> =>
    withFiber<A, E, R2>((fiber) => {
      const prev = fiber.context as Context.Context<R2>
      fiber.context = f(prev)
      return onExit(self as any, () => {
        fiber.context = prev
        return void_
      })
    }),
)

/**
 * Update the service for the given `Context.Tag` in the environment.
 *
 * @since 3.11.0
 * @experimental
 * @category environment
 */
export const updateService: {
  <I, A>(
    tag: Context.Reference<I, A>,
    f: (value: A) => A,
  ): <XA, E, R>(self: Effect<XA, E, R>) => Effect<XA, E, R>
  <I, A>(
    tag: Context.Tag<I, A>,
    f: (value: A) => A,
  ): <XA, E, R>(self: Effect<XA, E, R>) => Effect<XA, E, R | I>
  <XA, E, R, I, A>(
    self: Effect<XA, E, R>,
    tag: Context.Reference<I, A>,
    f: (value: A) => A,
  ): Effect<XA, E, R>
  <XA, E, R, I, A>(
    self: Effect<XA, E, R>,
    tag: Context.Tag<I, A>,
    f: (value: A) => A,
  ): Effect<XA, E, R | I>
} = dual(
  3,
  <XA, E, R, I, A>(
    self: Effect<XA, E, R>,
    tag: Context.Reference<I, A>,
    f: (value: A) => A,
  ): Effect<XA, E, R> =>
    withFiber((fiber) => {
      const prev = Context.unsafeGet(fiber.context, tag)
      fiber.context = Context.add(fiber.context, tag, f(prev))
      return onExit(self, () => {
        fiber.context = Context.add(fiber.context, tag, prev)
        return void_
      })
    }),
)

/**
 * Access the current `Context` from the environment.
 *
 * @since 3.4.0
 * @experimental
 * @category environment
 */
export const context = <R>(): Effect<Context.Context<R>> => getContext as any
const getContext = withFiber((fiber) => succeed(fiber.context))

/**
 * Merge the given `Context` with the current context.
 *
 * @since 3.4.0
 * @experimental
 * @category environment
 */
export const provideContext: {
  <XR>(
    context: Context.Context<XR>,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, XR>>
  <A, E, R, XR>(
    self: Effect<A, E, R>,
    context: Context.Context<XR>,
  ): Effect<A, E, Exclude<R, XR>>
} = dual(
  2,
  <A, E, R, XR>(
    self: Effect<A, E, R>,
    provided: Context.Context<XR>,
  ): Effect<A, E, Exclude<R, XR>> =>
    updateContext(self, Context.merge(provided)) as any,
)

/**
 * Add the provided service to the current context.
 *
 * @since 3.4.0
 * @experimental
 * @category environment
 */
export const provideService: {
  <I, S>(
    tag: Context.Tag<I, S>,
    service: S,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, I>>
  <A, E, R, I, S>(
    self: Effect<A, E, R>,
    tag: Context.Tag<I, S>,
    service: S,
  ): Effect<A, E, Exclude<R, I>>
} = dual(
  3,
  <A, E, R, I, S>(
    self: Effect<A, E, R>,
    tag: Context.Tag<I, S>,
    service: S,
  ): Effect<A, E, Exclude<R, I>> =>
    updateContext(self, Context.add(tag, service)) as any,
)

/**
 * Create a service using the provided `Effect` effect, and add it to the
 * current context.
 *
 * @since 3.4.6
 * @experimental
 * @category environment
 */
export const provideServiceEffect: {
  <I, S, E2, R2>(
    tag: Context.Tag<I, S>,
    acquire: Effect<S, E2, R2>,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E | E2, Exclude<R, I> | R2>
  <A, E, R, I, S, E2, R2>(
    self: Effect<A, E, R>,
    tag: Context.Tag<I, S>,
    acquire: Effect<S, E2, R2>,
  ): Effect<A, E | E2, Exclude<R, I> | R2>
} = dual(
  3,
  <A, E, R, I, S, E2, R2>(
    self: Effect<A, E, R>,
    tag: Context.Tag<I, S>,
    acquire: Effect<S, E2, R2>,
  ): Effect<A, E | E2, Exclude<R, I> | R2> =>
    flatMap(acquire, (service) => provideService(self, tag, service)),
)

// ========================================================================
// References
// ========================================================================

/**
 * @since 3.11.0
 * @experimental
 * @category references
 */
export class MaxOpsBeforeYield extends Context.Reference<MaxOpsBeforeYield>()<
  "effect/Effect/currentMaxOpsBeforeYield",
  number
>("effect/Effect/currentMaxOpsBeforeYield", { defaultValue: () => 2048 }) {}

/**
 * @since 3.11.0
 * @experimental
 * @category environment refs
 */
export class CurrentConcurrency extends Context.Reference<CurrentConcurrency>()<
  "effect/Effect/currentConcurrency",
  "unbounded" | number
>("effect/Effect/currentConcurrency", { defaultValue: () => "unbounded" }) {}

/**
 * @since 3.11.0
 * @experimental
 * @category environment refs
 */
export class CurrentScheduler extends Context.Reference<CurrentScheduler>()<
  "effect/Effect/currentScheduler",
  EffectScheduler
>("effect/Effect/currentScheduler", {
  defaultValue: () => new EffectSchedulerDefault(),
}) {}

/**
 * If you have a `Effect` that uses `concurrency: "inherit"`, you can use this
 * api to control the concurrency of that `Effect` when it is run.
 *
 * @example
 * ```ts
 * import * as Effect from "effect/Effect"
 *
 * Effect.forEach([1, 2, 3], (n) => Effect.succeed(n), {
 *   concurrency: "inherit"
 * }).pipe(
 *   Effect.withConcurrency(2) // use a concurrency of 2
 * )
 * ```
 *
 * @since 3.4.0
 * @experimental
 * @category environment refs
 */
export const withConcurrency: {
  (
    concurrency: "unbounded" | number,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    concurrency: "unbounded" | number,
  ): Effect<A, E, R>
} = dual(
  2,
  <A, E, R>(
    self: Effect<A, E, R>,
    concurrency: "unbounded" | number,
  ): Effect<A, E, R> => provideService(self, CurrentConcurrency, concurrency),
)

// ----------------------------------------------------------------------------
// zipping
// ----------------------------------------------------------------------------

/**
 * Combine two `Effect` effects into a single effect that produces a tuple of
 * their results.
 *
 * @since 3.4.0
 * @experimental
 * @category zipping
 */
export const zip: {
  <A2, E2, R2>(
    that: Effect<A2, E2, R2>,
    options?: { readonly concurrent?: boolean | undefined } | undefined,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<[A, A2], E2 | E, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    that: Effect<A2, E2, R2>,
    options?: { readonly concurrent?: boolean | undefined },
  ): Effect<[A, A2], E | E2, R | R2>
} = dual(
  (args) => isEffect(args[1]),
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    that: Effect<A2, E2, R2>,
    options?: { readonly concurrent?: boolean | undefined },
  ): Effect<[A, A2], E | E2, R | R2> =>
    zipWith(self, that, (a, a2) => [a, a2], options),
)

/**
 * The `Effect.zipWith` function combines two `Effect` effects and allows you to
 * apply a function to the results of the combined effects, transforming them
 * into a single value.
 *
 * @since 3.4.3
 * @experimental
 * @category zipping
 */
export const zipWith: {
  <A2, E2, R2, A, B>(
    that: Effect<A2, E2, R2>,
    f: (a: A, b: A2) => B,
    options?: { readonly concurrent?: boolean | undefined },
  ): <E, R>(self: Effect<A, E, R>) => Effect<B, E2 | E, R2 | R>
  <A, E, R, A2, E2, R2, B>(
    self: Effect<A, E, R>,
    that: Effect<A2, E2, R2>,
    f: (a: A, b: A2) => B,
    options?: { readonly concurrent?: boolean | undefined },
  ): Effect<B, E2 | E, R2 | R>
} = dual(
  (args) => isEffect(args[1]),
  <A, E, R, A2, E2, R2, B>(
    self: Effect<A, E, R>,
    that: Effect<A2, E2, R2>,
    f: (a: A, b: A2) => B,
    options?: { readonly concurrent?: boolean | undefined },
  ): Effect<B, E2 | E, R2 | R> =>
    options?.concurrent
      ? // Use `all` exclusively for concurrent cases, as it introduces additional overhead due to the management of concurrency
        map(all([self, that], { concurrency: 2 }), ([a, a2]) => f(a, a2))
      : flatMap(self, (a) => map(that, (a2) => f(a, a2))),
)

// ----------------------------------------------------------------------------
// filtering & conditionals
// ----------------------------------------------------------------------------

/**
 * Filter the specified effect with the provided function, failing with specified
 * `Cause` if the predicate fails.
 *
 * In addition to the filtering capabilities discussed earlier, you have the option to further
 * refine and narrow down the type of the success channel by providing a
 *
 * @since 3.4.0
 * @experimental
 * @category filtering & conditionals
 */
export const filterOrFailCause: {
  <A, B extends A, E2>(
    refinement: Refinement<A, B>,
    orFailWith: (a: NoInfer<A>) => Cause<E2>,
  ): <E, R>(self: Effect<A, E, R>) => Effect<B, E2 | E, R>
  <A, E2>(
    predicate: Predicate<NoInfer<A>>,
    orFailWith: (a: NoInfer<A>) => Cause<E2>,
  ): <E, R>(self: Effect<A, E, R>) => Effect<A, E2 | E, R>
  <A, E, R, B extends A, E2>(
    self: Effect<A, E, R>,
    refinement: Refinement<A, B>,
    orFailWith: (a: A) => Cause<E2>,
  ): Effect<B, E | E2, R>
  <A, E, R, E2>(
    self: Effect<A, E, R>,
    predicate: Predicate<A>,
    orFailWith: (a: A) => Cause<E2>,
  ): Effect<A, E | E2, R>
} = dual(
  (args) => isEffect(args[0]),
  <A, E, R, B extends A, E2>(
    self: Effect<A, E, R>,
    refinement: Refinement<A, B>,
    orFailWith: (a: A) => Cause<E2>,
  ): Effect<B, E | E2, R> =>
    flatMap(self, (a) =>
      refinement(a) ? succeed(a) : failCause(orFailWith(a)),
    ),
)

/**
 * Filter the specified effect with the provided function, failing with specified
 * error if the predicate fails.
 *
 * In addition to the filtering capabilities discussed earlier, you have the option to further
 * refine and narrow down the type of the success channel by providing a
 *
 * @since 3.4.0
 * @experimental
 * @category filtering & conditionals
 */
export const filterOrFail: {
  <A, B extends A, E2>(
    refinement: Refinement<A, B>,
    orFailWith: (a: NoInfer<A>) => E2,
  ): <E, R>(self: Effect<A, E, R>) => Effect<B, E2 | E, R>
  <A, E2>(
    predicate: Predicate<NoInfer<A>>,
    orFailWith: (a: NoInfer<A>) => E2,
  ): <E, R>(self: Effect<A, E, R>) => Effect<A, E2 | E, R>
  <A, E, R, B extends A, E2>(
    self: Effect<A, E, R>,
    refinement: Refinement<A, B>,
    orFailWith: (a: A) => E2,
  ): Effect<B, E | E2, R>
  <A, E, R, E2>(
    self: Effect<A, E, R>,
    predicate: Predicate<A>,
    orFailWith: (a: A) => E2,
  ): Effect<A, E | E2, R>
} = dual(
  (args) => isEffect(args[0]),
  <A, E, R, B extends A, E2>(
    self: Effect<A, E, R>,
    refinement: Refinement<A, B>,
    orFailWith: (a: A) => E2,
  ): Effect<B, E | E2, R> =>
    flatMap(self, (a) => (refinement(a) ? succeed(a) : fail(orFailWith(a)))),
)

/**
 * The moral equivalent of `if (p) exp`.
 *
 * @since 3.4.0
 * @experimental
 * @category filtering & conditionals
 */
export const when: {
  <E2 = never, R2 = never>(
    condition: LazyArg<boolean> | Effect<boolean, E2, R2>,
  ): <A, E, R>(
    self: Effect<A, E, R>,
  ) => Effect<Option.Option<A>, E | E2, R | R2>
  <A, E, R, E2 = never, R2 = never>(
    self: Effect<A, E, R>,
    condition: LazyArg<boolean> | Effect<boolean, E2, R2>,
  ): Effect<Option.Option<A>, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, E2 = never, R2 = never>(
    self: Effect<A, E, R>,
    condition: LazyArg<boolean> | Effect<boolean, E2, R2>,
  ): Effect<Option.Option<A>, E | E2, R | R2> =>
    flatMap(isEffect(condition) ? condition : sync(condition), (pass) =>
      pass ? asSome(self) : succeedNone,
    ),
)

// ----------------------------------------------------------------------------
// repetition
// ----------------------------------------------------------------------------

/**
 * Repeat the given `Effect` using the provided options.
 *
 * The `while` predicate will be checked after each iteration, and can use the
 * fall `Exit` of the effect to determine if the repetition should continue.
 *
 * @since 3.4.6
 * @experimental
 * @category repetition
 */
export const repeatExit: {
  <A, E>(options: {
    while: Predicate<Exit<A, E>>
    times?: number | undefined
    schedule?: EffectSchedule | undefined
  }): <R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    options: {
      while: Predicate<Exit<A, E>>
      times?: number | undefined
      schedule?: EffectSchedule | undefined
    },
  ): Effect<A, E, R>
} = dual(
  2,
  <A, E, R>(
    self: Effect<A, E, R>,
    options: {
      while: Predicate<Exit<A, E>>
      times?: number | undefined
      schedule?: EffectSchedule | undefined
    },
  ): Effect<A, E, R> =>
    suspend(() => {
      const startedAt = options.schedule ? Date.now() : 0
      let attempt = 0

      const loop: Effect<A, E, R> = flatMap(exit(self), (exit) => {
        if (options.while !== undefined && !options.while(exit)) {
          return exit
        } else if (options.times !== undefined && attempt >= options.times) {
          return exit
        }
        attempt++
        let delayEffect = yieldNow
        if (options.schedule !== undefined) {
          const elapsed = Date.now() - startedAt
          const duration = options.schedule(attempt, elapsed)
          if (Option.isNone(duration)) {
            return exit
          }
          delayEffect = sleep(duration.value)
        }
        return flatMap(delayEffect, () => loop)
      })

      return loop
    }),
)

/**
 * Repeat the given `Effect` effect using the provided options. Only successful
 * results will be repeated.
 *
 * @since 3.4.0
 * @experimental
 * @category repetition
 */
export const repeat: {
  <A, E>(
    options?:
      | {
          while?: Predicate<A> | undefined
          times?: number | undefined
          schedule?: EffectSchedule | undefined
        }
      | undefined,
  ): <R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    options?:
      | {
          while?: Predicate<A> | undefined
          times?: number | undefined
          schedule?: EffectSchedule | undefined
        }
      | undefined,
  ): Effect<A, E, R>
} = dual(
  (args) => isEffect(args[0]),
  <A, E, R>(
    self: Effect<A, E, R>,
    options?:
      | {
          while?: Predicate<A> | undefined
          times?: number | undefined
          schedule?: EffectSchedule | undefined
        }
      | undefined,
  ): Effect<A, E, R> =>
    repeatExit(self, {
      ...options,
      while: (exit) =>
        exit._tag === "Success" &&
        (options?.while === undefined || options.while(exit.value)),
    }),
)

/**
 * Replicates the given effect `n` times.
 *
 * @since 3.11.0
 * @experimental
 * @category repetition
 */
export const replicate: {
  (n: number): <A, E, R>(self: Effect<A, E, R>) => Array<Effect<A, E, R>>
  <A, E, R>(self: Effect<A, E, R>, n: number): Array<Effect<A, E, R>>
} = dual(
  2,
  <A, E, R>(self: Effect<A, E, R>, n: number): Array<Effect<A, E, R>> =>
    Array.from({ length: n }, () => self),
)

/**
 * Performs this effect the specified number of times and collects the
 * results.
 *
 * @since 3.11.0
 * @category repetition
 */
export const replicateEffect: {
  (
    n: number,
    options?: {
      readonly concurrency?: Concurrency | undefined
      readonly discard?: false | undefined
    },
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<Array<A>, E, R>
  (
    n: number,
    options: {
      readonly concurrency?: Concurrency | undefined
      readonly discard: true
    },
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<void, E, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    n: number,
    options?: {
      readonly concurrency?: Concurrency | undefined
      readonly discard?: false | undefined
    },
  ): Effect<Array<A>, E, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    n: number,
    options: {
      readonly concurrency?: Concurrency | undefined
      readonly discard: true
    },
  ): Effect<void, E, R>
} = dual(
  (args) => isEffect(args[0]),
  <A, E, R>(
    self: Effect<A, E, R>,
    n: number,
    options: {
      readonly concurrency?: Concurrency | undefined
      readonly discard: true
    },
  ): Effect<void, E, R> => all(replicate(self, n), options),
)

/**
 * Repeat the given `Effect` effect forever, only stopping if the effect fails.
 *
 * @since 3.4.0
 * @experimental
 * @category repetition
 */
export const forever = <A, E, R>(self: Effect<A, E, R>): Effect<never, E, R> =>
  repeat(self) as any

// ----------------------------------------------------------------------------
// scheduling
// ----------------------------------------------------------------------------

/**
 * The `EffectSchedule` type represents a function that can be used to calculate
 * the delay between repeats.
 *
 * The function takes the current attempt number and the elapsed time since the
 * first attempt, and returns the delay for the next attempt. If the function
 * returns `None`, the repetition will stop.
 *
 * @since 3.4.6
 * @experimental
 * @category scheduling
 */
export type EffectSchedule = (
  attempt: number,
  elapsed: number,
) => Option.Option<number>

/**
 * Create a `EffectSchedule` that will stop repeating after the specified number
 * of attempts.
 *
 * @since 3.4.6
 * @experimental
 * @category scheduling
 */
export const scheduleRecurs =
  (n: number): EffectSchedule =>
  (attempt) =>
    attempt <= n ? Option.some(0) : Option.none()

/**
 * Create a `EffectSchedule` that will generate a constant delay.
 *
 * @since 3.4.6
 * @experimental
 * @category scheduling
 */
export const scheduleSpaced =
  (millis: number): EffectSchedule =>
  () =>
    Option.some(millis)

/**
 * Create a `EffectSchedule` that will generate a delay with an exponential backoff.
 *
 * @since 3.4.6
 * @experimental
 * @category scheduling
 */
export const scheduleExponential =
  (baseMillis: number, factor = 2): EffectSchedule =>
  (attempt) =>
    Option.some(Math.pow(factor, attempt) * baseMillis)

/**
 * Returns a new `EffectSchedule` with an added calculated delay to each delay
 * returned by this schedule.
 *
 * @since 3.4.6
 * @experimental
 * @category scheduling
 */
export const scheduleAddDelay: {
  (f: () => number): (self: EffectSchedule) => EffectSchedule
  (self: EffectSchedule, f: () => number): EffectSchedule
} = dual(
  2,
  (self: EffectSchedule, f: () => number): EffectSchedule =>
    (attempt, elapsed) =>
      Option.map(self(attempt, elapsed), (duration) => duration + f()),
)

/**
 * Transform a `EffectSchedule` to one that will have a delay that will never exceed
 * the specified maximum.
 *
 * @since 3.4.6
 * @experimental
 * @category scheduling
 */
export const scheduleWithMaxDelay: {
  (max: number): (self: EffectSchedule) => EffectSchedule
  (self: EffectSchedule, max: number): EffectSchedule
} = dual(
  2,
  (self: EffectSchedule, max: number): EffectSchedule =>
    (attempt, elapsed) =>
      Option.map(self(attempt, elapsed), (duration) => Math.min(duration, max)),
)

/**
 * Transform a `EffectSchedule` to one that will stop repeating after the specified
 * amount of time.
 *
 * @since 3.4.6
 * @experimental
 * @category scheduling
 */
export const scheduleWithMaxElapsed: {
  (max: number): (self: EffectSchedule) => EffectSchedule
  (self: EffectSchedule, max: number): EffectSchedule
} = dual(
  2,
  (self: EffectSchedule, max: number): EffectSchedule =>
    (attempt, elapsed) =>
      elapsed < max ? self(attempt, elapsed) : Option.none(),
)

/**
 * Combines two `EffectSchedule`s, by recurring if either schedule wants to
 * recur, using the minimum of the two durations between recurrences.
 *
 * @since 3.4.6
 * @experimental
 * @category scheduling
 */
export const scheduleUnion: {
  (that: EffectSchedule): (self: EffectSchedule) => EffectSchedule
  (self: EffectSchedule, that: EffectSchedule): EffectSchedule
} = dual(
  2,
  (self: EffectSchedule, that: EffectSchedule): EffectSchedule =>
    (attempt, elapsed) =>
      Option.zipWith(self(attempt, elapsed), that(attempt, elapsed), (d1, d2) =>
        Math.min(d1, d2),
      ),
)

/**
 * Combines two `EffectSchedule`s, by recurring only if both schedules want to
 * recur, using the maximum of the two durations between recurrences.
 *
 * @since 3.4.6
 * @experimental
 * @category scheduling
 */
export const scheduleIntersect: {
  (that: EffectSchedule): (self: EffectSchedule) => EffectSchedule
  (self: EffectSchedule, that: EffectSchedule): EffectSchedule
} = dual(
  2,
  (self: EffectSchedule, that: EffectSchedule): EffectSchedule =>
    (attempt, elapsed) =>
      Option.zipWith(self(attempt, elapsed), that(attempt, elapsed), (d1, d2) =>
        Math.max(d1, d2),
      ),
)

// ----------------------------------------------------------------------------
// error handling
// ----------------------------------------------------------------------------

/**
 * Catch the full `Cause` object of the given `Effect` effect, allowing you to
 * recover from any kind of cause.
 *
 * @since 3.4.6
 * @experimental
 * @category error handling
 */
export const catchAllCause: {
  <E, B, E2, R2>(
    f: (cause: NoInfer<Cause<E>>) => Effect<B, E2, R2>,
  ): <A, R>(self: Effect<A, E, R>) => Effect<A | B, E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    f: (cause: NoInfer<Cause<E>>) => Effect<B, E2, R2>,
  ): Effect<A | B, E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    f: (cause: NoInfer<Cause<E>>) => Effect<B, E2, R2>,
  ): Effect<A | B, E2, R | R2> => {
    const onFailure = Object.create(OnFailureProto)
    onFailure[args] = self
    onFailure[failureCont] = f
    return onFailure
  },
)
const OnFailureProto = makePrimitiveProto({
  op: "OnFailure",
  eval(this: any, fiber: FiberImpl): Primitive {
    fiber._stack.push(this as any)
    return this[args]
  },
})

/**
 * Selectively catch a `Cause` object of the given `Effect` effect,
 * using the provided predicate to determine if the failure should be caught.
 *
 * @since 3.4.6
 * @experimental
 * @category error handling
 */
export const catchCauseIf: {
  <E, B, E2, R2, EB extends Cause<E>>(
    refinement: Refinement<Cause<E>, EB>,
    f: (cause: EB) => Effect<B, E2, R2>,
  ): <A, R>(
    self: Effect<A, E, R>,
  ) => Effect<A | B, Exclude<E, Cause.Error<EB>> | E2, R | R2>
  <E, B, E2, R2>(
    predicate: Predicate<Cause<NoInfer<E>>>,
    f: (cause: NoInfer<Cause<E>>) => Effect<B, E2, R2>,
  ): <A, R>(self: Effect<A, E, R>) => Effect<A | B, E | E2, R | R2>
  <A, E, R, B, E2, R2, EB extends Cause<E>>(
    self: Effect<A, E, R>,
    refinement: Refinement<Cause<E>, EB>,
    f: (cause: EB) => Effect<B, E2, R2>,
  ): Effect<A | B, Exclude<E, Cause.Error<EB>> | E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    predicate: Predicate<Cause<NoInfer<E>>>,
    f: (cause: NoInfer<Cause<E>>) => Effect<B, E2, R2>,
  ): Effect<A | B, E | E2, R | R2>
} = dual(
  3,
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    predicate: Predicate<Cause<E>>,
    f: (cause: Cause<E>) => Effect<B, E2, R2>,
  ): Effect<A | B, E | E2, R | R2> =>
    catchAllCause(self, (cause) =>
      predicate(cause) ? f(cause) : (failCause(cause) as any),
    ),
)

/**
 * Catch the error of the given `Effect` effect, allowing you to recover from it.
 *
 * It only catches expected errors.
 *
 * @since 3.4.6
 * @experimental
 * @category error handling
 */
export const catchAll: {
  <E, B, E2, R2>(
    f: (e: NoInfer<E>) => Effect<B, E2, R2>,
  ): <A, R>(self: Effect<A, E, R>) => Effect<A | B, E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    f: (e: NoInfer<E>) => Effect<B, E2, R2>,
  ): Effect<A | B, E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    f: (a: NoInfer<E>) => Effect<B, E2, R2>,
  ): Effect<A | B, E2, R | R2> =>
    catchCauseIf(self, causeIsFail, (cause) => f(cause.error)),
)

/**
 * Catch any unexpected errors of the given `Effect` effect, allowing you to recover from them.
 *
 * @since 3.4.6
 * @experimental
 * @category error handling
 */
export const catchAllDefect: {
  <E, B, E2, R2>(
    f: (defect: unknown) => Effect<B, E2, R2>,
  ): <A, R>(self: Effect<A, E, R>) => Effect<A | B, E | E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    f: (defect: unknown) => Effect<B, E2, R2>,
  ): Effect<A | B, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    f: (defect: unknown) => Effect<B, E2, R2>,
  ): Effect<A | B, E | E2, R | R2> =>
    catchCauseIf(self, causeIsDie, (die) => f(die.defect)),
)

/**
 * Perform a side effect using the full `Cause` object of the given `Effect`.
 *
 * @since 3.4.6
 * @experimental
 * @category error handling
 */
export const tapErrorCause: {
  <E, B, E2, R2>(
    f: (cause: NoInfer<Cause<E>>) => Effect<B, E2, R2>,
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E | E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    f: (cause: NoInfer<Cause<E>>) => Effect<B, E2, R2>,
  ): Effect<A, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    f: (cause: NoInfer<Cause<E>>) => Effect<B, E2, R2>,
  ): Effect<A, E | E2, R | R2> => tapErrorCauseIf(self, constTrue, f),
)

/**
 * Perform a side effect using if a `Cause` object matches the specified
 * predicate.
 *
 * @since 3.4.0
 * @experimental
 * @category error handling
 */
export const tapErrorCauseIf: {
  <E, B, E2, R2, EB extends Cause<E>>(
    refinement: Refinement<Cause<E>, EB>,
    f: (a: EB) => Effect<B, E2, R2>,
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E | E2, R | R2>
  <E, B, E2, R2>(
    predicate: (cause: NoInfer<Cause<E>>) => boolean,
    f: (a: NoInfer<Cause<E>>) => Effect<B, E2, R2>,
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E | E2, R | R2>
  <A, E, R, B, E2, R2, EB extends Cause<E>>(
    self: Effect<A, E, R>,
    refinement: Refinement<Cause<E>, EB>,
    f: (a: EB) => Effect<B, E2, R2>,
  ): Effect<A, E | E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    predicate: (cause: NoInfer<Cause<E>>) => boolean,
    f: (a: NoInfer<Cause<E>>) => Effect<B, E2, R2>,
  ): Effect<A, E | E2, R | R2>
} = dual(
  3,
  <A, E, R, B, E2, R2, EB extends Cause<E>>(
    self: Effect<A, E, R>,
    refinement: Refinement<Cause<E>, EB>,
    f: (a: EB) => Effect<B, E2, R2>,
  ): Effect<A, E | E2, R | R2> =>
    catchCauseIf(self, refinement, (cause) =>
      andThen(f(cause), failCause(cause)),
    ),
)

/**
 * Perform a side effect from expected errors of the given `Effect`.
 *
 * @since 3.4.6
 * @experimental
 * @category error handling
 */
export const tapError: {
  <E, B, E2, R2>(
    f: (e: NoInfer<E>) => Effect<B, E2, R2>,
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E | E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    f: (e: NoInfer<E>) => Effect<B, E2, R2>,
  ): Effect<A, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    f: (e: NoInfer<E>) => Effect<B, E2, R2>,
  ): Effect<A, E | E2, R | R2> =>
    tapErrorCauseIf(self, causeIsFail, (fail) => f(fail.error)),
)

/**
 * Perform a side effect from unexpected errors of the given `Effect`.
 *
 * @since 3.4.6
 * @experimental
 * @category error handling
 */
export const tapDefect: {
  <E, B, E2, R2>(
    f: (defect: unknown) => Effect<B, E2, R2>,
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E | E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    f: (defect: unknown) => Effect<B, E2, R2>,
  ): Effect<A, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    f: (defect: unknown) => Effect<B, E2, R2>,
  ): Effect<A, E | E2, R | R2> =>
    tapErrorCauseIf(self, causeIsDie, (die) => f(die.defect)),
)

/**
 * Catch any expected errors that match the specified predicate.
 *
 * @since 3.4.0
 * @experimental
 * @category error handling
 */
export const catchIf: {
  <E, EB extends E, A2, E2, R2>(
    refinement: Refinement<NoInfer<E>, EB>,
    f: (e: EB) => Effect<A2, E2, R2>,
  ): <A, R>(
    self: Effect<A, E, R>,
  ) => Effect<A2 | A, E2 | Exclude<E, EB>, R2 | R>
  <E, A2, E2, R2>(
    predicate: Predicate<NoInfer<E>>,
    f: (e: NoInfer<E>) => Effect<A2, E2, R2>,
  ): <A, R>(self: Effect<A, E, R>) => Effect<A2 | A, E | E2, R2 | R>
  <A, E, R, EB extends E, A2, E2, R2>(
    self: Effect<A, E, R>,
    refinement: Refinement<E, EB>,
    f: (e: EB) => Effect<A2, E2, R2>,
  ): Effect<A | A2, E2 | Exclude<E, EB>, R | R2>
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    predicate: Predicate<E>,
    f: (e: E) => Effect<A2, E2, R2>,
  ): Effect<A | A2, E | E2, R | R2>
} = dual(
  3,
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    predicate: Predicate<E>,
    f: (e: E) => Effect<A2, E2, R2>,
  ): Effect<A | A2, E | E2, R | R2> =>
    catchCauseIf(
      self,
      (f): f is Cause.Fail<E> => causeIsFail(f) && predicate(f.error),
      (fail) => f(fail.error),
    ),
)

/**
 * Recovers from the specified tagged error.
 *
 * @since 3.4.0
 * @experimental
 * @category error handling
 */
export const catchTag: {
  <K extends E extends { _tag: string } ? E["_tag"] : never, E, A1, E1, R1>(
    k: K,
    f: (e: Extract<E, { _tag: K }>) => Effect<A1, E1, R1>,
  ): <A, R>(
    self: Effect<A, E, R>,
  ) => Effect<A1 | A, E1 | Exclude<E, { _tag: K }>, R1 | R>
  <
    A,
    E,
    R,
    K extends E extends { _tag: string } ? E["_tag"] : never,
    R1,
    E1,
    A1,
  >(
    self: Effect<A, E, R>,
    k: K,
    f: (e: Extract<E, { _tag: K }>) => Effect<A1, E1, R1>,
  ): Effect<A | A1, E1 | Exclude<E, { _tag: K }>, R | R1>
} = dual(
  3,
  <
    A,
    E,
    R,
    K extends E extends { _tag: string } ? E["_tag"] : never,
    R1,
    E1,
    A1,
  >(
    self: Effect<A, E, R>,
    k: K,
    f: (e: Extract<E, { _tag: K }>) => Effect<A1, E1, R1>,
  ): Effect<A | A1, E1 | Exclude<E, { _tag: K }>, R | R1> =>
    catchIf(
      self,
      isTagged(k) as Refinement<E, Extract<E, { _tag: K }>>,
      f,
    ) as any,
)

/**
 * Transform the full `Cause` object of the given `Effect` effect.
 *
 * @since 3.4.6
 * @experimental
 * @category error handling
 */
export const mapErrorCause: {
  <E, E2>(
    f: (e: Cause<E>) => Cause<E2>,
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E2, R>
  <A, E, R, E2>(
    self: Effect<A, E, R>,
    f: (e: Cause<E>) => Cause<E2>,
  ): Effect<A, E2, R>
} = dual(
  2,
  <A, E, R, E2>(
    self: Effect<A, E, R>,
    f: (e: Cause<E>) => Cause<E2>,
  ): Effect<A, E2, R> => catchAllCause(self, (cause) => failCause(f(cause))),
)

/**
 * Transform any expected errors of the given `Effect` effect.
 *
 * @since 3.4.0
 * @experimental
 * @category error handling
 */
export const mapError: {
  <E, E2>(f: (e: E) => E2): <A, R>(self: Effect<A, E, R>) => Effect<A, E2, R>
  <A, E, R, E2>(self: Effect<A, E, R>, f: (e: E) => E2): Effect<A, E2, R>
} = dual(
  2,
  <A, E, R, E2>(self: Effect<A, E, R>, f: (e: E) => E2): Effect<A, E2, R> =>
    catchAll(self, (error) => fail(f(error))),
)

/**
 * Elevate any expected errors of the given `Effect` effect to unexpected errors,
 * resulting in an error type of `never`.
 *
 * @since 3.4.0
 * @experimental
 * @category error handling
 */
export const orDie = <A, E, R>(self: Effect<A, E, R>): Effect<A, never, R> =>
  catchAll(self, die)

/**
 * Recover from all errors by succeeding with the given value.
 *
 * @since 3.4.0
 * @experimental
 * @category error handling
 */
export const orElseSucceed: {
  <B>(
    f: LazyArg<B>,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A | B, never, R>
  <A, E, R, B>(self: Effect<A, E, R>, f: LazyArg<B>): Effect<A | B, never, R>
} = dual(
  2,
  <A, E, R, B>(self: Effect<A, E, R>, f: LazyArg<B>): Effect<A | B, never, R> =>
    catchAll(self, (_) => sync(f)),
)

/**
 * Ignore any expected errors of the given `Effect` effect, returning `void`.
 *
 * @since 3.4.0
 * @experimental
 * @category error handling
 */
export const ignore = <A, E, R>(
  self: Effect<A, E, R>,
): Effect<void, never, R> =>
  matchEffect(self, { onFailure: (_) => void_, onSuccess: (_) => void_ })

/**
 * Ignore any expected errors of the given `Effect` effect, returning `void`.
 *
 * @since 3.4.0
 * @experimental
 * @category error handling
 */
export const ignoreLogged = <A, E, R>(
  self: Effect<A, E, R>,
): Effect<void, never, R> =>
  matchEffect(self, {
    // eslint-disable-next-line no-console
    onFailure: (error) => sync(() => console.error(error)),
    onSuccess: (_) => void_,
  })

/**
 * Replace the success value of the given `Effect` effect with an `Option`,
 * wrapping the success value in `Some` and returning `None` if the effect fails
 * with an expected error.
 *
 * @since 3.4.0
 * @experimental
 * @category error handling
 */
export const option = <A, E, R>(
  self: Effect<A, E, R>,
): Effect<Option.Option<A>, never, R> =>
  match(self, { onFailure: Option.none, onSuccess: Option.some })

/**
 * Replace the success value of the given `Effect` effect with an `Either`,
 * wrapping the success value in `Right` and wrapping any expected errors with
 * a `Left`.
 *
 * @since 3.4.0
 * @experimental
 * @category error handling
 */
export const either = <A, E, R>(
  self: Effect<A, E, R>,
): Effect<Either.Either<A, E>, never, R> =>
  match(self, { onFailure: Either.left, onSuccess: Either.right })

/**
 * Retry the given `Effect` effect using the provided options.
 *
 * @since 3.4.0
 * @experimental
 * @category error handling
 */
export const retry: {
  <A, E>(
    options?:
      | {
          while?: Predicate<E> | undefined
          times?: number | undefined
          schedule?: EffectSchedule | undefined
        }
      | undefined,
  ): <R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    options?:
      | {
          while?: Predicate<E> | undefined
          times?: number | undefined
          schedule?: EffectSchedule | undefined
        }
      | undefined,
  ): Effect<A, E, R>
} = dual(
  (args) => isEffect(args[0]),
  <A, E, R>(
    self: Effect<A, E, R>,
    options?:
      | {
          while?: Predicate<E> | undefined
          times?: number | undefined
          schedule?: EffectSchedule | undefined
        }
      | undefined,
  ): Effect<A, E, R> =>
    repeatExit(self, {
      ...options,
      while: (exit) =>
        exit._tag === "Failure" &&
        exit.cause._tag === "Fail" &&
        (options?.while === undefined || options.while(exit.cause.error)),
    }),
)

/**
 * Add a stack trace to any failures that occur in the effect. The trace will be
 * added to the `traces` field of the `Cause` object.
 *
 * @since 3.4.0
 * @experimental
 * @category error handling
 */
export const withTrace: {
  (name: string): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R>(self: Effect<A, E, R>, name: string): Effect<A, E, R>
} = function () {
  const prevLimit = globalThis.Error.stackTraceLimit
  globalThis.Error.stackTraceLimit = 2
  const error = new globalThis.Error()
  globalThis.Error.stackTraceLimit = prevLimit
  function generate(name: string, cause: Cause<any>) {
    const stack = error.stack
    if (!stack) {
      return cause
    }
    const line = stack.split("\n")[2]?.trim().replace(/^at /, "")
    if (!line) {
      return cause
    }
    const lineMatch = line.match(/\((.*)\)$/)
    return causeWithTrace(
      cause,
      `at ${name} (${lineMatch ? lineMatch[1] : line})`,
    )
  }
  const f = (name: string) => (self: Effect<any, any, any>) =>
    onError(self, (cause) => failCause(generate(name, cause)))
  if (arguments.length === 2) {
    return f(arguments[1])(arguments[0])
  }
  return f(arguments[0])
} as any

// ----------------------------------------------------------------------------
// pattern matching
// ----------------------------------------------------------------------------

/**
 * @since 3.4.6
 * @experimental
 * @category pattern matching
 */
export const matchCauseEffect: {
  <E, A2, E2, R2, A, A3, E3, R3>(options: {
    readonly onFailure: (cause: Cause<E>) => Effect<A2, E2, R2>
    readonly onSuccess: (a: A) => Effect<A3, E3, R3>
  }): <R>(self: Effect<A, E, R>) => Effect<A2 | A3, E2 | E3, R2 | R3 | R>
  <A, E, R, A2, E2, R2, A3, E3, R3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (cause: Cause<E>) => Effect<A2, E2, R2>
      readonly onSuccess: (a: A) => Effect<A3, E3, R3>
    },
  ): Effect<A2 | A3, E2 | E3, R2 | R3 | R>
} = dual(
  2,
  <A, E, R, A2, E2, R2, A3, E3, R3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (cause: Cause<E>) => Effect<A2, E2, R2>
      readonly onSuccess: (a: A) => Effect<A3, E3, R3>
    },
  ): Effect<A2 | A3, E2 | E3, R2 | R3 | R> => {
    const primitive = Object.create(OnSuccessAndFailureProto)
    primitive[args] = self
    primitive[successCont] = options.onSuccess
    primitive[failureCont] = options.onFailure
    return primitive
  },
)
const OnSuccessAndFailureProto = makePrimitiveProto({
  op: "OnSuccessAndFailure",
  eval(this: any, fiber: FiberImpl): Primitive {
    fiber._stack.push(this)
    return this[args]
  },
})

/**
 * @since 3.4.6
 * @experimental
 * @category pattern matching
 */
export const matchCause: {
  <E, A2, A, A3>(options: {
    readonly onFailure: (cause: Cause<E>) => A2
    readonly onSuccess: (a: A) => A3
  }): <R>(self: Effect<A, E, R>) => Effect<A2 | A3, never, R>
  <A, E, R, A2, A3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (cause: Cause<E>) => A2
      readonly onSuccess: (a: A) => A3
    },
  ): Effect<A2 | A3, never, R>
} = dual(
  2,
  <A, E, R, A2, A3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (cause: Cause<E>) => A2
      readonly onSuccess: (a: A) => A3
    },
  ): Effect<A2 | A3, never, R> =>
    matchCauseEffect(self, {
      onFailure: (cause) => sync(() => options.onFailure(cause)),
      onSuccess: (value) => sync(() => options.onSuccess(value)),
    }),
)

/**
 * @since 3.4.6
 * @experimental
 * @category pattern matching
 */
export const matchEffect: {
  <E, A2, E2, R2, A, A3, E3, R3>(options: {
    readonly onFailure: (e: E) => Effect<A2, E2, R2>
    readonly onSuccess: (a: A) => Effect<A3, E3, R3>
  }): <R>(self: Effect<A, E, R>) => Effect<A2 | A3, E2 | E3, R2 | R3 | R>
  <A, E, R, A2, E2, R2, A3, E3, R3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (e: E) => Effect<A2, E2, R2>
      readonly onSuccess: (a: A) => Effect<A3, E3, R3>
    },
  ): Effect<A2 | A3, E2 | E3, R2 | R3 | R>
} = dual(
  2,
  <A, E, R, A2, E2, R2, A3, E3, R3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (e: E) => Effect<A2, E2, R2>
      readonly onSuccess: (a: A) => Effect<A3, E3, R3>
    },
  ): Effect<A2 | A3, E2 | E3, R2 | R3 | R> =>
    matchCauseEffect(self, {
      onFailure: (cause) =>
        cause._tag === "Fail"
          ? options.onFailure(cause.error)
          : failCause(cause),
      onSuccess: options.onSuccess,
    }),
)

/**
 * @since 3.4.0
 * @experimental
 * @category pattern matching
 */
export const match: {
  <E, A2, A, A3>(options: {
    readonly onFailure: (error: E) => A2
    readonly onSuccess: (value: A) => A3
  }): <R>(self: Effect<A, E, R>) => Effect<A2 | A3, never, R>
  <A, E, R, A2, A3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (error: E) => A2
      readonly onSuccess: (value: A) => A3
    },
  ): Effect<A2 | A3, never, R>
} = dual(
  2,
  <A, E, R, A2, A3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (error: E) => A2
      readonly onSuccess: (value: A) => A3
    },
  ): Effect<A2 | A3, never, R> =>
    matchEffect(self, {
      onFailure: (error) => sync(() => options.onFailure(error)),
      onSuccess: (value) => sync(() => options.onSuccess(value)),
    }),
)

// ----------------------------------------------------------------------------
// delays & timeouts
// ----------------------------------------------------------------------------

/**
 * Create a `Effect` effect that will sleep for the specified duration.
 *
 * @since 3.4.0
 * @experimental
 * @category delays & timeouts
 */
export const sleep = (millis: number): Effect<void> =>
  async((resume) => {
    const timeout = setTimeout(() => {
      resume(void_)
    }, millis)
    return sync(() => {
      clearTimeout(timeout)
    })
  })

/**
 * Returns an effect that will delay the execution of this effect by the
 * specified duration.
 *
 * @since 3.4.0
 * @experimental
 * @category delays & timeouts
 */
export const delay: {
  (millis: number): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R>(self: Effect<A, E, R>, millis: number): Effect<A, E, R>
} = dual(
  2,
  <A, E, R>(self: Effect<A, E, R>, millis: number): Effect<A, E, R> =>
    andThen(sleep(millis), self),
)

/**
 * Returns an effect that will timeout this effect, that will execute the
 * fallback effect if the timeout elapses before the effect has produced a value.
 *
 * If the timeout elapses, the running effect will be safely interrupted.
 *
 * @since 3.4.0
 * @experimental
 * @category delays & timeouts
 */
export const timeoutOrElse: {
  <A2, E2, R2>(options: {
    readonly duration: number
    readonly onTimeout: LazyArg<Effect<A2, E2, R2>>
  }): <A, E, R>(self: Effect<A, E, R>) => Effect<A | A2, E | E2, R | R2>
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    options: {
      readonly duration: number
      readonly onTimeout: LazyArg<Effect<A2, E2, R2>>
    },
  ): Effect<A | A2, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    options: {
      readonly duration: number
      readonly onTimeout: LazyArg<Effect<A2, E2, R2>>
    },
  ): Effect<A | A2, E | E2, R | R2> =>
    raceFirst(
      self,
      andThen(interruptible(sleep(options.duration)), options.onTimeout),
    ),
)

/**
 * Returns an effect that will timeout this effect, that will fail with a
 * `TimeoutException` if the timeout elapses before the effect has produced a
 * value.
 *
 * If the timeout elapses, the running effect will be safely interrupted.
 *
 * @since 3.4.0
 * @experimental
 * @category delays & timeouts
 */
export const timeout: {
  (
    millis: number,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E | TimeoutException, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    millis: number,
  ): Effect<A, E | TimeoutException, R>
} = dual(
  2,
  <A, E, R>(
    self: Effect<A, E, R>,
    millis: number,
  ): Effect<A, E | TimeoutException, R> =>
    timeoutOrElse(self, {
      duration: millis,
      onTimeout: () => fail(new TimeoutException()),
    }),
)

/**
 * Returns an effect that will timeout this effect, succeeding with a `None`
 * if the timeout elapses before the effect has produced a value; and `Some` of
 * the produced value otherwise.
 *
 * If the timeout elapses, the running effect will be safely interrupted.
 *
 * @since 3.4.0
 * @experimental
 * @category delays & timeouts
 */
export const timeoutOption: {
  (
    millis: number,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<Option.Option<A>, E, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    millis: number,
  ): Effect<Option.Option<A>, E, R>
} = dual(
  2,
  <A, E, R>(
    self: Effect<A, E, R>,
    millis: number,
  ): Effect<Option.Option<A>, E, R> =>
    raceFirst(asSome(self), as(interruptible(sleep(millis)), Option.none())),
)

// ----------------------------------------------------------------------------
// resources & finalization
// ----------------------------------------------------------------------------

/**
 * @since 3.4.0
 * @experimental
 * @category resources & finalization
 */
export const EffectScopeTypeId: unique symbol = Symbol.for(
  "effect/Effect/EffectScope",
)

/**
 * @since 3.4.0
 * @experimental
 * @category resources & finalization
 */
export type EffectScopeTypeId = typeof EffectScopeTypeId

/**
 * @since 3.4.0
 * @experimental
 * @category resources & finalization
 */
export interface EffectScope {
  readonly [EffectScopeTypeId]: EffectScopeTypeId
  readonly addFinalizer: (
    finalizer: (exit: Exit<unknown, unknown>) => Effect<void>,
  ) => Effect<void>
  readonly fork: Effect<EffectScope.Closeable>
}

/**
 * @since 3.4.0
 * @experimental
 * @category resources & finalization
 */
export declare namespace EffectScope {
  /**
   * @since 3.4.0
   * @experimental
   * @category resources & finalization
   */
  export interface Closeable extends EffectScope {
    readonly close: (exit: Exit<any, any>) => Effect<void>
  }
}

/**
 * @since 3.4.0
 * @experimental
 * @category resources & finalization
 */
export const EffectScope: Context.Tag<EffectScope, EffectScope> =
  Context.GenericTag<EffectScope>("effect/Effect/EffectScope")

class EffectScopeImpl implements EffectScope.Closeable {
  readonly [EffectScopeTypeId]: EffectScopeTypeId
  state:
    | {
        readonly _tag: "Open"
        readonly finalizers: Set<(exit: Exit<any, any>) => Effect<void>>
      }
    | {
        readonly _tag: "Closed"
        readonly exit: Exit<any, any>
      } = { _tag: "Open", finalizers: new Set() }

  constructor() {
    this[EffectScopeTypeId] = EffectScopeTypeId
  }

  unsafeAddFinalizer(finalizer: (exit: Exit<any, any>) => Effect<void>): void {
    if (this.state._tag === "Open") {
      this.state.finalizers.add(finalizer)
    }
  }
  addFinalizer(
    finalizer: (exit: Exit<any, any>) => Effect<void>,
  ): Effect<void> {
    return suspend(() => {
      if (this.state._tag === "Open") {
        this.state.finalizers.add(finalizer)
        return void_
      }
      return finalizer(this.state.exit)
    })
  }
  unsafeRemoveFinalizer(
    finalizer: (exit: Exit<any, any>) => Effect<void>,
  ): void {
    if (this.state._tag === "Open") {
      this.state.finalizers.delete(finalizer)
    }
  }
  close(microExit: Exit<any, any>): Effect<void> {
    return suspend(() => {
      if (this.state._tag === "Open") {
        const finalizers = Array.from(this.state.finalizers).reverse()
        this.state = { _tag: "Closed", exit: microExit }
        return flatMap(
          forEach(finalizers, (finalizer) => exit(finalizer(microExit))),
          exitVoidAll,
        )
      }
      return void_
    })
  }
  get fork() {
    return sync(() => {
      const newScope = new EffectScopeImpl()
      if (this.state._tag === "Closed") {
        newScope.state = this.state
        return newScope
      }
      function fin(exit: Exit<any, any>) {
        return newScope.close(exit)
      }
      this.state.finalizers.add(fin)
      newScope.unsafeAddFinalizer((_) =>
        sync(() => this.unsafeRemoveFinalizer(fin)),
      )
      return newScope
    })
  }
}

/**
 * @since 3.4.0
 * @experimental
 * @category resources & finalization
 */
export const scopeMake: Effect<EffectScope.Closeable> = sync(
  () => new EffectScopeImpl(),
)

/**
 * @since 3.4.0
 * @experimental
 * @category resources & finalization
 */
export const scopeUnsafeMake = (): EffectScope.Closeable =>
  new EffectScopeImpl()

/**
 * Access the current `EffectScope`.
 *
 * @since 3.4.0
 * @experimental
 * @category resources & finalization
 */
export const scope: Effect<EffectScope, never, EffectScope> =
  service(EffectScope)

/**
 * Provide a `EffectScope` to an effect.
 *
 * @since 3.4.0
 * @experimental
 * @category resources & finalization
 */
export const provideScope: {
  (
    scope: EffectScope,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, EffectScope>>
  <A, E, R>(
    self: Effect<A, E, R>,
    scope: EffectScope,
  ): Effect<A, E, Exclude<R, EffectScope>>
} = dual(
  2,
  <A, E, R>(
    self: Effect<A, E, R>,
    scope: EffectScope,
  ): Effect<A, E, Exclude<R, EffectScope>> =>
    provideService(self, EffectScope, scope),
)

/**
 * Provide a `EffectScope` to the given effect, closing it after the effect has
 * finished executing.
 *
 * @since 3.4.0
 * @experimental
 * @category resources & finalization
 */
export const scoped = <A, E, R>(
  self: Effect<A, E, R>,
): Effect<A, E, Exclude<R, EffectScope>> =>
  suspend(() => {
    const scope = new EffectScopeImpl()
    return onExit(provideService(self, EffectScope, scope), (exit) =>
      scope.close(exit),
    )
  })

/**
 * Create a resource with a cleanup `Effect` effect, ensuring the cleanup is
 * executed when the `EffectScope` is closed.
 *
 * @since 3.4.0
 * @experimental
 * @category resources & finalization
 */
export const acquireRelease = <A, E, R>(
  acquire: Effect<A, E, R>,
  release: (a: A, exit: Exit<unknown, unknown>) => Effect<void>,
): Effect<A, E, R | EffectScope> =>
  uninterruptible(
    flatMap(scope, (scope) =>
      tap(acquire, (a) => scope.addFinalizer((exit) => release(a, exit))),
    ),
  )

/**
 * Add a finalizer to the current `EffectScope`.
 *
 * @since 3.4.0
 * @experimental
 * @category resources & finalization
 */
export const addFinalizer = (
  finalizer: (exit: Exit<unknown, unknown>) => Effect<void>,
): Effect<void, never, EffectScope> =>
  flatMap(scope, (scope) => scope.addFinalizer(finalizer))

/**
 * When the `Effect` effect is completed, run the given finalizer effect with the
 * `Exit` of the executed effect.
 *
 * @since 3.4.6
 * @experimental
 * @category resources & finalization
 */
export const onExit: {
  <A, E, XE, XR>(
    f: (exit: Exit<A, E>) => Effect<void, XE, XR>,
  ): <R>(self: Effect<A, E, R>) => Effect<A, E | XE, R | XR>
  <A, E, R, XE, XR>(
    self: Effect<A, E, R>,
    f: (exit: Exit<A, E>) => Effect<void, XE, XR>,
  ): Effect<A, E | XE, R | XR>
} = dual(
  2,
  <A, E, R, XE, XR>(
    self: Effect<A, E, R>,
    f: (exit: Exit<A, E>) => Effect<void, XE, XR>,
  ): Effect<A, E | XE, R | XR> =>
    uninterruptibleMask((restore) =>
      matchCauseEffect(restore(self), {
        onFailure: (cause) =>
          flatMap(f(exitFailCause(cause)), () => failCause(cause)),
        onSuccess: (a) => flatMap(f(exitSucceed(a)), () => succeed(a)),
      }),
    ),
)

/**
 * Regardless of the result of the this `Effect` effect, run the finalizer effect.
 *
 * @since 3.4.0
 * @experimental
 * @category resources & finalization
 */
export const ensuring: {
  <XE, XR>(
    finalizer: Effect<void, XE, XR>,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E | XE, R | XR>
  <A, E, R, XE, XR>(
    self: Effect<A, E, R>,
    finalizer: Effect<void, XE, XR>,
  ): Effect<A, E | XE, R | XR>
} = dual(
  2,
  <A, E, R, XE, XR>(
    self: Effect<A, E, R>,
    finalizer: Effect<void, XE, XR>,
  ): Effect<A, E | XE, R | XR> => onExit(self, (_) => finalizer),
)

/**
 * When the `Effect` effect is completed, run the given finalizer effect if it
 * matches the specified predicate.
 *
 * @since 3.4.6
 * @experimental
 * @category resources & finalization
 */
export const onExitIf: {
  <A, E, XE, XR, B extends Exit<A, E>>(
    refinement: Refinement<Exit<A, E>, B>,
    f: (exit: B) => Effect<void, XE, XR>,
  ): <R>(self: Effect<A, E, R>) => Effect<A, E | XE, R | XR>
  <A, E, XE, XR>(
    predicate: Predicate<Exit<NoInfer<A>, NoInfer<E>>>,
    f: (exit: Exit<NoInfer<A>, NoInfer<E>>) => Effect<void, XE, XR>,
  ): <R>(self: Effect<A, E, R>) => Effect<A, E | XE, R | XR>
  <A, E, R, XE, XR, B extends Exit<A, E>>(
    self: Effect<A, E, R>,
    refinement: Refinement<Exit<A, E>, B>,
    f: (exit: B) => Effect<void, XE, XR>,
  ): Effect<A, E | XE, R | XR>
  <A, E, R, XE, XR>(
    self: Effect<A, E, R>,
    predicate: Predicate<Exit<NoInfer<A>, NoInfer<E>>>,
    f: (exit: Exit<NoInfer<A>, NoInfer<E>>) => Effect<void, XE, XR>,
  ): Effect<A, E | XE, R | XR>
} = dual(
  3,
  <A, E, R, XE, XR, B extends Exit<A, E>>(
    self: Effect<A, E, R>,
    refinement: Refinement<Exit<A, E>, B>,
    f: (exit: B) => Effect<void, XE, XR>,
  ): Effect<A, E | XE, R | XR> =>
    onExit(self, (exit) => (refinement(exit) ? f(exit) : exitVoid)),
)

/**
 * When the `Effect` effect fails, run the given finalizer effect with the
 * `Cause` of the executed effect.
 *
 * @since 3.4.6
 * @experimental
 * @category resources & finalization
 */
export const onError: {
  <A, E, XE, XR>(
    f: (cause: Cause<NoInfer<E>>) => Effect<void, XE, XR>,
  ): <R>(self: Effect<A, E, R>) => Effect<A, E | XE, R | XR>
  <A, E, R, XE, XR>(
    self: Effect<A, E, R>,
    f: (cause: Cause<NoInfer<E>>) => Effect<void, XE, XR>,
  ): Effect<A, E | XE, R | XR>
} = dual(
  2,
  <A, E, R, XE, XR>(
    self: Effect<A, E, R>,
    f: (cause: Cause<NoInfer<E>>) => Effect<void, XE, XR>,
  ): Effect<A, E | XE, R | XR> =>
    onExitIf(self, exitIsFailure, (exit) => f(exit.cause)),
)

/**
 * If this `Effect` effect is aborted, run the finalizer effect.
 *
 * @since 3.4.6
 * @experimental
 * @category resources & finalization
 */
export const onInterrupt: {
  <XE, XR>(
    finalizer: Effect<void, XE, XR>,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E | XE, R | XR>
  <A, E, R, XE, XR>(
    self: Effect<A, E, R>,
    finalizer: Effect<void, XE, XR>,
  ): Effect<A, E | XE, R | XR>
} = dual(
  2,
  <A, E, R, XE, XR>(
    self: Effect<A, E, R>,
    finalizer: Effect<void, XE, XR>,
  ): Effect<A, E | XE, R | XR> =>
    onExitIf(self, exitIsInterrupt, (_) => finalizer),
)

/**
 * Acquire a resource, use it, and then release the resource when the `use`
 * effect has completed.
 *
 * @since 3.4.0
 * @experimental
 * @category resources & finalization
 */
export const acquireUseRelease = <Resource, E, R, A, E2, R2, E3, R3>(
  acquire: Effect<Resource, E, R>,
  use: (a: Resource) => Effect<A, E2, R2>,
  release: (a: Resource, exit: Exit<A, E2>) => Effect<void, E3, R3>,
): Effect<A, E | E2 | E3, R | R2 | R3> =>
  uninterruptibleMask((restore) =>
    flatMap(acquire, (a) =>
      flatMap(exit(restore(use(a))), (exit) => andThen(release(a, exit), exit)),
    ),
  )

// ----------------------------------------------------------------------------
// interruption
// ----------------------------------------------------------------------------

/**
 * Abort the current `Effect` effect.
 *
 * @since 3.4.6
 * @experimental
 * @category interruption
 */
export const interrupt: Effect<never> = failCause(causeInterrupt())

/**
 * Flag the effect as uninterruptible, which means that when the effect is
 * interrupted, it will be allowed to continue running until completion.
 *
 * @since 3.4.0
 * @experimental
 * @category flags
 */
export const uninterruptible = <A, E, R>(
  self: Effect<A, E, R>,
): Effect<A, E, R> =>
  withFiber((fiber) => {
    if (!fiber.interruptible) return self
    fiber.interruptible = false
    fiber._stack.push(setInterruptible(true))
    return self
  })

const setInterruptible: (interruptible: boolean) => Primitive = makePrimitive({
  op: "SetInterruptible",
  ensure(fiber) {
    fiber.interruptible = this[args]
    if (fiber._interrupted && fiber.interruptible) {
      return () => exitInterrupt
    }
  },
})

/**
 * Flag the effect as interruptible, which means that when the effect is
 * interrupted, it will be interrupted immediately.
 *
 * @since 3.4.0
 * @experimental
 * @category flags
 */
export const interruptible = <A, E, R>(
  self: Effect<A, E, R>,
): Effect<A, E, R> =>
  withFiber((fiber) => {
    if (fiber.interruptible) return self
    fiber.interruptible = true
    fiber._stack.push(setInterruptible(false))
    if (fiber._interrupted) return exitInterrupt
    return self
  })

/**
 * Wrap the given `Effect` effect in an uninterruptible region, preventing the
 * effect from being aborted.
 *
 * You can use the `restore` function to restore a `Effect` effect to the
 * interruptibility state before the `uninterruptibleMask` was applied.
 *
 * @example
 * ```ts
 * import * as Effect from "effect/Effect"
 *
 * Effect.uninterruptibleMask((restore) =>
 *   Effect.sleep(1000).pipe( // uninterruptible
 *     Effect.andThen(restore(Effect.sleep(1000))) // interruptible
 *   )
 * )
 * ```
 *
 * @since 3.4.0
 * @experimental
 * @category interruption
 */
export const uninterruptibleMask = <A, E, R>(
  f: (
    restore: <A, E, R>(effect: Effect<A, E, R>) => Effect<A, E, R>,
  ) => Effect<A, E, R>,
): Effect<A, E, R> =>
  withFiber((fiber) => {
    if (!fiber.interruptible) return f(identity)
    fiber.interruptible = false
    fiber._stack.push(setInterruptible(true))
    return f(interruptible)
  })

// ========================================================================
// collecting & elements
// ========================================================================

/**
 * @since 3.4.0
 * @experimental
 */
export declare namespace All {
  /**
   * @since 3.4.0
   * @experimental
   */
  export type EffectAny = Effect<any, any, any>

  /**
   * @since 3.4.0
   * @experimental
   */
  export type ReturnIterable<
    T extends Iterable<EffectAny>,
    Discard extends boolean,
  > = [T] extends [Iterable<Effect<infer A, infer E, infer R>>]
    ? Effect<Discard extends true ? void : Array<A>, E, R>
    : never

  /**
   * @since 3.4.0
   * @experimental
   */
  export type ReturnTuple<
    T extends ReadonlyArray<unknown>,
    Discard extends boolean,
  > =
    Effect<
      Discard extends true
        ? void
        : T[number] extends never
          ? []
          : {
              -readonly [K in keyof T]: T[K] extends Effect<
                infer _A,
                infer _E,
                infer _R
              >
                ? _A
                : never
            },
      T[number] extends never
        ? never
        : T[number] extends Effect<infer _A, infer _E, infer _R>
          ? _E
          : never,
      T[number] extends never
        ? never
        : T[number] extends Effect<infer _A, infer _E, infer _R>
          ? _R
          : never
    > extends infer X
      ? X
      : never

  /**
   * @since 3.4.0
   * @experimental
   */
  export type ReturnObject<T, Discard extends boolean> = [T] extends [
    { [K: string]: EffectAny },
  ]
    ? Effect<
        Discard extends true
          ? void
          : {
              -readonly [K in keyof T]: [T[K]] extends [
                Effect<infer _A, infer _E, infer _R>,
              ]
                ? _A
                : never
            },
        keyof T extends never
          ? never
          : T[keyof T] extends Effect<infer _A, infer _E, infer _R>
            ? _E
            : never,
        keyof T extends never
          ? never
          : T[keyof T] extends Effect<infer _A, infer _E, infer _R>
            ? _R
            : never
      >
    : never

  /**
   * @since 3.4.0
   * @experimental
   */
  export type IsDiscard<A> = [Extract<A, { readonly discard: true }>] extends [
    never,
  ]
    ? false
    : true

  /**
   * @since 3.4.0
   * @experimental
   */
  export type Return<
    Arg extends Iterable<EffectAny> | Record<string, EffectAny>,
    O extends {
      readonly concurrency?: Concurrency | undefined
      readonly discard?: boolean | undefined
    },
  > = [Arg] extends [ReadonlyArray<EffectAny>]
    ? ReturnTuple<Arg, IsDiscard<O>>
    : [Arg] extends [Iterable<EffectAny>]
      ? ReturnIterable<Arg, IsDiscard<O>>
      : [Arg] extends [Record<string, EffectAny>]
        ? ReturnObject<Arg, IsDiscard<O>>
        : never
}

/**
 * Runs all the provided effects in sequence respecting the structure provided in input.
 *
 * Supports multiple arguments, a single argument tuple / array or record / struct.
 *
 * @since 3.4.0
 * @experimental
 * @category collecting & elements
 */
export const all = <
  const Arg extends
    | Iterable<Effect<any, any, any>>
    | Record<string, Effect<any, any, any>>,
  O extends {
    readonly concurrency?: Concurrency | undefined
    readonly discard?: boolean | undefined
  },
>(
  arg: Arg,
  options?: O,
): All.Return<Arg, O> => {
  if (Array.isArray(arg) || isIterable(arg)) {
    return (forEach as any)(arg, identity, options)
  } else if (options?.discard) {
    return (forEach as any)(Object.values(arg), identity, options)
  }
  return suspend(() => {
    const out: Record<string, unknown> = {}
    return as(
      forEach(
        Object.entries(arg),
        ([key, effect]) =>
          map(effect, (value) => {
            out[key] = value
          }),
        {
          discard: true,
          concurrency: options?.concurrency,
        },
      ),
      out,
    )
  }) as any
}

/**
 * @since 3.11.0
 * @experimental
 * @category collecting & elements
 */
export const whileLoop: <A, E, R>(options: {
  readonly while: LazyArg<boolean>
  readonly body: LazyArg<Effect<A, E, R>>
  readonly step: (a: A) => void
}) => Effect<void, E, R> = makePrimitive({
  op: "While",
  contA(value, fiber) {
    this[args].step(value)
    if (this[args].while()) {
      fiber._stack.push(this)
      return this[args].body()
    }
    return exitVoid
  },
  eval(fiber) {
    if (this[args].while()) {
      fiber._stack.push(this)
      return this[args].body()
    }
    return exitVoid
  },
})

/**
 * For each element of the provided iterable, run the effect and collect the
 * results.
 *
 * If the `discard` option is set to `true`, the results will be discarded and
 * the effect will return `void`.
 *
 * The `concurrency` option can be set to control how many effects are run
 * concurrently. By default, the effects are run sequentially.
 *
 * @since 3.4.0
 * @experimental
 * @category collecting & elements
 */
export const forEach: {
  <A, B, E, R>(
    iterable: Iterable<A>,
    f: (a: A, index: number) => Effect<B, E, R>,
    options?: {
      readonly concurrency?: Concurrency | undefined
      readonly discard?: false | undefined
    },
  ): Effect<Array<B>, E, R>
  <A, B, E, R>(
    iterable: Iterable<A>,
    f: (a: A, index: number) => Effect<B, E, R>,
    options: {
      readonly concurrency?: Concurrency | undefined
      readonly discard: true
    },
  ): Effect<void, E, R>
} = <A, B, E, R>(
  iterable: Iterable<A>,
  f: (a: A, index: number) => Effect<B, E, R>,
  options?: {
    readonly concurrency?: Concurrency | undefined
    readonly discard?: boolean | undefined
  },
): Effect<any, E, R> =>
  withFiber((parent) => {
    const concurrencyOption =
      options?.concurrency === "inherit"
        ? parent.getRef(CurrentConcurrency)
        : (options?.concurrency ?? 1)
    const concurrency =
      concurrencyOption === "unbounded"
        ? Number.POSITIVE_INFINITY
        : Math.max(1, concurrencyOption)

    const items = Arr.fromIterable(iterable)
    let length = items.length
    if (length === 0) {
      return options?.discard ? void_ : succeed([])
    }

    const out: Array<B> | undefined = options?.discard
      ? undefined
      : new Array(length)
    let index = 0

    if (concurrency === 1) {
      return as(
        whileLoop({
          while: () => index < items.length,
          body: () => f(items[index], index),
          step: out ? (b) => (out[index++] = b) : (_) => index++,
        }),
        out as any,
      )
    }
    return async((resume) => {
      const fibers = new Set<Fiber<unknown, unknown>>()
      let result: Exit<any, any> | undefined = undefined
      let inProgress = 0
      let doneCount = 0
      let pumping = false
      let interrupted = false
      function pump() {
        pumping = true
        while (inProgress < concurrency && index < length) {
          const currentIndex = index
          const item = items[currentIndex]
          index++
          inProgress++
          try {
            const child = unsafeFork(parent, f(item, currentIndex), true, true)
            fibers.add(child)
            child.addObserver((exit) => {
              fibers.delete(child)
              if (interrupted) {
                return
              } else if (exit._tag === "Failure") {
                if (result === undefined) {
                  result = exit
                  length = index
                  fibers.forEach((fiber) => fiber.unsafeInterrupt())
                }
              } else if (out !== undefined) {
                out[currentIndex] = exit.value
              }
              doneCount++
              inProgress--
              if (doneCount === length) {
                resume(result ?? succeed(out))
              } else if (!pumping && inProgress < concurrency) {
                pump()
              }
            })
          } catch (err) {
            result = exitDie(err)
            length = index
            fibers.forEach((fiber) => fiber.unsafeInterrupt())
          }
        }
        pumping = false
      }
      pump()

      return suspend(() => {
        interrupted = true
        index = length
        return fiberInterruptAll(fibers)
      })
    })
  })

/**
 * Effectfully filter the elements of the provided iterable.
 *
 * Use the `concurrency` option to control how many elements are processed
 * concurrently.
 *
 * @since 3.4.0
 * @experimental
 * @category collecting & elements
 */
export const filter = <A, E, R>(
  iterable: Iterable<A>,
  f: (a: NoInfer<A>) => Effect<boolean, E, R>,
  options?: {
    readonly concurrency?: Concurrency | undefined
    readonly negate?: boolean | undefined
  },
): Effect<Array<A>, E, R> =>
  filterMap(
    iterable,
    (a) =>
      map(f(a), (pass) => {
        pass = options?.negate ? !pass : pass
        return pass ? Option.some(a) : Option.none()
      }),
    options,
  )

/**
 * Effectfully filter the elements of the provided iterable.
 *
 * Use the `concurrency` option to control how many elements are processed
 * concurrently.
 *
 * @since 3.4.0
 * @experimental
 * @category collecting & elements
 */
export const filterMap = <A, B, E, R>(
  iterable: Iterable<A>,
  f: (a: NoInfer<A>) => Effect<Option.Option<B>, E, R>,
  options?: {
    readonly concurrency?: Concurrency | undefined
  },
): Effect<Array<B>, E, R> =>
  suspend(() => {
    const out: Array<B> = []
    return as(
      forEach(
        iterable,
        (a) =>
          map(f(a), (o) => {
            if (o._tag === "Some") {
              out.push(o.value)
            }
          }),
        {
          discard: true,
          concurrency: options?.concurrency,
        },
      ),
      out,
    )
  })

// ----------------------------------------------------------------------------
// do notation
// ----------------------------------------------------------------------------

/**
 * Start a do notation block.
 *
 * @since 3.4.0
 * @experimental
 * @category do notation
 */
export const Do: Effect<{}> = succeed({})

/**
 * Bind the success value of this `Effect` effect to the provided name.
 *
 * @since 3.4.0
 * @experimental
 * @category do notation
 */
export const bindTo: {
  <N extends string>(
    name: N,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<{ [K in N]: A }, E, R>
  <A, E, R, N extends string>(
    self: Effect<A, E, R>,
    name: N,
  ): Effect<{ [K in N]: A }, E, R>
} = doNotation.bindTo<EffectTypeLambda>(map)

/**
 * Bind the success value of this `Effect` effect to the provided name.
 *
 * @since 3.4.0
 * @experimental
 * @category do notation
 */
export const bind: {
  <N extends string, A extends Record<string, any>, B, E2, R2>(
    name: N,
    f: (a: NoInfer<A>) => Effect<B, E2, R2>,
  ): <E, R>(
    self: Effect<A, E, R>,
  ) => Effect<Simplify<Omit<A, N> & { [K in N]: B }>, E | E2, R | R2>
  <A extends Record<string, any>, E, R, B, E2, R2, N extends string>(
    self: Effect<A, E, R>,
    name: N,
    f: (a: NoInfer<A>) => Effect<B, E2, R2>,
  ): Effect<Simplify<Omit<A, N> & { [K in N]: B }>, E | E2, R | R2>
} = doNotation.bind<EffectTypeLambda>(map, flatMap)

const let_: {
  <N extends string, A extends Record<string, any>, B>(
    name: N,
    f: (a: NoInfer<A>) => B,
  ): <E, R>(
    self: Effect<A, E, R>,
  ) => Effect<Simplify<Omit<A, N> & { [K in N]: B }>, E, R>
  <A extends Record<string, any>, E, R, B, N extends string>(
    self: Effect<A, E, R>,
    name: N,
    f: (a: NoInfer<A>) => B,
  ): Effect<Simplify<Omit<A, N> & { [K in N]: B }>, E, R>
} = doNotation.let_<EffectTypeLambda>(map)

export {
  /**
   * Bind the result of a synchronous computation to the given name.
   *
   * @since 3.4.0
   * @experimental
   * @category do notation
   */
  let_ as let,
}

// ----------------------------------------------------------------------------
// fibers & forking
// ----------------------------------------------------------------------------

/**
 * Run the `Effect` effect in a new `Fiber` that can be awaited, joined, or
 * aborted.
 *
 * When the parent `Effect` finishes, this `Effect` will be aborted.
 *
 * @since 3.4.0
 * @experimental
 * @category fiber & forking
 */
export const fork = <A, E, R>(
  self: Effect<A, E, R>,
): Effect<Fiber<A, E>, never, R> =>
  withFiber((fiber) => {
    fiberMiddleware.interruptChildren ??= fiberInterruptChildren
    return succeed(unsafeFork(fiber, self))
  })

const unsafeFork = <FA, FE, A, E, R>(
  parent: FiberImpl<FA, FE>,
  effect: Effect<A, E, R>,
  immediate = false,
  daemon = false,
): Fiber<A, E> => {
  const child = new FiberImpl<A, E>(parent.context, parent.interruptible)
  if (!daemon) {
    parent.children().add(child)
    child.addObserver(() => parent.children().delete(child))
  }
  if (immediate) {
    child.evaluate(effect as any)
  } else {
    parent
      .getRef(CurrentScheduler)
      .scheduleTask(() => child.evaluate(effect as any), 0)
  }
  return child
}

/**
 * Run the `Effect` effect in a new `Fiber` that can be awaited, joined, or
 * aborted.
 *
 * It will not be aborted when the parent `Effect` finishes.
 *
 * @since 3.4.0
 * @experimental
 * @category fiber & forking
 */
export const forkDaemon = <A, E, R>(
  self: Effect<A, E, R>,
): Effect<Fiber<A, E>, never, R> =>
  withFiber((fiber) => succeed(unsafeFork(fiber, self, false, true)))

/**
 * Run the `Effect` effect in a new `Fiber` that can be awaited, joined, or
 * aborted.
 *
 * The lifetime of the handle will be attached to the provided `EffectScope`.
 *
 * @since 3.4.0
 * @experimental
 * @category fiber & forking
 */
export const forkIn: {
  (
    scope: EffectScope,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<Fiber<A, E>, never, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    scope: EffectScope,
  ): Effect<Fiber<A, E>, never, R>
} = dual(
  2,
  <A, E, R>(
    self: Effect<A, E, R>,
    scope: EffectScope,
  ): Effect<Fiber<A, E>, never, R> =>
    uninterruptibleMask((restore) =>
      flatMap(scope.fork, (scope) =>
        tap(
          restore(forkDaemon(onExit(self, (exit) => scope.close(exit)))),
          (fiber) => scope.addFinalizer((_) => fiberInterrupt(fiber)),
        ),
      ),
    ),
)

/**
 * Run the `Effect` effect in a new `Fiber` that can be awaited, joined, or
 * aborted.
 *
 * The lifetime of the handle will be attached to the current `EffectScope`.
 *
 * @since 3.4.0
 * @experimental
 * @category fiber & forking
 */
export const forkScoped = <A, E, R>(
  self: Effect<A, E, R>,
): Effect<Fiber<A, E>, never, R | EffectScope> =>
  flatMap(scope, (scope) => forkIn(self, scope))

// ----------------------------------------------------------------------------
// execution
// ----------------------------------------------------------------------------

/**
 * Execute the `Effect` effect and return a `Fiber` that can be awaited, joined,
 * or aborted.
 *
 * You can listen for the result by adding an observer using the handle's
 * `addObserver` method.
 *
 * @example
 * ```ts
 * import * as Effect from "effect/Effect"
 *
 * const handle = Effect.succeed(42).pipe(
 *   Effect.delay(1000),
 *   Effect.runFork
 * )
 *
 * handle.addObserver((exit) => {
 *   console.log(exit)
 * })
 * ```
 *
 * @since 3.4.0
 * @experimental
 * @category execution
 */
export const runFork = <A, E>(
  effect: Effect<A, E>,
  options?:
    | {
        readonly signal?: AbortSignal | undefined
        readonly scheduler?: EffectScheduler | undefined
      }
    | undefined,
): FiberImpl<A, E> => {
  const fiber = new FiberImpl<A, E>(
    CurrentScheduler.context(
      options?.scheduler ?? new EffectSchedulerDefault(),
    ),
  )
  fiber.evaluate(effect as any)
  if (options?.signal) {
    if (options.signal.aborted) {
      fiber.unsafeInterrupt()
    } else {
      const abort = () => fiber.unsafeInterrupt()
      options.signal.addEventListener("abort", abort, { once: true })
      fiber.addObserver(() =>
        options.signal!.removeEventListener("abort", abort),
      )
    }
  }
  return fiber
}

/**
 * Execute the `Effect` effect and return a `Promise` that resolves with the
 * `Exit` of the computation.
 *
 * @since 3.4.6
 * @experimental
 * @category execution
 */
export const runPromiseExit = <A, E>(
  effect: Effect<A, E>,
  options?:
    | {
        readonly signal?: AbortSignal | undefined
        readonly scheduler?: EffectScheduler | undefined
      }
    | undefined,
): Promise<Exit<A, E>> =>
  new Promise((resolve, _reject) => {
    const handle = runFork(effect, options)
    handle.addObserver(resolve)
  })

/**
 * Execute the `Effect` effect and return a `Promise` that resolves with the
 * successful value of the computation.
 *
 * @since 3.4.0
 * @experimental
 * @category execution
 */
export const runPromise = <A, E>(
  effect: Effect<A, E>,
  options?:
    | {
        readonly signal?: AbortSignal | undefined
        readonly scheduler?: EffectScheduler | undefined
      }
    | undefined,
): Promise<A> =>
  runPromiseExit(effect, options).then((exit) => {
    if (exit._tag === "Failure") {
      throw exit.cause
    }
    return exit.value
  })

/**
 * Attempt to execute the `Effect` effect synchronously and return the `Exit`.
 *
 * If any asynchronous effects are encountered, the function will return a
 * `CauseDie` containing the `Fiber`.
 *
 * @since 3.4.6
 * @experimental
 * @category execution
 */
export const runSyncExit = <A, E>(effect: Effect<A, E>): Exit<A, E> => {
  const scheduler = new EffectSchedulerDefault()
  const fiber = runFork(effect, { scheduler })
  scheduler.flush()
  return fiber._exit ?? exitDie(fiber)
}

/**
 * Attempt to execute the `Effect` effect synchronously and return the success
 * value.
 *
 * @since 3.4.0
 * @experimental
 * @category execution
 */
export const runSync = <A, E>(effect: Effect<A, E>): A => {
  const exit = runSyncExit(effect)
  if (exit._tag === "Failure") throw exit.cause
  return exit.value
}

// ----------------------------------------------------------------------------
// Errors
// ----------------------------------------------------------------------------

/**
 * @since 3.4.0
 * @experimental
 * @category errors
 */
export interface YieldableError extends Pipeable, Inspectable, Readonly<Error> {
  readonly [TypeId]: Effect.Variance<never, this, never>
  [Symbol.iterator](): EffectIterator<Effect<never, this, never>>
}

const YieldableError: new (message?: string) => YieldableError = (function () {
  class YieldableError extends globalThis.Error {}
  Object.assign(
    YieldableError.prototype,
    EffectProto,
    Data.StructuralPrototype,
    {
      [identifier]: "Failure",
      [evaluate]() {
        return fail(this)
      },
      toString(this: Error) {
        return this.message ? `${this.name}: ${this.message}` : this.name
      },
      toJSON() {
        return { ...this }
      },
      [NodeInspectSymbol](this: Error): string {
        const stack = this.stack
        if (stack) {
          return `${this.toString()}\n${stack.split("\n").slice(1).join("\n")}`
        }
        return this.toString()
      },
    },
  )
  return YieldableError as any
})()

/**
 * @since 3.4.0
 * @experimental
 * @category errors
 */
export const Error: new <A extends Record<string, any> = {}>(
  args: Equals<A, {}> extends true ? void : { readonly [P in keyof A]: A[P] },
) => YieldableError & Readonly<A> = (function () {
  return class extends YieldableError {
    constructor(args: any) {
      super()
      if (args) {
        Object.assign(this, args)
      }
    }
  } as any
})()

/**
 * @since 3.4.0
 * @experimental
 * @category errors
 */
export const TaggedError = <Tag extends string>(
  tag: Tag,
): new <A extends Record<string, any> = {}>(
  args: Equals<A, {}> extends true
    ? void
    : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] },
) => YieldableError & { readonly _tag: Tag } & Readonly<A> => {
  class Base extends Error<{}> {
    readonly _tag = tag
  }
  ;(Base.prototype as any).name = tag
  return Base as any
}

/**
 * Represents a checked exception which occurs when an expected element was
 * unable to be found.
 *
 * @since 3.4.4
 * @experimental
 * @category errors
 */
export class NoSuchElementException extends TaggedError(
  "NoSuchElementException",
)<{ message?: string | undefined }> {}

/**
 * Represents a checked exception which occurs when a timeout occurs.
 *
 * @since 3.4.4
 * @experimental
 * @category errors
 */
export class TimeoutException extends TaggedError("TimeoutException") {}
