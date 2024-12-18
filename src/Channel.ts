/**
 * @since 2.0.0
 */
import * as Predicate from "./Predicate.js"
import { Pipeable } from "./Pipeable.js"
import * as Unify from "./Unify.js"
import * as Effect from "./Effect.js"
import * as Types from "./Types.js"
import { dual, identity } from "./Function.js"
import * as Cause from "./Cause.js"
import * as internalMailbox from "./internal/mailbox.js"
import type { Mailbox } from "./Mailbox.js"
import * as Exit from "./Exit.js"
import * as Scope from "./Scope.js"
import * as Chunk from "effect/Chunk"

/**
 * @since 4.0.0
 * @category symbols
 */
export const TypeId: unique symbol = Symbol.for("effect/Channel")

/**
 * @since 4.0.0
 * @category symbols
 */
export type TypeId = typeof TypeId

/**
 * A `Channel` is a nexus of I/O operations, which supports both reading and
 * writing. A channel may read values of type `InElem` and write values of type
 * `OutElem`. When the channel finishes, it yields a value of type `OutDone`. A
 * channel may fail with a value of type `OutErr`.
 *
 * Channels are the foundation of Streams: both streams and sinks are built on
 * channels. Most users shouldn't have to use channels directly, as streams and
 * sinks are much more convenient and cover all common use cases. However, when
 * adding new stream and sink operators, or doing something highly specialized,
 * it may be useful to use channels directly.
 *
 * Channels compose in a variety of ways:
 *
 *  - **Piping**: One channel can be piped to another channel, assuming the
 *    input type of the second is the same as the output type of the first.
 *  - **Sequencing**: The terminal value of one channel can be used to create
 *    another channel, and both the first channel and the function that makes
 *    the second channel can be composed into a channel.
 *  - **Concatenating**: The output of one channel can be used to create other
 *    channels, which are all concatenated together. The first channel and the
 *    function that makes the other channels can be composed into a channel.
 *
 * @since 2.0.0
 * @category models
 */
export interface Channel<
  out OutElem,
  in InElem = unknown,
  out OutErr = never,
  in InErr = unknown,
  out OutDone = void,
  in InDone = unknown,
  out Env = never,
> extends Channel.Variance<
      OutElem,
      InElem,
      OutErr,
      InErr,
      OutDone,
      InDone,
      Env
    >,
    Pipeable {
  [Unify.typeSymbol]?: unknown
  [Unify.unifySymbol]?: ChannelUnify<this>
  [Unify.ignoreSymbol]?: ChannelUnifyIgnore
}

/**
 * @since 2.0.0
 * @category models
 */
export interface ChannelUnify<A extends { [Unify.typeSymbol]?: any }>
  extends Effect.EffectUnify<A> {
  Channel?: () => A[Unify.typeSymbol] extends
    | Channel<
        infer OutElem,
        infer InElem,
        infer OutErr,
        infer InErr,
        infer OutDone,
        infer InDone,
        infer Env
      >
    | infer _
    ? Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>
    : never
}

/**
 * @category models
 * @since 2.0.0
 */
export interface ChannelUnifyIgnore extends Effect.EffectUnifyIgnore {
  Channel?: true
}

/**
 * @since 2.0.0
 */
export declare namespace Channel {
  /**
   * @since 2.0.0
   * @category models
   */
  export interface Variance<
    out OutElem,
    in InElem,
    out OutErr,
    in InErr,
    out OutDone,
    in InDone,
    out Env,
  > {
    readonly [TypeId]: VarianceStruct<
      OutElem,
      InElem,
      OutErr,
      InErr,
      OutDone,
      InDone,
      Env
    >
  }
  /**
   * @since 2.0.0
   * @category models
   */
  export interface VarianceStruct<
    out OutElem,
    in InElem,
    out OutErr,
    in InErr,
    out OutDone,
    in InDone,
    out Env,
  > {
    _Env: Types.Covariant<Env>
    _InErr: Types.Contravariant<InErr>
    _InElem: Types.Contravariant<InElem>
    _InDone: Types.Contravariant<InDone>
    _OutErr: Types.Covariant<OutErr>
    _OutElem: Types.Covariant<OutElem>
    _OutDone: Types.Covariant<OutDone>
  }
}

const ChannelProto = {
  [TypeId]: {
    _Env: identity,
    _InErr: identity,
    _InElem: identity,
    _InDone: identity,
    _OutErr: identity,
    _OutElem: identity,
    _OutDone: identity,
  },
}

const makeImpl = <
  OutElem,
  InElem,
  OutErr,
  InErr,
  OutDone,
  InDone,
  EX,
  EnvX,
  Env,
>(
  transform: (
    upstream: Effect.Effect<InElem, InErr>,
    scope: Scope.Scope,
  ) => Effect.Effect<Effect.Effect<OutElem, OutErr, EnvX>, EX, Env>,
): Channel<
  OutElem,
  InElem,
  OutErr | EX,
  InErr,
  OutDone,
  InDone,
  Env | EnvX
> => {
  const self = Object.create(ChannelProto)
  self.transform = transform
  return self
}

const makeNoInput = <OutElem, OutErr, OutDone, EX, EnvX, Env>(
  effect: Effect.Effect<Effect.Effect<OutElem, OutErr, EnvX>, EX, Env>,
): Channel<
  OutElem,
  unknown,
  OutErr | EX,
  unknown,
  OutDone,
  unknown,
  Env | EnvX
> => makeImpl((_, __) => effect)

const withForkedScope = <OutElem, InElem, OutErr, InErr, EnvX, EX, Env>(
  f: (
    upstream: Effect.Effect<InElem, InErr>,
    scope: Scope.Scope,
    forkedScope: Scope.Scope,
  ) => Effect.Effect<Effect.Effect<OutElem, OutErr, EnvX>, EX, Env>,
): ((
  upstream: Effect.Effect<InElem, InErr>,
  scope: Scope.Scope,
) => Effect.Effect<Effect.Effect<OutElem, OutErr, EnvX>, EX, Env>) =>
  Effect.fnUntraced(function* (upstream, scope) {
    const closableScope = yield* scope.fork
    const pull = yield* f(upstream, scope, closableScope)
    return Effect.onError(pull, (cause) =>
      closableScope.close(Exit.failCause(cause)),
    )
  })

const toTransform = <OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>(
  channel: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
): ((
  upstream: Effect.Effect<InElem, InErr>,
  scope: Scope.Scope,
) => Effect.Effect<Effect.Effect<OutElem, OutErr>, never, Env>) => {
  return (channel as any).transform
}

/**
 * @since 2.0.0
 * @category models
 */
export interface Emit<in A, in E> {
  /**
   * Terminates with a cause that dies with the specified defect.
   */
  die<Err>(defect: Err): void

  /**
   * Either emits the specified value if this `Exit` is a `Success` or else
   * terminates with the specified cause if this `Exit` is a `Failure`.
   */
  done(exit: Exit.Exit<A, E>): void

  /**
   * Terminates with an end of stream signal.
   */
  end(): void

  /**
   * Terminates with the specified error.
   */
  fail(error: E): void

  /**
   * Terminates the channel with the specified cause.
   */
  failCause(cause: Cause.Cause<E>): void

  /**
   * Emits a value
   */
  single(value: A): boolean
}

const emitFromMailbox = <A, E>(mailbox: Mailbox<A, E>): Emit<A, E> => ({
  die: (defect) => mailbox.unsafeDone(Exit.die(defect)),
  done: (exit) => mailbox.unsafeDone(Exit.asVoid(exit)),
  end: () => mailbox.unsafeDone(Exit.void),
  fail: (error) => mailbox.unsafeDone(Exit.fail(error)),
  failCause: (cause) => mailbox.unsafeDone(Exit.failCause(cause)),
  single: (value) => mailbox.unsafeOffer(value),
})

const mailboxToPull = <A, E>(mailbox: Mailbox<A, E>) => {
  let buffer: ReadonlyArray<A> = []
  let index = 0
  let done = false
  return Effect.suspend(() => {
    if (index < buffer.length) {
      return Effect.succeed(buffer[index++])
    } else if (done) {
      return Halt.voidEffect
    }
    return Effect.map(mailbox.takeAll, ([values, done_]) => {
      buffer = Chunk.toReadonlyArray(values)
      index = 0
      done = done_
      return buffer[index++]
    })
  })
}

/**
 * @since 2.0.0
 * @category constructors
 */
export const asyncPush = <A, E = never, R = never>(
  f: (emit: Emit<A, E>) => Effect.Effect<unknown, E, R | Scope.Scope>,
): Channel<A, unknown, E, unknown, void, unknown, Exclude<R, Scope.Scope>> =>
  makeImpl(
    withForkedScope(
      Effect.fnUntraced(function* (_, __, scope) {
        const mailbox = yield* internalMailbox.make<A, E>()
        yield* scope.addFinalizer(() => mailbox.shutdown)
        const emit = emitFromMailbox(mailbox)
        yield* Effect.forkIn(Scope.provideScope(f(emit), scope), scope)
        return mailboxToPull(mailbox)
      }),
    ),
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromIterable = <A>(iterable: Iterable<A>): Channel<A> =>
  makeNoInput(
    Effect.sync(() => {
      const iterator = iterable[Symbol.iterator]()
      return Effect.suspend(() => {
        const state = iterator.next()
        if (state.done) {
          return Halt.voidEffect
        } else {
          return Effect.succeed(state.value)
        }
      })
    }),
  )

/**
 * Writes a single value to the channel.
 *
 * @since 2.0.0
 * @category constructors
 */
export const succeed = <A>(value: A): Channel<A> =>
  makeNoInput(
    Effect.sync(() => {
      let done = false
      return Effect.suspend(() => {
        if (done) {
          return Effect.die(Halt.void)
        } else {
          done = true
          return Effect.succeed(value)
        }
      })
    }),
  )

/**
 * Maps the output of this channel using the specified function.
 *
 * @since 2.0.0
 * @category mapping
 */
export const map: {
  <OutElem, OutElem2>(
    f: (o: OutElem) => OutElem2,
  ): <InElem, OutErr, InErr, OutDone, InDone, Env>(
    self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
  ) => Channel<OutElem2, InElem, OutErr, InErr, OutDone, InDone, Env>
  <OutElem, InElem, OutErr, InErr, OutDone, InDone, Env, OutElem2>(
    self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
    f: (o: OutElem) => OutElem2,
  ): Channel<OutElem2, InElem, OutErr, InErr, OutDone, InDone, Env>
} = dual(
  2,
  <OutElem, InElem, OutErr, InErr, OutDone, InDone, Env, OutElem2>(
    self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
    f: (o: OutElem) => OutElem2,
  ): Channel<OutElem2, InElem, OutErr, InErr, OutDone, InDone, Env> =>
    makeImpl((upstream, scope) =>
      Effect.map(toTransform(self)(upstream, scope), Effect.map(f)),
    ),
)

export const mapEffectSequential = <
  OutElem,
  InElem,
  OutErr,
  InErr,
  OutDone,
  InDone,
  Env,
  OutElem2,
  EX,
  RX,
>(
  self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
  f: (o: OutElem) => Effect.Effect<OutElem2, EX, RX>,
): Channel<OutElem2, InElem, OutErr | EX, InErr, OutDone, InDone, Env | RX> =>
  makeImpl((upstream, scope) =>
    Effect.map(toTransform(self)(upstream, scope), Effect.flatMap(f)),
  )

/**
 * @since 2.0.0
 * @category utils
 */
export const mergeAll =
  ({ concurrency }: { readonly concurrency: number | "unbounded" }) =>
  <
    OutElem,
    InElem1,
    OutErr1,
    InErr1,
    OutDone,
    InDone1,
    Env1,
    InElem,
    OutErr,
    InErr,
    InDone,
    Env,
  >(
    channels: Channel<
      Channel<OutElem, InElem1, OutErr1, InErr1, OutDone, InDone1, Env1>,
      InElem,
      OutErr,
      InErr,
      OutDone,
      InDone,
      Env
    >,
  ): Channel<
    OutElem,
    InElem & InElem1,
    OutErr1 | OutErr,
    InErr & InErr1,
    OutDone,
    InDone & InDone1,
    Env1 | Env
  > =>
    makeImpl(
      withForkedScope(
        Effect.fnUntraced(function* (upstream, parentScope, scope) {
          const concurrencyN =
            concurrency === "unbounded"
              ? Number.MAX_SAFE_INTEGER
              : Math.max(1, concurrency)
          const semaphore = Effect.unsafeMakeSemaphore(concurrencyN)

          const mailbox = yield* internalMailbox.make<
            OutElem,
            OutErr | OutErr1
          >()
          yield* scope.addFinalizer(() => mailbox.shutdown)

          const pull = yield* toTransform(channels)(upstream, parentScope)

          yield* Effect.gen(function* () {
            while (true) {
              yield* semaphore.take(1)
              const channel = yield* pull
              const childPull = yield* toTransform(channel)(
                upstream,
                parentScope,
              )
              yield* Effect.gen(function* () {
                while (true) {
                  yield* mailbox.offer(yield* childPull)
                }
              }).pipe(
                Effect.onError((cause): Effect.Effect<void> => {
                  for (const failure of cause.failures) {
                    if (isHaltFailure(failure)) {
                      return semaphore.release(1)
                    }
                  }
                  return mailbox.failCause(cause)
                }),
                Effect.forkIn(scope),
              )
            }
          }).pipe(
            Effect.onError((cause) =>
              // n-1 because of the Halt defect
              semaphore.withPermits(concurrencyN - 1)(mailbox.failCause(cause)),
            ),
            Effect.forkIn(scope),
          )

          return mailboxToPull(mailbox)
        }),
      ),
    )

/**
 * Returns a new channel that pipes the output of this channel into the
 * specified channel. The returned channel has the input type of this channel,
 * and the output type of the specified channel, terminating with the value of
 * the specified channel.
 *
 * @since 2.0.0
 * @category utils
 */
export const pipeTo: {
  <OutElem2, OutElem, OutErr2, OutErr, OutDone2, OutDone, Env2>(
    that: Channel<OutElem2, OutElem, OutErr2, OutErr, OutDone2, OutDone, Env2>,
  ): <InElem, InErr, InDone, Env>(
    self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
  ) => Channel<OutElem2, InElem, OutErr2, InErr, OutDone2, InDone, Env2 | Env>
  <
    OutElem,
    InElem,
    OutErr,
    InErr,
    OutDone,
    InDone,
    Env,
    OutElem2,
    OutErr2,
    OutDone2,
    Env2,
  >(
    self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
    that: Channel<OutElem2, OutElem, OutErr2, OutErr, OutDone2, OutDone, Env2>,
  ): Channel<OutElem2, InElem, OutErr2, InErr, OutDone2, InDone, Env | Env2>
} = dual(
  2,
  <
    OutElem,
    InElem,
    OutErr,
    InErr,
    OutDone,
    InDone,
    Env,
    OutElem2,
    OutErr2,
    OutDone2,
    Env2,
  >(
    self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
    that: Channel<OutElem2, OutElem, OutErr2, OutErr, OutDone2, OutDone, Env2>,
  ): Channel<OutElem2, InElem, OutErr2, InErr, OutDone2, InDone, Env | Env2> =>
    makeImpl((upstream, scope) =>
      Effect.flatMap(toTransform(self)(upstream, scope), (uptsream) =>
        toTransform(that)(uptsream, scope),
      ),
    ),
)

const runWith = <
  OutElem,
  InElem,
  OutErr,
  InErr,
  OutDone,
  InDone,
  Env,
  EX,
  RX,
  AH = void,
  EH = never,
  RH = never,
>(
  self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
  f: (pull: Effect.Effect<OutElem, OutErr>) => Effect.Effect<void, EX, RX>,
  onHalt?: (leftover: OutDone) => Effect.Effect<AH, EH, RH>,
): Effect.Effect<AH, EX | EH, Env | RX | RH> =>
  Effect.suspend(() => {
    const scope = Scope.unsafeMake()
    const makePull = toTransform(self)(Halt.voidEffect, scope)
    return Effect.flatMap(makePull, f).pipe(
      Halt.catch((halt) =>
        onHalt ? onHalt(halt.leftover as any) : (Effect.void as any),
      ),
      Effect.onExit((exit) => scope.close(exit)),
    ) as any
  })

/**
 * @since 2.0.0
 * @category execution
 */
export const runForEach: {
  <OutElem, EX, RX>(
    f: (o: OutElem) => Effect.Effect<void, EX, RX>,
  ): <InElem, OutErr, InErr, OutDone, InDone, Env>(
    self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
  ) => Effect.Effect<void, OutErr | EX, Env | RX>
  <OutElem, InElem, OutErr, InErr, OutDone, InDone, Env, EX, RX>(
    self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
    f: (o: OutElem) => Effect.Effect<void, EX, RX>,
  ): Effect.Effect<void, OutErr | EX, Env | RX>
} = dual(
  2,
  <OutElem, InElem, OutErr, InErr, OutDone, InDone, Env, EX, RX>(
    self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
    f: (o: OutElem) => Effect.Effect<void, EX, RX>,
  ): Effect.Effect<void, OutErr | EX, Env | RX> =>
    runWith(
      self,
      Effect.fnUntraced(function* (pull) {
        while (true) {
          yield* f(yield* pull)
        }
      }),
    ),
)

/**
 * @since 2.0.0
 * @category execution
 */
export const runCollect = <
  OutElem,
  InElem,
  OutErr,
  InErr,
  OutDone,
  InDone,
  Env,
>(
  self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
): Effect.Effect<Array<OutElem>, OutErr, Env> =>
  Effect.suspend(() => {
    const result: OutElem[] = []
    return runWith(
      self,
      Effect.fnUntraced(function* (pull) {
        while (true) {
          result.push(yield* pull)
        }
      }),
      () => Effect.succeed(result),
    )
  })

// -----------------------------------------------------------------------------
// Halt
// -----------------------------------------------------------------------------

const HaltTypeId: unique symbol = Symbol.for("effect/Channel/Halt")
type HaltTypeId = typeof HaltTypeId

class Halt<out Leftover = unknown> {
  readonly [HaltTypeId]: HaltTypeId = HaltTypeId
  constructor(readonly leftover: Leftover) {}

  static readonly void: Halt<void> = new Halt(void 0)
  static readonly voidEffect: Effect.Effect<never> = Effect.die(Halt.void)

  static catch<L, A2, E2, R2>(f: (halt: Halt<L>) => Effect.Effect<A2, E2, R2>) {
    return <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      Effect.catchFailure(effect, isHaltFailure, (failure) =>
        f(failure.defect as any),
      )
  }
}

const isHalt = (u: unknown): u is Halt => Predicate.hasProperty(u, HaltTypeId)

const isHaltFailure = <E>(
  failure: Cause.Failure<E>,
): failure is Cause.Die & {
  readonly defect: Halt
} => failure._tag === "Die" && isHalt(failure.defect)
