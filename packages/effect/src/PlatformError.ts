/**
 * @since 4.0.0
 */
import type * as Cause from "effect/Cause"
import * as Data from "effect/Data"
import * as Predicate from "effect/Predicate"
import type { Simplify } from "effect/Types"

/**
 * @since 4.0.0
 * @category type id
 */
export const PlatformErrorTypeId: unique symbol = Symbol.for("effect/PlatformError")

/**
 * @since 4.0.0
 * @category type id
 */
export type PlatformErrorTypeId = typeof PlatformErrorTypeId

/**
 * @since 4.0.0
 * @category refinements
 */
export const isPlatformError = (u: unknown): u is PlatformError => Predicate.hasProperty(u, PlatformErrorTypeId)

/**
 * @since 4.0.0
 * @category error
 */
export type PlatformError = BadArgument | SystemError

/**
 * @since 4.0.0
 * @category error
 */
export const TypeIdError = <const TypeId extends symbol, const Tag extends string>(
  typeId: TypeId,
  tag: Tag
): new<A extends Record<string, any>>(
  args: Simplify<A>
) =>
  & Cause.YieldableError
  & Record<TypeId, TypeId>
  & { readonly _tag: Tag }
  & Readonly<A> =>
{
  class Base extends Data.Error<{}> {
    readonly _tag = tag
  }
  ;(Base.prototype as any)[typeId] = typeId
  ;(Base.prototype as any).name = tag
  return Base as any
}

/**
 * @since 4.0.0
 */
export declare namespace PlatformError {
  /**
   * @since 4.0.0
   * @category models
   */
  export interface Base {
    readonly [PlatformErrorTypeId]: typeof PlatformErrorTypeId
    readonly _tag: string
    readonly module: "Clipboard" | "Command" | "FileSystem" | "KeyValueStore" | "Path" | "Stream" | "Terminal"
    readonly method: string
    readonly message: string
  }

  /**
   * @since 4.0.0
   */
  export type ProvidedFields = PlatformErrorTypeId | "_tag"
}

const make = <A extends PlatformError>(tag: A["_tag"]) => (props: Omit<A, PlatformError.ProvidedFields>): A =>
  Data.struct({
    [PlatformErrorTypeId]: PlatformErrorTypeId,
    _tag: tag,
    ...props
  } as A)

/**
 * @since 4.0.0
 * @category error
 */
export interface BadArgument extends PlatformError.Base {
  readonly _tag: "BadArgument"
}

/**
 * @since 4.0.0
 * @category error
 */
export const BadArgument: (props: Omit<BadArgument, PlatformError.ProvidedFields>) => BadArgument = make("BadArgument")

/**
 * @since 4.0.0
 * @category model
 */
export type SystemErrorReason =
  | "AlreadyExists"
  | "BadResource"
  | "Busy"
  | "InvalidData"
  | "NotFound"
  | "PermissionDenied"
  | "TimedOut"
  | "UnexpectedEof"
  | "Unknown"
  | "WouldBlock"
  | "WriteZero"

/**
 * @since 4.0.0
 * @category models
 */
export interface SystemError extends PlatformError.Base {
  readonly _tag: "SystemError"
  readonly reason: SystemErrorReason
  readonly syscall?: string | undefined
  readonly pathOrDescriptor: string | number
}

/**
 * @since 4.0.0
 * @category error
 */
export const SystemError: (props: Omit<SystemError, PlatformError.ProvidedFields>) => SystemError = make("SystemError")
