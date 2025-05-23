/**
 * @since 2.0.0
 */
import * as Array from "./Array.js"
import type * as Cause from "./Cause.js"
import * as Context from "./Context.js"
import type * as Duration from "./Duration.js"
import type * as Effect from "./Effect.js"
import type * as Fiber from "./Fiber.js"
import * as FileSystem from "./FileSystem.js"
import { dual } from "./Function.js"
import * as Inspectable from "./Inspectable.js"
import { isEffect, withFiber } from "./internal/core.js"
import * as effect from "./internal/effect.js"
import * as Layer from "./Layer.js"
import type * as LogLevel from "./LogLevel.js"
import type { Pipeable } from "./Pipeable.js"
import type { PlatformError } from "./PlatformError.js"
import * as Predicate from "./Predicate.js"
import { CurrentLogAnnotations, CurrentLogSpans } from "./References.js"
import type * as Scope from "./Scope.js"
import type * as Types from "./Types.js"

/**
 * @since 4.0.0
 * @category symbols
 */
export const TypeId: unique symbol = effect.LoggerTypeId

/**
 * @since 4.0.0
 * @category symbols
 */
export type TypeId = typeof TypeId

/**
 * @since 2.0.0
 * @category models
 */
export interface Logger<in Message, out Output> extends Logger.Variance<Message, Output>, Pipeable {
  log: (options: Logger.Options<Message>) => Output
}

/**
 * @since 2.0.0
 */
export declare namespace Logger {
  /**
   * @since 2.0.0
   * @category models
   */
  export interface Variance<in Message, out Output> {
    readonly [TypeId]: VarianceStruct<Message, Output>
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface VarianceStruct<in Message, out Output> {
    _Message: Types.Contravariant<Message>
    _Output: Types.Covariant<Output>
  }

  /**
   * @since 2.0.0
   * @category models
   */
  export interface Options<out Message> {
    readonly message: Message
    readonly logLevel: LogLevel.LogLevel
    readonly cause: Cause.Cause<unknown>
    readonly fiber: Fiber.Fiber<unknown, unknown>
    readonly date: Date
  }
}

/**
 * Returns `true` if the specified value is a `Logger`, otherwise returns `false`.
 *
 * @since 2.0.0
 * @category guards
 */
export const isLogger = (u: unknown): u is Logger<unknown, unknown> => Predicate.hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category references
 */
export const CurrentLoggers: Context.Reference<ReadonlySet<Logger<unknown, any>>> = effect.CurrentLoggers

/**
 * @since 2.0.0
 * @category utils
 */
export const map = dual<
  <Output, Output2>(
    f: (output: Output) => Output2
  ) => <Message>(
    self: Logger<Message, Output>
  ) => Logger<Message, Output2>,
  <Message, Output, Output2>(
    self: Logger<Message, Output>,
    f: (output: Output) => Output2
  ) => Logger<Message, Output2>
>(2, (self, f) => effect.loggerMake((options) => f(self.log(options))))

/**
 * Returns a new `Logger` that writes all output of the specified `Logger` to
 * the console using `console.log`.
 *
 * @since 2.0.0
 * @category utils
 */
export const withConsoleLog = <Message, Output>(
  self: Logger<Message, Output>
): Logger<Message, void> =>
  effect.loggerMake((options) => {
    const console = options.fiber.getRef(effect.CurrentConsole)
    return console.log(self.log(options))
  })
/**
 * Returns a new `Logger` that writes all output of the specified `Logger` to
 * the console using `console.error`.
 *
 * @since 2.0.0
 * @category utils
 */
export const withConsoleError = <Message, Output>(
  self: Logger<Message, Output>
): Logger<Message, void> =>
  effect.loggerMake((options) => {
    const console = options.fiber.getRef(effect.CurrentConsole)
    return console.error(self.log(options))
  })
/**
 * Returns a new `Logger` that writes all output of the specified `Logger` to
 * the console.
 *
 * Will use the appropriate console method (i.e. `console.log`, `console.error`,
 * etc.) based upon the current `LogLevel`.
 *
 * @since 2.0.0
 * @category utils
 */
export const withLeveledConsole = <Message, Output>(
  self: Logger<Message, Output>
): Logger<Message, void> =>
  effect.loggerMake((options) => {
    const console = options.fiber.getRef(effect.CurrentConsole)
    const output = self.log(options)
    switch (options.logLevel) {
      case "Debug":
        return console.debug(output)
      case "Info":
        return console.info(output)
      case "Trace":
        return console.trace(output)
      case "Warn":
        return console.warn(output)
      case "Error":
      case "Fatal":
        return console.error(output)
      default:
        return console.log(output)
    }
  })

/**
 * Match strings that do not contain any whitespace characters, double quotes,
 * or equal signs.
 */
const textOnly = /^[^\s"=]*$/

/**
 * Escapes double quotes in a string.
 */
const escapeDoubleQuotes = (s: string) => `"${s.replace(/\\([\s\S])|(")/g, "\\$1$2")}"`

/**
 * Formats the identifier of a `Fiber` by prefixing it with a hash tag.
 */
const formatFiberId = (fiberId: number) => `#${fiberId}`

/**
 * Used by both {@link formatSimple} and {@link formatLogFmt} to render a log
 * message.
 *
 * @internal
 */
const format = (
  quoteValue: (s: string) => string,
  whitespace?: number | string | undefined
) =>
({ date, fiber, logLevel, message }: Logger.Options<unknown>): string => {
  const formatValue = (value: string): string => value.match(textOnly) ? value : quoteValue(value)
  const format = (label: string, value: string): string => `${effect.formatLabel(label)}=${formatValue(value)}`
  const append = (label: string, value: string): string => " " + format(label, value)

  let out = format("timestamp", date.toISOString())
  out += append("level", logLevel)
  out += append("fiber", formatFiberId(fiber.id))

  const messages = Array.ensure(message)
  for (let i = 0; i < messages.length; i++) {
    out += append("message", Inspectable.toStringUnknown(messages[i], whitespace))
  }

  // TODO
  // if (!Cause.isEmptyType(cause)) {
  //   out += append("cause", Cause.pretty(cause, { renderErrorCause: true }))
  // }

  const now = date.getTime()
  const spans = fiber.getRef(CurrentLogSpans)
  for (const span of spans) {
    out += " " + effect.formatLogSpan(span, now)
  }

  const annotations = fiber.getRef(CurrentLogAnnotations)
  for (const [label, value] of Object.entries(annotations)) {
    out += append(label, Inspectable.toStringUnknown(value, whitespace))
  }

  return out
}

/**
 * @since 2.0.0
 * @category constructors
 */
export const make: <Message, Output>(
  log: (options: Logger.Options<Message>) => Output
) => Logger<Message, Output> = effect.loggerMake

/**
 * The default logging implementation used by the Effect runtime.
 *
 * @since 4.0.0
 * @category constructors
 */
export const defaultLogger: Logger<unknown, void> = effect.defaultLogger

/**
 * A `Logger` which outputs logs as a string.
 *
 * For example:
 * ```
 * timestamp=2025-01-03T14:22:47.570Z level=INFO fiber=#1 message=hello
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const formatSimple = effect.loggerMake(format(escapeDoubleQuotes))

/**
 * A `Logger` which outputs logs using the [logfmt](https://brandur.org/logfmt)
 * style.
 *
 * For example:
 * ```
 * timestamp=2025-01-03T14:22:47.570Z level=INFO fiber=#1 message=hello
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const formatLogFmt = effect.loggerMake(format(JSON.stringify, 0))

/**
 * A `Logger` which outputs logs using a structured format.
 *
 * For example:
 * ```
 * {
 *   message: [ 'hello' ],
 *   level: 'INFO',
 *   timestamp: '2025-01-03T14:25:39.666Z',
 *   annotations: { key: 'value' },
 *   spans: { label: 0 },
 *   fiberId: '#1'
 * }
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const formatStructured: Logger<unknown, {
  readonly level: string
  readonly fiberId: string
  readonly timestamp: string
  readonly message: unknown
  // TODO
  // readonly cause: string | undefined
  readonly annotations: Record<string, unknown>
  readonly spans: Record<string, number>
}> = effect.loggerMake(({ date, fiber, logLevel, message }) => {
  const annotationsObj: Record<string, unknown> = {}
  const spansObj: Record<string, number> = {}

  const annotations = fiber.getRef(CurrentLogAnnotations)
  for (const [key, value] of Object.entries(annotations)) {
    annotationsObj[key] = effect.structuredMessage(value)
  }

  const now = date.getTime()
  const spans = fiber.getRef(CurrentLogSpans)
  for (const [label, timestamp] of spans) {
    spansObj[label] = now - timestamp
  }

  const messageArr = Array.ensure(message)
  return {
    message: messageArr.length === 1
      ? effect.structuredMessage(messageArr[0])
      : messageArr.map(effect.structuredMessage),
    level: logLevel.toUpperCase(),
    timestamp: date.toISOString(),
    // TODO
    // cause: Cause.isEmpty(cause) ? undefined : Cause.pretty(cause, { renderErrorCause: true }),
    annotations: annotationsObj,
    spans: spansObj,
    fiberId: formatFiberId(fiber.id)
  }
})

/**
 * A `Logger` which outputs logs using a structured format serialized as JSON
 * on a single line.
 *
 * For example:
 * ```
 * {"message":["hello"],"level":"INFO","timestamp":"2025-01-03T14:28:57.508Z","annotations":{"key":"value"},"spans":{"label":0},"fiberId":"#1"}
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const formatJson = map(formatStructured, Inspectable.stringifyCircular)

/**
 * Returns a new `Logger` which will aggregate logs output by the specified
 * `Logger` over the provided `window`. After the `window` has elapsed, the
 * provided `flush` function will be called with the logs aggregated during
 * the last `window`.
 *
 * @since 4.0.0
 * @category constructors
 */
export const batched = dual<
  <Output>(options: {
    readonly window: Duration.DurationInput
    readonly flush: (messages: Array<NoInfer<Output>>) => Effect.Effect<void>
  }) => <Message>(
    self: Logger<Message, Output>
  ) => Effect.Effect<Logger<Message, void>, never, Scope.Scope>,
  <Message, Output>(
    self: Logger<Message, Output>,
    options: {
      readonly window: Duration.DurationInput
      readonly flush: (messages: Array<NoInfer<Output>>) => Effect.Effect<void>
    }
  ) => Effect.Effect<Logger<Message, void>, never, Scope.Scope>
>(2, <Message, Output>(
  self: Logger<Message, Output>,
  options: {
    readonly window: Duration.DurationInput
    readonly flush: (messages: Array<NoInfer<Output>>) => Effect.Effect<void>
  }
): Effect.Effect<Logger<Message, void>, never, Scope.Scope> =>
  effect.flatMap(effect.scope, (scope) => {
    let buffer: Array<Output> = []
    const flush = effect.suspend(() => {
      if (buffer.length === 0) {
        return effect.void
      }
      const arr = buffer
      buffer = []
      return options.flush(arr)
    })

    return effect.uninterruptibleMask((restore) =>
      restore(
        effect.sleep(options.window).pipe(
          effect.andThen(flush),
          effect.forever
        )
      ).pipe(
        effect.forkDaemon,
        effect.flatMap((fiber) => effect.scopeAddFinalizer(scope, () => effect.fiberInterrupt(fiber))),
        effect.andThen(effect.addFinalizer(() => flush)),
        effect.as(
          effect.loggerMake((options) => {
            buffer.push(self.log(options))
          })
        )
      )
    )
  }))

/**
 * A `Logger` which outputs logs in a "pretty" format and writes them to the
 * console.
 *
 * For example:
 * ```
 * [09:37:17.579] INFO (#1) label=0ms: hello
 *   key: value
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const consolePretty: (
  options?: {
    readonly colors?: "auto" | boolean | undefined
    readonly stderr?: boolean | undefined
    readonly formatDate?: ((date: Date) => string) | undefined
    readonly mode?: "browser" | "tty" | "auto" | undefined
  }
) => Logger<unknown, void> = effect.consolePretty

/**
 * A `Logger` which outputs logs using the [logfmt](https://brandur.org/logfmt)
 * style and writes them to the console.
 *
 * For example:
 * ```
 * timestamp=2025-01-03T14:22:47.570Z level=INFO fiber=#1 message=info
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const consoleLogFmt: Logger<unknown, void> = withConsoleLog(formatLogFmt)

/**
 * A `Logger` which outputs logs using a strctured format and writes them to
 * the console.
 *
 * For example:
 * ```
 * {
 *   message: [ 'info', 'message' ],
 *   level: 'INFO',
 *   timestamp: '2025-01-03T14:25:39.666Z',
 *   annotations: { key: 'value' },
 *   spans: { label: 0 },
 *   fiberId: '#1'
 * }
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const consoleStructured: Logger<unknown, void> = withConsoleLog(formatStructured)

/**
 * A `Logger` which outputs logs using a structured format serialized as JSON
 * on a single line and writes them to the console.
 *
 * For example:
 * ```
 * {"message":["hello"],"level":"INFO","timestamp":"2025-01-03T14:28:57.508Z","annotations":{"key":"value"},"spans":{"label":0},"fiberId":"#1"}
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const consoleJson: Logger<unknown, void> = withConsoleLog(formatJson)

/**
 * Creates a `Layer` which will overwrite the current set of loggers with the
 * specified array of `loggers`.
 *
 * If the specified array of `loggers` should be _merged_ with the current set
 * of loggers (instead of overwriting them), set `mergeWithExisting` to `true`.
 *
 * @since 4.0.0
 * @category context
 */
export const layer = <
  const Loggers extends ReadonlyArray<Logger<unknown, unknown> | Effect.Effect<Logger<unknown, unknown>, any, any>>
>(
  loggers: Loggers,
  options?: { mergeWithExisting: boolean }
): Layer.Layer<
  never,
  Loggers[number] extends Effect.Effect<infer _A, infer _E, infer _R> ? _E : never,
  Exclude<
    Loggers[number] extends Effect.Effect<infer _A, infer _E, infer _R> ? _R : never,
    Scope.Scope
  >
> =>
  Layer.effectContext(
    withFiber(effect.fnUntraced(function*(fiber) {
      const currentLoggers = new Set(options?.mergeWithExisting === true ? fiber.getRef(effect.CurrentLoggers) : [])
      for (const logger of loggers) {
        currentLoggers.add(isEffect(logger) ? yield* logger : logger)
      }
      return Context.make(effect.CurrentLoggers, currentLoggers)
    }))
  )

/**
 * Create a Logger from another string Logger that writes to the specified file.
 *
 * **Example**
 *
 * ```ts
 * import { NodeFileSystem, NodeRuntime } from "@effect/platform-node"
 * import { Effect, Layer, Logger } from "effect"
 *
 * const fileLogger = Logger.formatJson.pipe(
 *   Logger.toFile("/tmp/log.txt")
 * )
 * const LoggerLive = Logger.layer([fileLogger]).pipe(
 *   Layer.provide(NodeFileSystem.layer)
 * )
 *
 * Effect.log("a").pipe(
 *   Effect.andThen(Effect.log("b")),
 *   Effect.andThen(Effect.log("c")),
 *   Effect.provide(LoggerLive),
 *   NodeRuntime.runMain
 * )
 * ```
 *
 * @since 4.0.0
 */
export const toFile = dual<
  (
    path: string,
    options?:
      | FileSystem.OpenFileOptions & {
        readonly batchWindow?: Duration.DurationInput | undefined
      }
      | undefined
  ) => <Message>(
    self: Logger<Message, string>
  ) => Effect.Effect<Logger<Message, void>, PlatformError, Scope.Scope | FileSystem.FileSystem>,
  <Message>(
    self: Logger<Message, string>,
    path: string,
    options?:
      | FileSystem.OpenFileOptions & {
        readonly batchWindow?: Duration.DurationInput | undefined
      }
      | undefined
  ) => Effect.Effect<Logger<Message, void>, PlatformError, Scope.Scope | FileSystem.FileSystem>
>(
  (args) => isLogger(args[0]),
  (self, path, options) =>
    effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const logFile = yield* fs.open(path, { flag: "a+", ...options })
      const encoder = new TextEncoder()
      return yield* batched(self, {
        window: options?.batchWindow ?? 1000,
        flush: (output) => effect.ignore(logFile.write(encoder.encode(output.join("\n") + "\n")))
      })
    })
)
