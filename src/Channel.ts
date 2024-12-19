/**
 * @since 2.0.0
 */
import * as Predicate from "./Predicate.js"
import { Pipeable, pipeArguments } from "./Pipeable.js"
import * as Unify from "./Unify.js"
import * as Effect from "./Effect.js"
import * as Types from "./Types.js"
import {
  LazyArg,
  constant,
  constTrue,
  constVoid,
  dual,
  identity,
} from "./Function.js"
import * as Cause from "./Cause.js"
import * as internalMailbox from "./internal/mailbox.js"
import type { Mailbox, ReadonlyMailbox } from "./Mailbox.js"
import * as Exit from "./Exit.js"
import * as Scope from "./Scope.js"
import * as Chunk from "effect/Chunk"
import * as Context from "./Context.js"
import * as Inspectable from "./Inspectable.js"

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

// -----------------------------------------------------------------------------
// Halt
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 * @category Halt
 */
export const HaltTypeId: unique symbol = Symbol.for("effect/Channel/Halt")

/**
 * @since 4.0.0
 * @category Halt
 */
export type HaltTypeId = typeof HaltTypeId

/**
 * @since 4.0.0
 * @category Halt
 */
export class Halt<out Leftover> implements Inspectable.Inspectable {
  /**
   * @since 4.0.0
   */
  readonly [HaltTypeId]: HaltTypeId = HaltTypeId

  /**
   * @since 4.0.0
   */
  readonly _tag = "Halt"

  constructor(readonly leftover: Leftover) {}

  /**
   * @since 4.0.0
   */
  toJSON(): unknown {
    return {
      _id: "Channel/Halt",
      leftover: this.leftover,
    }
  }

  /**
   * @since 4.0.0
   */
  toString(): string {
    return Inspectable.format(this)
  }

  /**
   * @since 4.0.0
   */
  [Inspectable.NodeInspectSymbol](): string {
    return this.toString()
  }

  /**
   * @since 4.0.0
   */
  static catch<E, A2, E2, R2>(
    f: (halt: Halt.FromError<Types.NoInfer<E>>) => Effect.Effect<A2, E2, R2>,
  ) {
    return <A, R>(effect: Effect.Effect<A, E, R>) =>
      Effect.catchFailure(effect, isHaltFailure, (failure) =>
        f(failure.error as any),
      )
  }

  /**
   * @since 4.0.0
   */
  static fromCause<E>(cause: Cause.Cause<E>): Halt.FromError<E> | undefined {
    return cause.failures.find(isHaltFailure)?.error as any
  }
}

/**
 * @since 4.0.0
 * @category Halt
 */
export namespace Halt {
  /**
   * @since 4.0.0
   * @category Halt
   */
  export type FromError<E> = E extends Halt<infer A> ? Halt<A> : never

  /**
   * @since 4.0.0
   * @category Halt
   */
  export type LeftoverFromError<E> = E extends Halt<infer A> ? A : never

  /**
   * @since 4.0.0
   * @category Halt
   */
  export type FailureFromError<E> = (
    E extends Halt<infer A> ? A : never
  ) extends infer L
    ? [L] extends [never]
      ? never
      : Cause.Fail<Halt<L>>
    : never

  /**
   * @since 4.0.0
   * @category Halt
   */
  export type ExtractHalt<E> = E extends Halt<infer A> ? Halt<A> : never

  /**
   * @since 4.0.0
   * @category Halt
   */
  export type ExcludeHalt<E> = E extends Halt<infer _A> ? never : E
}

/**
 * @since 4.0.0
 * @category Halt
 */
export const isHalt = (u: unknown): u is Halt<unknown> =>
  Predicate.hasProperty(u, HaltTypeId)

/**
 * @since 4.0.0
 * @category Halt
 */
export const isHaltCause = <E>(cause: Cause.Cause<E>): boolean =>
  cause.failures.some(isHaltFailure)

/**
 * @since 4.0.0
 * @category Halt
 */
export const isHaltFailure = <E>(
  failure: Cause.Failure<E>,
): failure is Cause.Fail<E & Halt.ExtractHalt<E>> =>
  failure._tag === "Fail" && isHalt(failure.error)

/**
 * @since 4.0.0
 * @category Halt
 */
export const halt = <A>(leftover: A): Effect.Effect<never, Halt<A>> =>
  Effect.fail(new Halt(leftover))

/**
 * @since 4.0.0
 * @category Halt
 */
const haltVoid: Effect.Effect<never, Halt<void>> = Effect.fail(new Halt(void 0))

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
  pipe() {
    return pipeArguments(this, arguments)
  },
}

/**
 * @since 4.0.0
 * @category Pull
 */
export interface Pull<out A, out E = never, out Done = void, out R = never>
  extends Effect.Effect<A, E | Halt<Done>, R> {}

// -----------------------------------------------------------------------------
// Constructors
// -----------------------------------------------------------------------------

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
    upstream: Pull<InElem, InErr, InDone>,
    scope: Scope.Scope,
  ) => Effect.Effect<Pull<OutElem, OutErr, OutDone, EnvX>, EX, Env>,
): Channel<
  OutElem,
  InElem,
  Halt.ExcludeHalt<OutErr | EX>,
  InErr,
  OutDone,
  InDone,
  Env | EnvX
> => {
  const self = Object.create(ChannelProto)
  self.transform = transform
  return self
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromPull = <OutElem, OutErr, OutDone, EX, EnvX, Env>(
  effect: Effect.Effect<Pull<OutElem, OutErr, OutDone, EnvX>, EX, Env>,
): Channel<
  OutElem,
  unknown,
  Halt.ExcludeHalt<OutErr | EX>,
  unknown,
  OutDone,
  unknown,
  Env | EnvX
> => makeImpl((_, __) => effect)

const makeImplScoped = <
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
  f: (
    upstream: Pull<InElem, InErr, InDone>,
    scope: Scope.Scope,
    forkedScope: Scope.Scope,
  ) => Effect.Effect<Pull<OutElem, OutErr, OutDone, EnvX>, EX, Env>,
): Channel<
  OutElem,
  InElem,
  Halt.ExcludeHalt<OutErr | EX>,
  InErr,
  OutDone,
  InDone,
  Env | EnvX
> =>
  makeImpl(
    Effect.fnUntraced(function* (upstream, scope) {
      const closableScope = yield* scope.fork
      const pull = yield* f(upstream, scope, closableScope)
      return Effect.onError(pull, (cause) =>
        closableScope.close(
          isHaltCause(cause) ? Exit.void : Exit.failCause(cause),
        ),
      )
    }),
  )

const toTransform = <OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>(
  channel: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
): ((
  upstream: Pull<InElem, InErr, InDone>,
  scope: Scope.Scope,
) => Effect.Effect<Pull<OutElem, OutErr, OutDone>, never, Env>) =>
  (channel as any).transform

/**
 * @since 2.0.0
 * @category models
 */
export const DefaultChunkSize: number = 4096

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

const mailboxToPull = <A, E>(mailbox: ReadonlyMailbox<A, E>) => {
  let buffer: ReadonlyArray<A> = []
  let index = 0
  let done = false
  const refill = Effect.map(mailbox.takeAll, ([values, done_]) => {
    buffer = Chunk.toReadonlyArray(values)
    index = 0
    done = done_
    return buffer[index++]
  })
  return Effect.suspend((): Effect.Effect<A, E> => {
    if (index < buffer.length) {
      return Effect.succeed(buffer[index++])
    } else if (done) {
      buffer = []
      return haltVoid as Effect.Effect<never>
    }
    return refill
  })
}

/**
 * @since 2.0.0
 * @category constructors
 */
export const asyncPush = <A, E = never, R = never>(
  f: (emit: Emit<A, E>) => Effect.Effect<unknown, E, R | Scope.Scope>,
): Channel<A, unknown, E, unknown, void, unknown, Exclude<R, Scope.Scope>> =>
  makeImplScoped(
    Effect.fnUntraced(function* (_, __, scope) {
      const mailbox = yield* internalMailbox.make<A, E>()
      yield* scope.addFinalizer(() => mailbox.shutdown)
      const emit = emitFromMailbox(mailbox)
      yield* Effect.forkIn(Scope.provideScope(f(emit), scope), scope)
      return mailboxToPull(mailbox)
    }),
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const acquireUseRelease = <
  A,
  E,
  R,
  OutElem,
  InElem,
  OutErr,
  InErr,
  OutDone,
  InDone,
  Env,
>(
  acquire: Effect.Effect<A, E, R>,
  use: (a: A) => Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
  release: (a: A, exit: Exit.Exit<OutDone, OutErr>) => Effect.Effect<void>,
): Channel<OutElem, InElem, OutErr | E, InErr, OutDone, InDone, Env | R> =>
  makeImpl(
    Effect.fnUntraced(function* (upstream, scope) {
      const value = yield* acquire
      const pull = yield* toTransform(use(value))(upstream, scope)
      return Effect.onExit(pull, (exit) => {
        if (exit._tag === "Success") return Effect.void
        const halt = Halt.fromCause(exit.cause)
        return halt
          ? release(value, Exit.succeed(halt.leftover as OutDone))
          : release(value, exit as any)
      })
    }),
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromIterator = <A, Done>(
  iterator: LazyArg<Iterator<A, Done>>,
): Channel<A, unknown, never, unknown, Done> =>
  fromPull(
    Effect.sync(() => {
      const iter = iterator()
      return Effect.suspend(() => {
        const state = iter.next()
        if (state.done) {
          return halt(state.value)
        } else {
          return Effect.succeed(state.value)
        }
      })
    }),
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromIteratorChunk = <A, Done>(
  iterator: LazyArg<Iterator<A, Done>>,
  chunkSize = DefaultChunkSize,
): Channel<Chunk.Chunk<A>, unknown, never, unknown, Done> =>
  fromPull(
    Effect.sync(() => {
      const iter = iterator()
      return Effect.suspend(() => {
        const buffer: A[] = []
        while (buffer.length < chunkSize) {
          const state = iter.next()
          if (state.done) {
            return halt(state.value)
          }
          buffer.push(state.value)
        }
        return Effect.succeed(Chunk.unsafeFromArray(buffer))
      })
    }),
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromIterable = <A, Done>(
  iterable: Iterable<A, Done>,
): Channel<A, unknown, never, unknown, Done> =>
  fromIterator(() => iterable[Symbol.iterator]())

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromIterableChunk = <A, Done>(
  iterable: Iterable<A, Done>,
): Channel<Chunk.Chunk<A>, unknown, never, unknown, Done> =>
  fromIteratorChunk(() => iterable[Symbol.iterator]())

/**
 * Writes a single value to the channel.
 *
 * @since 2.0.0
 * @category constructors
 */
export const succeed = <A>(value: A): Channel<A> =>
  fromPull(
    Effect.sync(() => {
      let done = false
      return Effect.suspend(() => {
        if (done) {
          return haltVoid
        } else {
          done = true
          return Effect.succeed(value)
        }
      })
    }),
  )

/**
 * Create a channel that completes with the specified value.
 *
 * @since 2.0.0
 * @category constructors
 */
export const done = <A>(value: A): Channel<never, unknown, never, unknown, A> =>
  fromPull(Effect.succeed(halt(value)))

const void_: Channel<never> = fromPull(Effect.succeed(haltVoid))
export {
  /**
   * Represents an Channel that emits no elements
   *
   * @since 2.0.0
   * @category constructors
   */
  void_ as void,
}

/**
 * Represents an Channel that never completes
 *
 * @since 2.0.0
 * @category constructors
 */
export const never: Channel<never> = fromPull(Effect.succeed(Effect.never))

/**
 * Use an effect to write a single value to the channel.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromEffect = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Channel<A, unknown, E, unknown, void, unknown, R> =>
  fromPull(
    Effect.sync(() => {
      let done = false
      return Effect.suspend((): Pull<A, E, void, R> => {
        if (done) return haltVoid
        done = true
        return effect
      })
    }),
  )

/**
 * Create a channel from a ReadonlyMailbox
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromMailbox = <A, E>(
  mailbox: ReadonlyMailbox<A, E>,
): Channel<A, unknown, E> => fromPull(Effect.sync(() => mailboxToPull(mailbox)))

/**
 * Create a channel from a ReadonlyMailbox
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromMailboxChunk = <A, E>(
  mailbox: ReadonlyMailbox<A, E>,
): Channel<Chunk.Chunk<A>, unknown, E> =>
  fromPull(
    Effect.succeed(
      Effect.flatMap(mailbox.takeAll, ([values]) =>
        values.length === 0 ? haltVoid : Effect.succeed(values),
      ),
    ),
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
export const mergeAll: {
  (options: {
    readonly concurrency: number | "unbounded"
    readonly bufferSize?: number | undefined
  }): <
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
  ) => Channel<
    OutElem,
    InElem & InElem1,
    OutErr1 | OutErr,
    InErr & InErr1,
    OutDone,
    InDone & InDone1,
    Env1 | Env
  >
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
    options: {
      readonly concurrency: number | "unbounded"
      readonly bufferSize?: number | undefined
    },
  ): Channel<
    OutElem,
    InElem & InElem1,
    OutErr1 | OutErr,
    InErr & InErr1,
    OutDone,
    InDone & InDone1,
    Env1 | Env
  >
} = dual(
  2,
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
    {
      concurrency,
      bufferSize = 16,
    }: {
      readonly concurrency: number | "unbounded"
      readonly bufferSize?: number | undefined
    },
  ): Channel<
    OutElem,
    InElem & InElem1,
    OutErr1 | OutErr,
    InErr & InErr1,
    OutDone,
    InDone & InDone1,
    Env1 | Env
  > =>
    makeImplScoped(
      Effect.fnUntraced(function* (upstream, parentScope, scope) {
        const concurrencyN =
          concurrency === "unbounded"
            ? Number.MAX_SAFE_INTEGER
            : Math.max(1, concurrency)
        const semaphore = Effect.unsafeMakeSemaphore(concurrencyN)

        const mailbox = yield* internalMailbox.make<
          OutElem,
          OutErr | OutErr1 | Halt<OutDone>
        >(bufferSize)
        yield* scope.addFinalizer(() => mailbox.shutdown)

        const pull = yield* toTransform(channels)(upstream, parentScope)

        yield* Effect.gen(function* () {
          while (true) {
            yield* semaphore.take(1)
            const channel = yield* pull
            const childPull = yield* toTransform(channel)(upstream, parentScope)
            yield* Effect.whileLoop({
              while: constTrue,
              body: constant(
                Effect.flatMap(childPull, (value) => mailbox.offer(value)),
              ),
              step: constVoid,
            }).pipe(
              Effect.onExit(
                (exit): Effect.Effect<void> =>
                  exit._tag === "Failure" && !isHaltCause(exit.cause)
                    ? Effect.andThen(
                        semaphore.release(1),
                        mailbox.failCause(exit.cause as Cause.Cause<OutErr1>),
                      )
                    : semaphore.release(1),
              ),
              Effect.forkIn(scope),
            )
          }
        }).pipe(
          Effect.onError((cause) =>
            // n-1 because of the failure
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
      Effect.flatMap(toTransform(self)(upstream, scope), (upstream) =>
        toTransform(that)(upstream, scope),
      ),
    ),
)

/**
 * Returns a new channel which embeds the given input handler into a Channel.
 *
 * @since 2.0.0
 * @category utils
 */
export const embedInput: {
  <InErr, InElem, InDone, R>(
    input: (
      upstream: Pull<InElem, InErr | Halt<InDone>>,
    ) => Effect.Effect<void, never, R>,
  ): <OutElem, OutErr, OutDone, Env>(
    self: Channel<OutElem, unknown, OutErr, unknown, OutDone, unknown, Env>,
  ) => Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env | R>
  <OutElem, OutErr, OutDone, Env, InErr, InElem, InDone, R>(
    self: Channel<OutElem, unknown, OutErr, unknown, OutDone, unknown, Env>,
    input: (
      upstream: Pull<InElem, InErr | Halt<InDone>>,
    ) => Effect.Effect<void, never, R>,
  ): Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env | R>
} = dual(
  2,
  <OutElem, OutErr, OutDone, Env, InErr, InElem, InDone, R>(
    self: Channel<OutElem, unknown, OutErr, unknown, OutDone, unknown, Env>,
    input: (
      upstream: Pull<InElem, InErr | Halt<InDone>>,
    ) => Effect.Effect<void, never, R>,
  ): Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env | R> =>
    makeImplScoped(
      Effect.fnUntraced(function* (upstream, scope, forkedScope) {
        yield* Effect.forkIn(input(upstream), forkedScope)
        return yield* toTransform(self)(haltVoid, scope)
      }),
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
  f: (pull: Pull<OutElem, OutErr, OutDone>) => Effect.Effect<void, EX, RX>,
  onHalt?: (leftover: OutDone) => Effect.Effect<AH, EH, RH>,
): Effect.Effect<AH, Halt.ExcludeHalt<EX> | EH, Env | RX | RH> =>
  Effect.suspend(() => {
    const scope = Scope.unsafeMake()
    const makePull = toTransform(self)(haltVoid as any, scope)
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
export const runDrain = <OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>(
  self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
): Effect.Effect<OutDone, OutErr, Env> =>
  runWith(self, (pull) =>
    Effect.whileLoop({
      while: constTrue,
      body: () => pull,
      step: constVoid,
    }),
  )

/**
 * @since 2.0.0
 * @category execution
 */
export const runForEach: {
  <OutElem, EX, RX>(
    f: (o: OutElem) => Effect.Effect<void, EX, RX>,
  ): <InElem, OutErr, InErr, OutDone, InDone, Env>(
    self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
  ) => Effect.Effect<OutDone, OutErr | EX, Env | RX>
  <OutElem, InElem, OutErr, InErr, OutDone, InDone, Env, EX, RX>(
    self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
    f: (o: OutElem) => Effect.Effect<void, EX, RX>,
  ): Effect.Effect<OutDone, OutErr | EX, Env | RX>
} = dual(
  2,
  <OutElem, InElem, OutErr, InErr, OutDone, InDone, Env, EX, RX>(
    self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
    f: (o: OutElem) => Effect.Effect<void, EX, RX>,
  ): Effect.Effect<OutDone, OutErr | EX, Env | RX> =>
    runWith(self, (pull) => {
      const pump = Effect.flatMap(pull, f)
      return Effect.whileLoop({
        while: constTrue,
        body: () => pump,
        step: constVoid,
      })
    }),
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
    const result: Array<OutElem> = []
    return runWith(
      self,
      (pull) =>
        Effect.whileLoop({
          while: constTrue,
          body: () => pull,
          step: (value) => {
            result.push(value)
          },
        }),
      () => Effect.succeed(result),
    )
  })

/**
 * @since 2.0.0
 * @category constructors
 */
export const toPull: <OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>(
  self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
) => Effect.Effect<Pull<OutElem, OutErr, OutDone>, never, Env | Scope.Scope> =
  Effect.fnUntraced(
    function* (self) {
      const context = yield* Effect.context<Scope.Scope>()
      const scope = Context.get(context, Scope.Scope)
      return yield* toTransform(self)(haltVoid as any, scope).pipe(
        Effect.provideContext(context),
      )
    },
    // ensure errors are redirected to the pull effect
    Effect.catchCause((cause) => Effect.succeed(Effect.failCause(cause))),
  )
