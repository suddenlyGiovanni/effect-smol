/**
 * @since 4.0.0
 */

import type { StandardSchemaV1 } from "@standard-schema/spec"
import * as Arr from "./Array.js"
import type { Brand } from "./Brand.js"
import type * as Cause from "./Cause.js"
import * as Data from "./Data.js"
import * as Effect from "./Effect.js"
import * as Exit from "./Exit.js"
import { identity } from "./Function.js"
import * as core from "./internal/core.js"
import { ownKeys } from "./internal/schema/util.js"
import * as O from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"
import * as Predicate from "./Predicate.js"
import * as Request from "./Request.js"
import * as Result from "./Result.js"
import * as Scheduler from "./Scheduler.js"
import type * as SchemaAnnotations from "./SchemaAnnotations.js"
import * as SchemaAST from "./SchemaAST.js"
import * as SchemaCheck from "./SchemaCheck.js"
import * as SchemaFormatter from "./SchemaFormatter.js"
import * as SchemaGetter from "./SchemaGetter.js"
import * as SchemaIssue from "./SchemaIssue.js"
import * as SchemaResult from "./SchemaResult.js"
import * as SchemaToParser from "./SchemaToParser.js"
import * as SchemaTransformation from "./SchemaTransformation.js"
import * as Struct_ from "./Struct.js"

/**
 * @category Type-Level Programming
 * @since 4.0.0
 */
export type Simplify<T> = { [K in keyof T]: T[K] } & {}

/**
 * @since 4.0.0
 */
export type Mutable<T> = { -readonly [K in keyof T]: T[K] } & {}

/**
 * Used in {@link extend}.
 *
 * @category Type-Level Programming
 * @since 4.0.0
 */
export type Merge<T, U> = keyof T & keyof U extends never ? T & U : Omit<T, keyof T & keyof U> & U

type OptionalToken = "required" | "optional"
type ReadonlyToken = "readonly" | "mutable"
type DefaultConstructorToken = "no-constructor-default" | "has-constructor-default"

/**
 * @category Model
 * @since 4.0.0
 */
export interface MakeOptions {
  readonly parseOptions?: SchemaAST.ParseOptions | undefined
  readonly disableValidation?: boolean | undefined
}

/**
 * @since 4.0.0
 * @category Symbols
 */
export const TypeId: unique symbol = globalThis.Symbol.for("effect/Bottom") as TypeId

/**
 * @since 4.0.0
 * @category Symbols
 */
export type TypeId = typeof TypeId

/**
 * @category Model
 * @since 4.0.0
 */
export interface Bottom<
  T,
  E,
  RD,
  RE,
  Ast extends SchemaAST.AST,
  RebuildOut extends Top,
  AnnotateIn extends SchemaAnnotations.Annotations,
  TypeMakeIn = T,
  TypeMake = TypeMakeIn,
  TypeReadonly extends ReadonlyToken = "readonly",
  TypeIsOptional extends OptionalToken = "required",
  TypeDefault extends DefaultConstructorToken = "no-constructor-default",
  EncodedIsReadonly extends ReadonlyToken = "readonly",
  EncodedIsOptional extends OptionalToken = "required"
> extends Pipeable {
  readonly [TypeId]: TypeId

  readonly ast: Ast
  readonly "~rebuild.out": RebuildOut
  readonly "~annotate.in": AnnotateIn

  readonly "Type": T
  readonly "Encoded": E
  readonly "DecodingContext": RD
  readonly "EncodingContext": RE

  readonly "~type.make.in": TypeMakeIn
  readonly "~type.make": TypeMake
  readonly "~type.isReadonly": TypeReadonly
  readonly "~type.isOptional": TypeIsOptional
  readonly "~type.default": TypeDefault

  readonly "~encoded.isReadonly": EncodedIsReadonly
  readonly "~encoded.isOptional": EncodedIsOptional

  annotate(annotations: this["~annotate.in"]): this["~rebuild.out"]
  rebuild(ast: this["ast"]): this["~rebuild.out"]
  /**
   * @throws {Error} The issue is contained in the error cause.
   */
  makeSync(input: this["~type.make.in"], options?: MakeOptions): this["Type"]
  check(
    ...checks: readonly [
      SchemaCheck.SchemaCheck<this["Type"]>,
      ...ReadonlyArray<SchemaCheck.SchemaCheck<this["Type"]>>
    ]
  ): this["~rebuild.out"]
}

/**
 * @since 4.0.0
 */
export function revealBottom<S extends Top>(
  bottom: S
): Bottom<
  S["Type"],
  S["Encoded"],
  S["DecodingContext"],
  S["EncodingContext"],
  S["ast"],
  S["~rebuild.out"],
  S["~annotate.in"],
  S["~type.make.in"],
  S["~type.make"],
  S["~type.isReadonly"],
  S["~type.isOptional"],
  S["~type.default"],
  S["~encoded.isReadonly"],
  S["~encoded.isOptional"]
> {
  return bottom
}

/**
 * @since 4.0.0
 */
export function annotate<S extends Top>(annotations: S["~annotate.in"]) {
  return (self: S): S["~rebuild.out"] => {
    return self.annotate(annotations)
  }
}

/**
 * @since 4.0.0
 */
export function annotateKey<S extends Top>(annotations: SchemaAnnotations.Documentation) {
  return (self: S): S["~rebuild.out"] => {
    return self.rebuild(SchemaAST.annotateKey(self.ast, annotations))
  }
}

/**
 * @since 4.0.0
 */
export abstract class Bottom$<
  T,
  E,
  RD,
  RE,
  Ast extends SchemaAST.AST,
  RebuildOut extends Top,
  AnnotateIn extends SchemaAnnotations.Annotations,
  TypeMakeIn = T,
  TypeMake = TypeMakeIn,
  TypeReadonly extends ReadonlyToken = "readonly",
  TypeIsOptional extends OptionalToken = "required",
  TypeDefault extends DefaultConstructorToken = "no-constructor-default",
  EncodedIsReadonly extends ReadonlyToken = "readonly",
  EncodedIsOptional extends OptionalToken = "required"
> implements
  Bottom<
    T,
    E,
    RD,
    RE,
    Ast,
    RebuildOut,
    AnnotateIn,
    TypeMakeIn,
    TypeMake,
    TypeReadonly,
    TypeIsOptional,
    TypeDefault,
    EncodedIsReadonly,
    EncodedIsOptional
  >
{
  readonly [TypeId]: TypeId = TypeId

  declare readonly "Type": T
  declare readonly "Encoded": E
  declare readonly "DecodingContext": RD
  declare readonly "EncodingContext": RE

  declare readonly "~rebuild.out": RebuildOut
  declare readonly "~annotate.in": AnnotateIn

  declare readonly "~type.make.in": TypeMakeIn
  declare readonly "~type.make": TypeMake
  declare readonly "~type.isReadonly": TypeReadonly
  declare readonly "~type.isOptional": TypeIsOptional
  declare readonly "~type.default": TypeDefault

  declare readonly "~encoded.isReadonly": EncodedIsReadonly
  declare readonly "~encoded.isOptional": EncodedIsOptional

  readonly makeSync: (input: this["~type.make.in"], options?: MakeOptions) => this["Type"]

  constructor(readonly ast: Ast) {
    this.makeSync = SchemaToParser.makeSync(this)
  }
  abstract rebuild(ast: this["ast"]): this["~rebuild.out"]
  pipe() {
    return pipeArguments(this, arguments)
  }
  annotate(annotations: this["~annotate.in"]): this["~rebuild.out"] {
    return this.rebuild(SchemaAST.annotate(this.ast, annotations))
  }
  check(
    ...checks: readonly [
      SchemaCheck.SchemaCheck<this["Type"]>,
      ...ReadonlyArray<SchemaCheck.SchemaCheck<this["Type"]>>
    ]
  ): this["~rebuild.out"] {
    return this.rebuild(SchemaAST.appendChecks(this.ast, checks))
  }
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Top extends
  Bottom<
    unknown,
    unknown,
    unknown,
    unknown,
    SchemaAST.AST,
    Top,
    SchemaAnnotations.Annotations,
    unknown,
    unknown,
    ReadonlyToken,
    OptionalToken,
    DefaultConstructorToken,
    ReadonlyToken,
    OptionalToken
  >
{}

/**
 * @since 4.0.0
 */
export declare namespace Schema {
  /**
   * @since 4.0.0
   */
  export type Type<S extends Top> = S["Type"]
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Schema<out T> extends Top {
  readonly "Type": T
  readonly "~rebuild.out": Schema<T>
}

/**
 * @since 4.0.0
 */
export declare namespace Codec {
  /**
   * @since 4.0.0
   */
  export type Encoded<S extends Top> = S["Encoded"]
  /**
   * @since 4.0.0
   */
  export type DecodingContext<S extends Top> = S["DecodingContext"]
  /**
   * @since 4.0.0
   */
  export type EncodingContext<S extends Top> = S["EncodingContext"]
  /**
   * @since 4.0.0
   */
  export type ToAsserts<S extends Top & { readonly DecodingContext: never }> = (
    input: unknown
  ) => asserts input is S["Type"]
}

/**
 * @category Model
 * @since 4.0.0
 */
export interface Codec<out T, out E = T, out RD = never, out RE = never> extends Schema<T> {
  readonly "Encoded": E
  readonly "DecodingContext": RD
  readonly "EncodingContext": RE
  readonly "~rebuild.out": Codec<T, E, RD, RE>
}

/**
 * Returns the underlying `Codec<T, E, RD, RE>`.
 *
 * @since 4.0.0
 */
export function revealCodec<T, E, RD, RE>(codec: Codec<T, E, RD, RE>) {
  return codec
}

/**
 * @since 4.0.0
 * @category error
 */
export class SchemaError extends Data.TaggedError("SchemaError")<{
  readonly issue: SchemaIssue.Issue
}> {}

function makeStandardResult<A>(exit: Exit.Exit<StandardSchemaV1.Result<A>>): StandardSchemaV1.Result<A> {
  return Exit.isSuccess(exit) ? exit.value : {
    issues: [{ message: SchemaFormatter.formatCause(exit.cause) }]
  }
}

/**
 * Returns a "Standard Schema" object conforming to the [Standard Schema
 * v1](https://standardschema.dev/) specification.
 *
 * This function creates a schema whose `validate` method attempts to decode and
 * validate the provided input synchronously. If the underlying `Schema`
 * includes any asynchronous components (e.g., asynchronous message resolutions
 * or checks), then validation will necessarily return a `Promise` instead.
 *
 * @example
 * ```ts
 * import { Schema } from "effect"
 *
 * const schema = Schema.Struct({
 *   name: Schema.String
 * })
 *
 * //      ┌─── StandardSchemaV1<{ readonly name: string; }>
 * //      ▼
 * const standardSchema = Schema.standardSchemaV1(schema)
 * ```
 *
 * @category Standard Schema
 * @since 3.13.0
 */
export const standardSchemaV1 = <S extends Top>(
  self: S,
  options?: SchemaAST.ParseOptions
): StandardSchemaV1<S["Encoded"], S["Type"]> & S => {
  const decodeUnknownEffect = SchemaToParser.decodeUnknownEffect(self) as (
    input: unknown,
    options?: SchemaAST.ParseOptions
  ) => Effect.Effect<S["Type"], SchemaIssue.Issue, never>
  options = { errors: "all", ...options }
  const standard: StandardSchemaV1<S["Encoded"], S["Type"]> = {
    "~standard": {
      version: 1,
      vendor: "effect",
      validate(value) {
        const scheduler = new Scheduler.MixedScheduler()
        const fiber = Effect.runFork(
          Effect.match(decodeUnknownEffect(value, options), {
            onFailure: SchemaFormatter.StandardFormatter.format,
            onSuccess: (value): StandardSchemaV1.Result<S["Type"]> => ({ value })
          }),
          { scheduler }
        )
        scheduler.flush()
        const exit = fiber.unsafePoll()
        if (exit) {
          return makeStandardResult(exit)
        }
        return new Promise((resolve) => {
          fiber.addObserver((exit) => {
            resolve(makeStandardResult(exit))
          })
        })
      }
    }
  }
  return Object.assign(self, standard)
}

/**
 * @category Asserting
 * @since 4.0.0
 */
export const is = SchemaToParser.is

/**
 * @category Asserting
 * @since 4.0.0
 */
export const asserts = SchemaToParser.asserts

/**
 * @category Decoding
 * @since 4.0.0
 */
export function decodeUnknownEffect<T, E, RD, RE>(codec: Codec<T, E, RD, RE>) {
  const parser = SchemaToParser.decodeUnknownEffect(codec)
  return (input: unknown, options?: SchemaAST.ParseOptions): Effect.Effect<T, SchemaError, RD> => {
    return Effect.mapError(parser(input, options), (issue) => new SchemaError({ issue }))
  }
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeEffect: <T, E, RD, RE>(
  codec: Codec<T, E, RD, RE>
) => (input: E, options?: SchemaAST.ParseOptions) => Effect.Effect<T, SchemaError, RD> = decodeUnknownEffect

/**
 * @category Decoding
 * @since 4.0.0
 */
export function decodeUnknownResult<T, E, RE>(codec: Codec<T, E, never, RE>) {
  const parser = SchemaToParser.decodeUnknownResult(codec)
  return (input: E, options?: SchemaAST.ParseOptions): Result.Result<T, SchemaError> => {
    return Result.mapErr(parser(input, options), (issue) => new SchemaError({ issue }))
  }
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeResult: <T, E, RE>(
  codec: Codec<T, E, never, RE>
) => (input: E, options?: SchemaAST.ParseOptions) => Result.Result<T, SchemaError> = decodeUnknownResult

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeUnknownOption = SchemaToParser.decodeUnknownOption

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeOption = SchemaToParser.decodeOption

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeUnknownPromise = SchemaToParser.decodeUnknownPromise

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodePromise = SchemaToParser.decodePromise

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeUnknownSync = SchemaToParser.decodeUnknownSync

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeSync = SchemaToParser.decodeSync

/**
 * @category Encoding
 * @since 4.0.0
 */
export function encodeUnknownEffect<T, E, RD, RE>(codec: Codec<T, E, RD, RE>) {
  const parser = SchemaToParser.encodeUnknownEffect(codec)
  return (input: unknown, options?: SchemaAST.ParseOptions): Effect.Effect<E, SchemaError, RE> => {
    return Effect.mapError(parser(input, options), (issue) => new SchemaError({ issue }))
  }
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeEffect: <T, E, RD, RE>(
  codec: Codec<T, E, RD, RE>
) => (input: T, options?: SchemaAST.ParseOptions) => Effect.Effect<E, SchemaError, RE> = encodeUnknownEffect

/**
 * @category Encoding
 * @since 4.0.0
 */
export function encodeUnknownResult<T, E, RD>(codec: Codec<T, E, RD, never>) {
  const parser = SchemaToParser.encodeUnknownResult(codec)
  return (input: unknown, options?: SchemaAST.ParseOptions): Result.Result<E, SchemaError> => {
    return Result.mapErr(parser(input, options), (issue) => new SchemaError({ issue }))
  }
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeResult: <T, E, RD>(
  codec: Codec<T, E, RD, never>
) => (input: E, options?: SchemaAST.ParseOptions) => Result.Result<E, SchemaError> = encodeUnknownResult

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeUnknownOption = SchemaToParser.encodeUnknownOption

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodePromise = SchemaToParser.encodePromise

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeUnknownPromise = SchemaToParser.encodeUnknownPromise

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeOption = SchemaToParser.encodeOption

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeUnknownSync = SchemaToParser.encodeUnknownSync

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeSync = SchemaToParser.encodeSync

class make$<S extends Top> extends Bottom$<
  S["Type"],
  S["Encoded"],
  S["DecodingContext"],
  S["EncodingContext"],
  S["ast"],
  S["~rebuild.out"],
  S["~annotate.in"],
  S["~type.make.in"],
  S["~type.make"],
  S["~type.isReadonly"],
  S["~type.isOptional"],
  S["~type.default"],
  S["~encoded.isReadonly"],
  S["~encoded.isOptional"]
> {
  constructor(
    ast: S["ast"],
    readonly rebuild: (ast: S["ast"]) => S["~rebuild.out"]
  ) {
    super(ast)
  }
}

class makeWithSchema$<S extends Top, Result extends Top> extends make$<Result> {
  constructor(ast: SchemaAST.AST, readonly schema: S) {
    super(ast, (ast) => new makeWithSchema$(ast, this.schema))
  }
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function make<S extends Top>(ast: S["ast"]): Bottom<
  S["Type"],
  S["Encoded"],
  S["DecodingContext"],
  S["EncodingContext"],
  S["ast"],
  S["~rebuild.out"],
  S["~annotate.in"],
  S["~type.make.in"],
  S["~type.make"],
  S["~type.isReadonly"],
  S["~type.isOptional"],
  S["~type.default"],
  S["~encoded.isReadonly"],
  S["~encoded.isOptional"]
> {
  const rebuild = (ast: SchemaAST.AST) => new make$<S>(ast, rebuild)
  return rebuild(ast)
}

/**
 * Tests if a value is a `Schema`.
 *
 * @category guards
 * @since 4.0.0
 */
export function isSchema(u: unknown): u is Schema<unknown> {
  return Predicate.hasProperty(u, TypeId) && u[TypeId] === TypeId
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface optionalKey<S extends Top> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
    S["ast"],
    optionalKey<S>,
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.isReadonly"],
    "optional",
    S["~type.default"],
    S["~encoded.isReadonly"],
    "optional"
  >
{
  readonly schema: S
}

/**
 * @since 4.0.0
 */
export function optionalKey<S extends Top>(schema: S): optionalKey<S> {
  return new makeWithSchema$<S, optionalKey<S>>(SchemaAST.optionalKey(schema.ast), schema)
}

/**
 * Equivalent to `optionalKey(UndefinedOr(schema))`.
 *
 * @since 4.0.0
 */
export function optional<S extends Top>(schema: S): optionalKey<Union<readonly [S, Undefined]>> {
  return optionalKey(UndefinedOr(schema))
}

/**
 * @since 4.0.0
 */
export interface mutableKey<S extends Top> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
    S["ast"],
    mutableKey<S>,
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    "mutable",
    S["~type.isOptional"],
    S["~type.default"],
    "mutable",
    S["~encoded.isOptional"]
  >
{
  readonly schema: S
}

/**
 * @since 4.0.0
 */
export function mutableKey<S extends Top>(schema: S): mutableKey<S> {
  return new makeWithSchema$<S, mutableKey<S>>(SchemaAST.mutableKey(schema.ast), schema)
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface typeCodec<S extends Top> extends
  Bottom<
    S["Type"],
    S["Type"],
    never,
    never,
    S["ast"],
    typeCodec<S>,
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.isReadonly"],
    S["~type.isOptional"],
    S["~type.default"],
    S["~encoded.isReadonly"],
    S["~encoded.isOptional"]
  >
{}

/**
 * @since 4.0.0
 */
export function typeCodec<S extends Top>(schema: S): typeCodec<S> {
  return make<typeCodec<S>>(SchemaAST.typeAST(schema.ast))
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface encodedCodec<S extends Top> extends
  Bottom<
    S["Encoded"],
    S["Encoded"],
    never,
    never,
    SchemaAST.AST,
    encodedCodec<S>,
    SchemaAnnotations.Annotations,
    S["Encoded"],
    S["Encoded"],
    S["~type.isReadonly"],
    S["~type.isOptional"],
    S["~type.default"],
    S["~encoded.isReadonly"],
    S["~encoded.isOptional"]
  >
{}

/**
 * @since 4.0.0
 */
export function encodedCodec<S extends Top>(schema: S): encodedCodec<S> {
  return make<encodedCodec<S>>(SchemaAST.encodedAST(schema.ast))
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface flip<S extends Top> extends
  Bottom<
    S["Encoded"],
    S["Type"],
    S["EncodingContext"],
    S["DecodingContext"],
    SchemaAST.AST,
    flip<S>,
    SchemaAnnotations.Annotations,
    S["Encoded"],
    S["Encoded"],
    S["~encoded.isReadonly"],
    S["~encoded.isOptional"],
    DefaultConstructorToken,
    S["~type.isReadonly"],
    S["~type.isOptional"]
  >
{
  readonly schema: S
}

const FLIP_ID = "~effect/flip$"

class flip$<S extends Top> extends makeWithSchema$<S, flip<S>> implements flip<S> {
  readonly [FLIP_ID] = FLIP_ID
}

function isFlip$(schema: Top): schema is flip<any> {
  return Predicate.hasProperty(schema, FLIP_ID) && schema[FLIP_ID] === FLIP_ID
}

/**
 * @since 4.0.0
 */
export function flip<S extends Top>(schema: S): S extends flip<infer F> ? F["~rebuild.out"] : flip<S>
export function flip<S extends Top>(schema: S): flip<S> {
  if (isFlip$(schema)) {
    return schema.schema.rebuild(SchemaAST.flip(schema.ast))
  }
  return new flip$(SchemaAST.flip(schema.ast), schema)
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface declare<T, E, TypeParameters extends ReadonlyArray<Top>> extends
  Bottom<
    T,
    E,
    TypeParameters[number]["DecodingContext"],
    TypeParameters[number]["EncodingContext"],
    SchemaAST.Declaration,
    declare<T, E, TypeParameters>,
    SchemaAnnotations.Declaration<T, TypeParameters>
  >
{}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Literal<L extends SchemaAST.LiteralValue>
  extends Bottom<L, L, never, never, SchemaAST.LiteralType, Literal<L>, SchemaAnnotations.Annotations>
{
  readonly literal: L
}

class Literal$<L extends SchemaAST.LiteralValue> extends make$<Literal<L>> implements Literal<L> {
  constructor(ast: SchemaAST.LiteralType, readonly literal: L) {
    super(ast, (ast) => new Literal$(ast, literal))
  }
}

/**
 * @since 4.0.0
 */
export function Literal<L extends SchemaAST.LiteralValue>(literal: L): Literal<L> {
  return new Literal$(new SchemaAST.LiteralType(literal, undefined, undefined, undefined, undefined), literal)
}

/**
 * @since 4.0.0
 */
export declare namespace TemplateLiteral {
  /**
   * @since 4.0.0
   */
  export interface SchemaPart extends Top {
    readonly Encoded: string | number | bigint
  }
  /**
   * @since 4.0.0
   */
  export type Part = SchemaPart | SchemaAST.TemplateLiteral.LiteralPart
  /**
   * @since 4.0.0
   */
  export type Parts = ReadonlyArray<Part>

  type AppendType<
    Template extends string,
    Next
  > = Next extends SchemaAST.TemplateLiteral.LiteralPart ? `${Template}${Next}`
    : Next extends Codec<unknown, infer E extends SchemaAST.TemplateLiteral.LiteralPart, unknown, unknown> ?
      `${Template}${E}`
    : never

  /**
   * @since 4.0.0
   */
  export type Encoded<Parts> = Parts extends readonly [...infer Init, infer Last] ? AppendType<Encoded<Init>, Last>
    : ``
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface TemplateLiteral<Parts extends TemplateLiteral.Parts> extends
  Bottom<
    TemplateLiteral.Encoded<Parts>,
    TemplateLiteral.Encoded<Parts>,
    never,
    never,
    SchemaAST.TemplateLiteral,
    TemplateLiteral<Parts>,
    SchemaAnnotations.Annotations
  >
{
  readonly parts: Parts
}

class TemplateLiteral$<Parts extends TemplateLiteral.Parts> extends make$<TemplateLiteral<Parts>>
  implements TemplateLiteral<Parts>
{
  constructor(ast: SchemaAST.TemplateLiteral, readonly parts: Parts) {
    super(ast, (ast) => new TemplateLiteral$(ast, parts))
  }
}

function templateLiteralFromParts<Parts extends TemplateLiteral.Parts>(parts: Parts) {
  return new SchemaAST.TemplateLiteral(
    parts.map((part) => isSchema(part) ? part.ast : part),
    undefined,
    undefined,
    undefined,
    undefined
  )
}

/**
 * @since 4.0.0
 */
export function TemplateLiteral<const Parts extends TemplateLiteral.Parts>(parts: Parts): TemplateLiteral<Parts> {
  return new TemplateLiteral$(
    templateLiteralFromParts(parts),
    [...parts] as Parts
  )
}

/**
 * @since 4.0.0
 */
export declare namespace TemplateLiteralParser {
  /**
   * @since 4.0.0
   */
  export type Type<Parts> = Parts extends readonly [infer Head, ...infer Tail] ? readonly [
      Head extends SchemaAST.TemplateLiteral.LiteralPart ? Head :
        Head extends Codec<infer T, unknown, unknown, unknown> ? T
        : never,
      ...Type<Tail>
    ]
    : []
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface TemplateLiteralParser<Parts extends TemplateLiteral.Parts> extends
  Bottom<
    TemplateLiteralParser.Type<Parts>,
    TemplateLiteral.Encoded<Parts>,
    never,
    never,
    SchemaAST.TupleType,
    TemplateLiteralParser<Parts>,
    SchemaAnnotations.Annotations
  >
{
  readonly parts: Parts
}

class TemplateLiteralParser$<Parts extends TemplateLiteral.Parts> extends make$<TemplateLiteralParser<Parts>>
  implements TemplateLiteralParser<Parts>
{
  constructor(ast: SchemaAST.TupleType, readonly parts: Parts) {
    super(ast, (ast) => new TemplateLiteralParser$(ast, parts))
  }
}

/**
 * @since 4.0.0
 */
export function TemplateLiteralParser<const Parts extends TemplateLiteral.Parts>(
  parts: Parts
): TemplateLiteralParser<Parts> {
  return new TemplateLiteralParser$(
    templateLiteralFromParts(parts).asTemplateLiteralParser(),
    [...parts] as Parts
  )
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Enums<A extends { [x: string]: string | number }>
  extends Bottom<A[keyof A], A[keyof A], never, never, SchemaAST.Enums, Enums<A>, SchemaAnnotations.Annotations>
{
  readonly enums: A
}

class Enums$<A extends { [x: string]: string | number }> extends make$<Enums<A>> implements Enums<A> {
  constructor(ast: SchemaAST.Enums, readonly enums: A) {
    super(ast, (ast) => new Enums$(ast, enums))
  }
}

/**
 * @since 4.0.0
 */
export function Enums<A extends { [x: string]: string | number }>(enums: A): Enums<A> {
  return new Enums$(
    new SchemaAST.Enums(
      Object.keys(enums).filter(
        (key) => typeof enums[enums[key]] !== "number"
      ).map((key) => [key, enums[key]]),
      undefined,
      undefined,
      undefined,
      undefined
    ),
    enums
  )
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Never
  extends Bottom<never, never, never, never, SchemaAST.NeverKeyword, Never, SchemaAnnotations.Bottom<never>>
{}

/**
 * @since 4.0.0
 */
export const Never: Never = make<Never>(SchemaAST.neverKeyword)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Any extends Bottom<any, any, never, never, SchemaAST.AnyKeyword, Any, SchemaAnnotations.Bottom<any>> {}

/**
 * @since 4.0.0
 */
export const Any: Any = make<Any>(SchemaAST.anyKeyword)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Unknown
  extends Bottom<unknown, unknown, never, never, SchemaAST.UnknownKeyword, Unknown, SchemaAnnotations.Bottom<unknown>>
{}

/**
 * @since 4.0.0
 */
export const Unknown: Unknown = make<Unknown>(SchemaAST.unknownKeyword)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Null
  extends Bottom<null, null, never, never, SchemaAST.NullKeyword, Null, SchemaAnnotations.Bottom<null>>
{}

/**
 * @since 4.0.0
 */
export const Null: Null = make<Null>(SchemaAST.nullKeyword)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Undefined extends
  Bottom<
    undefined,
    undefined,
    never,
    never,
    SchemaAST.UndefinedKeyword,
    Undefined,
    SchemaAnnotations.Bottom<undefined>
  >
{}

/**
 * @since 4.0.0
 */
export const Undefined: Undefined = make<Undefined>(SchemaAST.undefinedKeyword)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface String
  extends Bottom<string, string, never, never, SchemaAST.StringKeyword, String, SchemaAnnotations.Bottom<string>>
{}

/**
 * @since 4.0.0
 */
export const String: String = make<String>(SchemaAST.stringKeyword)

/**
 * All numbers, including `NaN`, `Infinity`, and `-Infinity`.
 *
 * @category Api interface
 * @since 4.0.0
 */
export interface Number
  extends Bottom<number, number, never, never, SchemaAST.NumberKeyword, Number, SchemaAnnotations.Bottom<number>>
{}

/**
 * @since 4.0.0
 */
export const Number: Number = make<Number>(SchemaAST.numberKeyword)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Boolean
  extends Bottom<boolean, boolean, never, never, SchemaAST.BooleanKeyword, Boolean, SchemaAnnotations.Bottom<boolean>>
{}

/**
 * @since 4.0.0
 */
export const Boolean: Boolean = make<Boolean>(SchemaAST.booleanKeyword)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Symbol
  extends Bottom<symbol, symbol, never, never, SchemaAST.SymbolKeyword, Symbol, SchemaAnnotations.Bottom<symbol>>
{}

/**
 * @since 4.0.0
 */
export const Symbol: Symbol = make<Symbol>(SchemaAST.symbolKeyword)

/**
 * @since 4.0.0
 */
export interface BigInt
  extends Bottom<bigint, bigint, never, never, SchemaAST.BigIntKeyword, BigInt, SchemaAnnotations.Bottom<bigint>>
{}

/**
 * @since 4.0.0
 */
export const BigInt: BigInt = make<BigInt>(SchemaAST.bigIntKeyword)

/**
 * @since 4.0.0
 */
export interface Void
  extends Bottom<void, void, never, never, SchemaAST.VoidKeyword, Void, SchemaAnnotations.Bottom<void>>
{}

/**
 * @since 4.0.0
 */
export const Void: Void = make<Void>(SchemaAST.voidKeyword)

/**
 * @since 4.0.0
 */
export interface Object$
  extends Bottom<object, object, never, never, SchemaAST.ObjectKeyword, Object$, SchemaAnnotations.Bottom<object>>
{}

const Object_: Object$ = make<Object$>(SchemaAST.objectKeyword)

export {
  /**
   * @since 4.0.0
   */

  Object_ as Object
}

/**
 * @since 4.0.0
 */
export interface UniqueSymbol<sym extends symbol>
  extends Bottom<sym, sym, never, never, SchemaAST.UniqueSymbol, UniqueSymbol<sym>, SchemaAnnotations.Bottom<sym>>
{}

/**
 * @since 4.0.0
 */
export function UniqueSymbol<const sym extends symbol>(symbol: sym): UniqueSymbol<sym> {
  return make<UniqueSymbol<sym>>(new SchemaAST.UniqueSymbol(symbol, undefined, undefined, undefined, undefined))
}

/**
 * @since 4.0.0
 */
export declare namespace Struct {
  /**
   * @since 4.0.0
   */
  export type Field = Top

  /**
   * @since 4.0.0
   */
  export type Fields = { readonly [x: PropertyKey]: Field }

  type TypeOptionalKeys<Fields extends Struct.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~type.isOptional": "optional" } ? K
      : never
  }[keyof Fields]

  type TypeMutableKeys<Fields extends Struct.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~type.isReadonly": "mutable" } ? K
      : never
  }[keyof Fields]

  type Type_<
    F extends Fields,
    O extends keyof F = TypeOptionalKeys<F>,
    M extends keyof F = TypeMutableKeys<F>
  > =
    & { readonly [K in Exclude<keyof F, M | O>]: F[K]["Type"] }
    & { readonly [K in Exclude<O, M>]?: F[K]["Type"] }
    & { [K in Exclude<M, O>]: F[K]["Type"] }
    & { [K in M & O]?: F[K]["Type"] }

  /**
   * @since 4.0.0
   */
  export type Type<F extends Fields> = Type_<F>

  type EncodedOptionalKeys<Fields extends Struct.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~encoded.isOptional": "optional" } ? K
      : never
  }[keyof Fields]

  type EncodedMutableKeys<Fields extends Struct.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~encoded.isReadonly": "mutable" } ? K
      : never
  }[keyof Fields]

  type Encoded_<
    F extends Fields,
    O extends keyof F = EncodedOptionalKeys<F>,
    M extends keyof F = EncodedMutableKeys<F>
  > =
    & { readonly [K in Exclude<keyof F, M | O>]: F[K]["Encoded"] }
    & { readonly [K in Exclude<O, M>]?: F[K]["Encoded"] }
    & { [K in Exclude<M, O>]: F[K]["Encoded"] }
    & { [K in M & O]?: F[K]["Encoded"] }

  /**
   * @since 4.0.0
   */
  export type Encoded<F extends Fields> = Encoded_<F>

  /**
   * @since 4.0.0
   */
  export type DecodingContext<F extends Fields> = { readonly [K in keyof F]: F[K]["DecodingContext"] }[keyof F]

  /**
   * @since 4.0.0
   */
  export type EncodingContext<F extends Fields> = { readonly [K in keyof F]: F[K]["EncodingContext"] }[keyof F]

  type TypeDefaultedKeys<Fields extends Struct.Fields> = {
    [K in keyof Fields]: Fields[K] extends { readonly "~type.default": "has-constructor-default" } ? K
      : never
  }[keyof Fields]

  type MakeIn_<
    F extends Fields,
    O = TypeOptionalKeys<F> | TypeDefaultedKeys<F>
  > =
    & { readonly [K in keyof F as K extends O ? never : K]: F[K]["~type.make"] }
    & { readonly [K in keyof F as K extends O ? K : never]?: F[K]["~type.make"] }

  /**
   * @since 4.0.0
   */
  export type MakeIn<F extends Fields> = MakeIn_<F>
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Struct<Fields extends Struct.Fields> extends
  Bottom<
    Simplify<Struct.Type<Fields>>,
    Simplify<Struct.Encoded<Fields>>,
    Struct.DecodingContext<Fields>,
    Struct.EncodingContext<Fields>,
    SchemaAST.TypeLiteral,
    Struct<Fields>,
    SchemaAnnotations.Bottom<Simplify<Struct.Type<Fields>>>,
    Simplify<Struct.MakeIn<Fields>>
  >
{
  readonly fields: Fields
}

/**
 * @since 4.0.0
 */
export function extend<const NewFields extends Struct.Fields>(newFields: NewFields) {
  return <S extends Top & { readonly fields: Struct.Fields }>(
    schema: S
  ): Struct<Simplify<Merge<S["fields"], NewFields>>> => {
    const fields = { ...schema.fields, ...newFields }
    let ast = getTypeLiteralFromFields(fields)
    if (schema.ast.checks) {
      ast = SchemaAST.replaceChecks(ast, schema.ast.checks)
    }
    return new Struct$<Simplify<Merge<S["fields"], NewFields>>>(ast, fields)
  }
}

/**
 * @since 4.0.0
 */
export function pick<const Fields extends Struct.Fields, const Keys extends keyof Fields>(
  keys: ReadonlyArray<Keys>
) {
  return (schema: Struct<Fields>): Struct<Simplify<Pick<Fields, Keys>>> => {
    return Struct(Struct_.pick(schema.fields, ...keys))
  }
}

/**
 * @since 4.0.0
 */
export function omit<const Fields extends Struct.Fields, const Keys extends keyof Fields>(
  keys: ReadonlyArray<Keys>
) {
  return (schema: Struct<Fields>): Struct<Simplify<Omit<Fields, Keys>>> => {
    return Struct(Struct_.omit(schema.fields, ...keys))
  }
}

function getTypeLiteralFromFields<Fields extends Struct.Fields>(fields: Fields): SchemaAST.TypeLiteral {
  return new SchemaAST.TypeLiteral(
    ownKeys(fields).map((key) => {
      return new SchemaAST.PropertySignature(key, fields[key].ast)
    }),
    [],
    undefined,
    undefined,
    undefined,
    undefined
  )
}

class Struct$<Fields extends Struct.Fields> extends make$<Struct<Fields>> implements Struct<Fields> {
  readonly fields: Fields
  constructor(ast: SchemaAST.TypeLiteral, fields: Fields) {
    super(ast, (ast) => new Struct$(ast, fields))
    this.fields = { ...fields }
  }
}

/**
 * @since 4.0.0
 */
export function Struct<const Fields extends Struct.Fields>(fields: Fields): Struct<Fields> {
  return new Struct$(getTypeLiteralFromFields(fields), fields)
}

/**
 * @since 4.0.0
 */
export declare namespace Record {
  /**
   * @since 4.0.0
   */
  export interface Key extends Codec<PropertyKey, PropertyKey, unknown, unknown> {
    readonly "~type.make": PropertyKey
  }

  /**
   * @since 4.0.0
   */
  export type Record = Record$<Record.Key, Top>

  type MergeTuple<T extends ReadonlyArray<unknown>> = T extends readonly [infer Head, ...infer Tail] ?
    Head & MergeTuple<Tail>
    : {}

  /**
   * @since 4.0.0
   */
  export type Type<Key extends Record.Key, Value extends Top> = { readonly [P in Key["Type"]]: Value["Type"] }

  /**
   * @since 4.0.0
   */
  export type Encoded<Key extends Record.Key, Value extends Top> = { readonly [P in Key["Encoded"]]: Value["Encoded"] }

  /**
   * @since 4.0.0
   */
  export type DecodingContext<Key extends Record.Key, Value extends Top> =
    | Key["DecodingContext"]
    | Value["DecodingContext"]

  /**
   * @since 4.0.0
   */
  export type EncodingContext<Key extends Record.Key, Value extends Top> =
    | Key["EncodingContext"]
    | Value["EncodingContext"]

  /**
   * @since 4.0.0
   */
  export type MakeIn<Key extends Record.Key, Value extends Top> = {
    readonly [P in Key["~type.make"]]: Value["~type.make"]
  }
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Record$<Key extends Record.Key, Value extends Top> extends
  Bottom<
    Simplify<Record.Type<Key, Value>>,
    Simplify<Record.Encoded<Key, Value>>,
    Record.DecodingContext<Key, Value>,
    Record.EncodingContext<Key, Value>,
    SchemaAST.TypeLiteral,
    Record$<Key, Value>,
    SchemaAnnotations.Bottom<Record.Type<Key, Value>>,
    Simplify<Record.MakeIn<Key, Value>>
  >
{
  readonly key: Key
  readonly value: Value
}

class Record$$<Key extends Record.Key, Value extends Top> extends make$<Record$<Key, Value>>
  implements Record$<Key, Value>
{
  constructor(ast: SchemaAST.TypeLiteral, readonly key: Key, readonly value: Value) {
    super(ast, (ast) => new Record$$(ast, key, value))
  }
}

/**
 * @since 4.0.0
 */
export function Record<Key extends Record.Key, Value extends Top>(
  key: Key,
  value: Value,
  options?: {
    readonly key: {
      readonly decode?: {
        readonly combine?: SchemaAST.Combine<Key["Type"], Value["Type"]> | undefined
      }
      readonly encode?: {
        readonly combine?: SchemaAST.Combine<Key["Encoded"], Value["Encoded"]> | undefined
      }
    }
  }
): Record$<Key, Value> {
  const merge = options?.key?.decode?.combine || options?.key?.encode?.combine
    ? new SchemaAST.Merge(
      options.key.decode?.combine,
      options.key.encode?.combine
    )
    : undefined
  const ast = new SchemaAST.TypeLiteral(
    [],
    [new SchemaAST.IndexSignature(true, key.ast, value.ast, merge)],
    undefined,
    undefined,
    undefined,
    undefined
  )
  return new Record$$(ast, key, value)
}

/**
 * @since 4.0.0
 */
export declare namespace StructWithRest {
  /**
   * @since 4.0.0
   */
  export type TypeLiteral = Top & { readonly ast: SchemaAST.TypeLiteral }

  /**
   * @since 4.0.0
   */
  export type Records = ReadonlyArray<Record.Record | mutable<Record.Record>>

  type MergeTuple<T extends ReadonlyArray<unknown>> = T extends readonly [infer Head, ...infer Tail] ?
    Head & MergeTuple<Tail>
    : {}

  /**
   * @since 4.0.0
   */
  export type Type<S extends TypeLiteral, Records extends StructWithRest.Records> =
    & S["Type"]
    & MergeTuple<{ readonly [K in keyof Records]: Records[K]["Type"] }>
  /**
   * @since 4.0.0
   */
  export type Encoded<S extends TypeLiteral, Records extends StructWithRest.Records> =
    & S["Encoded"]
    & MergeTuple<{ readonly [K in keyof Records]: Records[K]["Encoded"] }>

  /**
   * @since 4.0.0
   */
  export type DecodingContext<S extends TypeLiteral, Records extends StructWithRest.Records> =
    | S["DecodingContext"]
    | { [K in keyof Records]: Records[K]["DecodingContext"] }[number]

  /**
   * @since 4.0.0
   */
  export type EncodingContext<S extends TypeLiteral, Records extends StructWithRest.Records> =
    | S["EncodingContext"]
    | { [K in keyof Records]: Records[K]["EncodingContext"] }[number]

  /**
   * @since 4.0.0
   */
  export type MakeIn<S extends TypeLiteral, Records extends StructWithRest.Records> =
    & S["~type.make"]
    & MergeTuple<{ readonly [K in keyof Records]: Records[K]["~type.make"] }>
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface StructWithRest<
  S extends StructWithRest.TypeLiteral,
  Records extends StructWithRest.Records
> extends
  Bottom<
    Simplify<StructWithRest.Type<S, Records>>,
    Simplify<StructWithRest.Encoded<S, Records>>,
    StructWithRest.DecodingContext<S, Records>,
    StructWithRest.EncodingContext<S, Records>,
    SchemaAST.TypeLiteral,
    StructWithRest<S, Records>,
    SchemaAnnotations.Bottom<Simplify<StructWithRest.Type<S, Records>>>,
    Simplify<StructWithRest.MakeIn<S, Records>>
  >
{
  readonly schema: S
  readonly rest: Records
}

class StructWithRest$$<S extends StructWithRest.TypeLiteral, Records extends StructWithRest.Records>
  extends make$<StructWithRest<S, Records>>
  implements StructWithRest<S, Records>
{
  readonly rest: Records
  constructor(ast: SchemaAST.TypeLiteral, readonly schema: S, records: Records) {
    super(ast, (ast) => new StructWithRest$$(ast, this.schema, this.rest))
    this.rest = [...records] as any
  }
}

/**
 * @since 4.0.0
 */
export function StructWithRest<
  const S extends StructWithRest.TypeLiteral,
  const Records extends StructWithRest.Records
>(
  schema: S,
  rest: Records
): StructWithRest<S, Records> {
  return new StructWithRest$$(SchemaAST.structAndRest(schema.ast, rest.map((r) => r.ast)), schema, rest)
}

/**
 * @since 4.0.0
 */
export declare namespace Tuple {
  /**
   * @since 4.0.0
   */
  export type Element = Top

  /**
   * @since 4.0.0
   */
  export type Elements = ReadonlyArray<Element>

  type Type_<
    Elements,
    Out extends ReadonlyArray<any> = readonly []
  > = Elements extends readonly [infer Head, ...infer Tail] ?
    Head extends { readonly "Type": infer T } ?
      Head extends { readonly "~type.isOptional": "optional" } ? Type_<Tail, readonly [...Out, T?]>
      : Type_<Tail, readonly [...Out, T]>
    : Out
    : Out

  /**
   * @since 4.0.0
   */
  export type Type<E extends Elements> = Type_<E>

  type Encoded_<
    Elements,
    Out extends ReadonlyArray<any> = readonly []
  > = Elements extends readonly [infer Head, ...infer Tail] ?
    Head extends { readonly "Encoded": infer T } ?
      Head extends { readonly "~encoded.isOptional": "optional" } ? Encoded_<Tail, readonly [...Out, T?]>
      : Encoded_<Tail, readonly [...Out, T]>
    : Out
    : Out

  /**
   * @since 4.0.0
   */
  export type Encoded<E extends Elements> = Encoded_<E>

  /**
   * @since 4.0.0
   */
  export type DecodingContext<E extends Elements> = E[number]["DecodingContext"]

  /**
   * @since 4.0.0
   */
  export type EncodingContext<E extends Elements> = E[number]["EncodingContext"]

  type MakeIn_<
    E,
    Out extends ReadonlyArray<any> = readonly []
  > = E extends readonly [infer Head, ...infer Tail] ?
    Head extends { "~type.make": infer T } ?
      Head extends
        { readonly "~type.isOptional": "optional" } | { readonly "~type.default": "has-constructor-default" } ?
        MakeIn_<Tail, readonly [...Out, T?]> :
      MakeIn_<Tail, readonly [...Out, T]>
    : Out :
    Out

  /**
   * @since 4.0.0
   */
  export type MakeIn<E extends Elements> = MakeIn_<E>
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Tuple<Elements extends Tuple.Elements> extends
  Bottom<
    Tuple.Type<Elements>,
    Tuple.Encoded<Elements>,
    Tuple.DecodingContext<Elements>,
    Tuple.EncodingContext<Elements>,
    SchemaAST.TupleType,
    Tuple<Elements>,
    SchemaAnnotations.Bottom<Tuple.Type<Elements>>,
    Tuple.MakeIn<Elements>
  >
{
  readonly elements: Elements
}

class Tuple$<Elements extends Tuple.Elements> extends make$<Tuple<Elements>> implements Tuple<Elements> {
  readonly elements: Elements
  constructor(ast: SchemaAST.TupleType, elements: Elements) {
    super(ast, (ast) => new Tuple$(ast, elements))
    this.elements = [...elements] as any
  }
}

/**
 * @since 4.0.0
 */
export function Tuple<const Elements extends ReadonlyArray<Top>>(elements: Elements): Tuple<Elements> {
  return new Tuple$(
    new SchemaAST.TupleType(
      true,
      elements.map((element) => element.ast),
      [],
      undefined,
      undefined,
      undefined,
      undefined
    ),
    elements
  )
}

/**
 * @since 4.0.0
 */
export declare namespace TupleWithRest {
  /**
   * @since 4.0.0
   */
  export type TupleType = Top & {
    readonly Type: ReadonlyArray<unknown>
    readonly Encoded: ReadonlyArray<unknown>
    readonly ast: SchemaAST.TupleType
    readonly "~type.make": ReadonlyArray<unknown>
  }

  /**
   * @since 4.0.0
   */
  export type Rest = readonly [Top, ...ReadonlyArray<Top>]

  /**
   * @since 4.0.0
   */
  export type Type<T extends ReadonlyArray<unknown>, Rest extends TupleWithRest.Rest> = Rest extends
    readonly [infer Head extends Top, ...infer Tail extends ReadonlyArray<Top>] ? Readonly<[
      ...T,
      ...ReadonlyArray<Head["Type"]>,
      ...{ readonly [K in keyof Tail]: Tail[K]["Type"] }
    ]> :
    T

  /**
   * @since 4.0.0
   */
  export type Encoded<E extends ReadonlyArray<unknown>, Rest extends TupleWithRest.Rest> = Rest extends
    readonly [infer Head extends Top, ...infer Tail extends ReadonlyArray<Top>] ? readonly [
      ...E,
      ...Array<Head["Encoded"]>,
      ...{ readonly [K in keyof Tail]: Tail[K]["Encoded"] }
    ] :
    E

  /**
   * @since 4.0.0
   */
  export type MakeIn<M extends ReadonlyArray<unknown>, Rest extends TupleWithRest.Rest> = Rest extends
    readonly [infer Head extends Top, ...infer Tail extends ReadonlyArray<Top>] ? readonly [
      ...M,
      ...Array<Head["~type.make"]>,
      ...{ readonly [K in keyof Tail]: Tail[K]["~type.make"] }
    ] :
    M
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface TupleWithRest<
  S extends TupleWithRest.TupleType,
  Rest extends TupleWithRest.Rest
> extends
  Bottom<
    TupleWithRest.Type<S["Type"], Rest>,
    TupleWithRest.Encoded<S["Encoded"], Rest>,
    S["DecodingContext"] | Rest[number]["DecodingContext"],
    S["EncodingContext"] | Rest[number]["EncodingContext"],
    SchemaAST.TupleType,
    TupleWithRest<S, Rest>,
    SchemaAnnotations.Bottom<TupleWithRest.Type<S["Type"], Rest>>,
    TupleWithRest.MakeIn<S["~type.make"], Rest>
  >
{
  readonly schema: S
  readonly rest: Rest
}

class TupleWithRest$<S extends Tuple<Tuple.Elements> | mutable<Tuple<Tuple.Elements>>, Rest extends TupleWithRest.Rest>
  extends make$<TupleWithRest<S, Rest>>
{
  constructor(ast: SchemaAST.TupleType, readonly schema: S, readonly rest: Rest) {
    super(ast, (ast) => new TupleWithRest$(ast, this.schema, this.rest))
  }
}

/**
 * @since 4.0.0
 */
export function TupleWithRest<
  S extends Tuple<Tuple.Elements> | mutable<Tuple<Tuple.Elements>>,
  const Rest extends TupleWithRest.Rest
>(
  schema: S,
  rest: Rest
): TupleWithRest<S, Rest> {
  return new TupleWithRest$(SchemaAST.tupleWithRest(schema.ast, rest.map((r) => r.ast)), schema, rest)
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Array$<S extends Top> extends
  Bottom<
    ReadonlyArray<S["Type"]>,
    ReadonlyArray<S["Encoded"]>,
    S["DecodingContext"],
    S["EncodingContext"],
    SchemaAST.TupleType,
    Array$<S>,
    SchemaAnnotations.Bottom<ReadonlyArray<S["Type"]>>,
    ReadonlyArray<S["~type.make"]>
  >
{
  readonly schema: S
}

/**
 * @since 4.0.0
 */
export function Array<S extends Top>(item: S): Array$<S> {
  return new makeWithSchema$<S, Array$<S>>(
    new SchemaAST.TupleType(true, [], [item.ast], undefined, undefined, undefined, undefined),
    item
  )
}

/**
 * @since 4.0.0
 */
export interface mutable<S extends Top> extends
  Bottom<
    Mutable<S["Type"]>,
    Mutable<S["Encoded"]>,
    S["DecodingContext"],
    S["EncodingContext"],
    S["ast"],
    mutable<S>,
    // we keep "~annotate.in", "~type.make" and "~type.make.in" as they are because they are contravariant
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.isReadonly"],
    S["~type.isOptional"],
    S["~type.default"],
    S["~encoded.isReadonly"],
    S["~encoded.isOptional"]
  >
{
  readonly schema: S
}

/**
 * @since 4.0.0
 */
export function mutable<S extends Top>(self: S): mutable<S> {
  return new makeWithSchema$<S, mutable<S>>(SchemaAST.mutable(self.ast), self)
}

/**
 * @since 4.0.0
 */
export interface readonly$<S extends Top> extends
  Bottom<
    Readonly<S["Type"]>,
    Readonly<S["Encoded"]>,
    S["DecodingContext"],
    S["EncodingContext"],
    S["ast"],
    readonly$<S>,
    // we keep "~annotate.in", "~type.make" and "~type.make.in" as they are because they are contravariant
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.isReadonly"],
    S["~type.isOptional"],
    S["~type.default"],
    S["~encoded.isReadonly"],
    S["~encoded.isOptional"]
  >
{
  readonly schema: S
}

/**
 * @since 4.0.0
 */
export function readonly<S extends Top>(self: S): readonly$<S> {
  return new makeWithSchema$<S, readonly$<S>>(SchemaAST.mutable(self.ast), self)
}

/**
 * @since 4.0.0
 */
export interface Union<Members extends ReadonlyArray<Top>> extends
  Bottom<
    Members[number]["Type"],
    Members[number]["Encoded"],
    Members[number]["DecodingContext"],
    Members[number]["EncodingContext"],
    SchemaAST.UnionType<Members[number]["ast"]>,
    Union<Members>,
    SchemaAnnotations.Bottom<Members[number]["Type"]>,
    Members[number]["~type.make"]
  >
{
  readonly members: Members
}

class Union$<Members extends ReadonlyArray<Top>> extends make$<Union<Members>> implements Union<Members> {
  constructor(readonly ast: SchemaAST.UnionType, readonly members: Members) {
    super(ast, (ast) => new Union$(ast, members))
  }
}

/**
 * Members are checked in order, and the first match is returned.
 *
 * Optionally, you can specify the `mode` to be `"anyOf"` or `"oneOf"`.
 *
 * - `"anyOf"` - The union matches if any member matches.
 * - `"oneOf"` - The union matches if exactly one member matches.
 *
 * @since 4.0.0
 */
export function Union<const Members extends ReadonlyArray<Top>>(
  members: Members,
  options?: { mode?: "anyOf" | "oneOf" }
): Union<Members> {
  const ast = new SchemaAST.UnionType(
    members.map((type) => type.ast),
    options?.mode ?? "anyOf",
    undefined,
    undefined,
    undefined,
    undefined
  )
  return new Union$(ast, members)
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Literals<L extends ReadonlyArray<SchemaAST.LiteralValue>> extends
  Bottom<
    L[number],
    L[number],
    never,
    never,
    SchemaAST.UnionType<SchemaAST.LiteralType>,
    Literals<L>,
    SchemaAnnotations.Bottom<L[number]>
  >
{
  readonly literals: L
}

class Literals$<L extends ReadonlyArray<SchemaAST.LiteralValue>> extends make$<Literals<L>> implements Literals<L> {
  constructor(ast: SchemaAST.UnionType<SchemaAST.LiteralType>, readonly literals: L) {
    super(ast, (ast) => new Literals$(ast, literals))
  }
}

/**
 * @since 4.0.0
 */
export function Literals<const L extends ReadonlyArray<SchemaAST.LiteralValue>>(literals: L): Literals<L> {
  return new Literals$(
    new SchemaAST.UnionType(
      literals.map((literal) => Literal(literal).ast),
      "anyOf",
      undefined,
      undefined,
      undefined,
      undefined
    ),
    [...literals] as L
  )
}

/**
 * @since 4.0.0
 */
export function NullOr<S extends Top>(self: S) {
  return Union([self, Null])
}

/**
 * @since 4.0.0
 */
export function UndefinedOr<S extends Top>(self: S) {
  return Union([self, Undefined])
}

/**
 * @since 4.0.0
 */
export function NullishOr<S extends Top>(self: S) {
  return Union([self, Null, Undefined])
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface suspend<S extends Top> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
    SchemaAST.Suspend,
    suspend<S>,
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.isReadonly"],
    S["~type.isOptional"],
    S["~type.default"],
    S["~encoded.isReadonly"],
    S["~encoded.isOptional"]
  >
{}

/**
 * @category constructors
 * @since 4.0.0
 */
export function suspend<S extends Top>(f: () => S): suspend<S> {
  return make<suspend<S>>(new SchemaAST.Suspend(() => f().ast, undefined, undefined, undefined, undefined))
}

/**
 * @category Filtering
 * @since 4.0.0
 */
export function check<S extends Top>(
  ...checks: readonly [
    SchemaCheck.SchemaCheck<S["Type"]>,
    ...ReadonlyArray<SchemaCheck.SchemaCheck<S["Type"]>>
  ]
): (self: S) => S["~rebuild.out"] {
  return asCheck(...checks)
}

/**
 * @since 4.0.0
 */
export function asCheck<T>(
  ...checks: readonly [SchemaCheck.SchemaCheck<T>, ...ReadonlyArray<SchemaCheck.SchemaCheck<T>>]
) {
  return <S extends Schema<T>>(self: S): S["~rebuild.out"] => {
    return self.check(...checks)
  }
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface refine<T extends S["Type"], S extends Top> extends
  Bottom<
    T,
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
    S["ast"],
    refine<T, S["~rebuild.out"]>,
    S["~annotate.in"],
    S["~type.make.in"],
    T,
    S["~type.isReadonly"],
    S["~type.isOptional"],
    S["~type.default"],
    S["~encoded.isReadonly"],
    S["~encoded.isOptional"]
  >
{}

/**
 * @category Filtering
 * @since 4.0.0
 */
export function refine<T extends E, E>(
  refinement: SchemaCheck.SchemaRefinement<T, E>
) {
  return <S extends Schema<E>>(self: S): refine<S["Type"] & T, S["~rebuild.out"]> => {
    const ast = SchemaAST.appendChecks(self.ast, [refinement])
    return self.rebuild(ast) as any
  }
}

/**
 * @category Filtering
 * @since 4.0.0
 */
export function guard<T extends S["Type"], S extends Top>(
  is: (value: S["Type"]) => value is T,
  annotations?: SchemaAnnotations.Filter
) {
  return (self: S): refine<T, S["~rebuild.out"]> => {
    return self.pipe(refine(SchemaCheck.guarded(is, annotations)))
  }
}

/**
 * @category Filtering
 * @since 4.0.0
 */
export function brand<B extends string | symbol>(brand: B, annotations?: SchemaAnnotations.Filter) {
  return <S extends Top>(self: S): refine<S["Type"] & Brand<B>, S["~rebuild.out"]> => {
    return self.pipe(refine(SchemaCheck.branded(brand, annotations)))
  }
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface decodingMiddleware<S extends Top, RD> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    RD,
    S["EncodingContext"],
    S["ast"],
    decodingMiddleware<S, RD>,
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.isReadonly"],
    S["~type.isOptional"],
    S["~type.default"],
    S["~encoded.isReadonly"],
    S["~encoded.isOptional"]
  >
{
  readonly schema: S
}

/**
 * @since 4.0.0
 */
export function decodingMiddleware<S extends Top, RD>(
  decode: (
    sr: SchemaResult.SchemaResult<O.Option<S["Type"]>, S["DecodingContext"]>,
    ast: S["ast"],
    options: SchemaAST.ParseOptions
  ) => SchemaResult.SchemaResult<O.Option<S["Type"]>, RD>
) {
  return (self: S): decodingMiddleware<S, RD> => {
    return new makeWithSchema$<S, decodingMiddleware<S, RD>>(
      SchemaAST.decodingMiddleware(self.ast, new SchemaTransformation.SchemaMiddleware(decode, identity)),
      self
    )
  }
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface encodingMiddleware<S extends Top, RE> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingContext"],
    RE,
    S["ast"],
    encodingMiddleware<S, RE>,
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.isReadonly"],
    S["~type.isOptional"],
    S["~type.default"],
    S["~encoded.isReadonly"],
    S["~encoded.isOptional"]
  >
{
  readonly schema: S
}

/**
 * @since 4.0.0
 */
export function encodingMiddleware<S extends Top, RE>(
  encode: (
    sr: SchemaResult.SchemaResult<O.Option<S["Type"]>, S["EncodingContext"]>,
    ast: S["ast"],
    options: SchemaAST.ParseOptions
  ) => SchemaResult.SchemaResult<O.Option<S["Type"]>, RE>
) {
  return (self: S): encodingMiddleware<S, RE> => {
    return new makeWithSchema$<S, encodingMiddleware<S, RE>>(
      SchemaAST.encodingMiddleware(self.ast, new SchemaTransformation.SchemaMiddleware(identity, encode)),
      self
    )
  }
}

/**
 * @category Middlewares
 * @since 4.0.0
 */
export function catchDecoding<S extends Top>(
  f: (issue: SchemaIssue.Issue) => SchemaResult.SchemaResult<O.Option<S["Type"]>>
): (self: S) => S["~rebuild.out"] {
  return catchDecodingWithContext(f)
}

/**
 * @category Middlewares
 * @since 4.0.0
 */
export function catchDecodingWithContext<S extends Top, R = never>(
  f: (issue: SchemaIssue.Issue) => SchemaResult.SchemaResult<O.Option<S["Type"]>, R>
) {
  return (self: S): decodingMiddleware<S, S["DecodingContext"] | R> => {
    return self.pipe(decodingMiddleware(SchemaResult.catch(f)))
  }
}

/**
 * @category Middlewares
 * @since 4.0.0
 */
export function catchEncoding<S extends Top>(
  f: (issue: SchemaIssue.Issue) => SchemaResult.SchemaResult<O.Option<S["Encoded"]>>
): (self: S) => S["~rebuild.out"] {
  return catchEncodingWithContext(f)
}

/**
 * @category Middlewares
 * @since 4.0.0
 */
export function catchEncodingWithContext<S extends Top, R = never>(
  f: (issue: SchemaIssue.Issue) => SchemaResult.SchemaResult<O.Option<S["Encoded"]>, R>
) {
  return (self: S): encodingMiddleware<S, S["EncodingContext"] | R> => {
    return self.pipe(encodingMiddleware(SchemaResult.catch(f)))
  }
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface decodeTo<To extends Top, From extends Top, RD, RE> extends
  Bottom<
    To["Type"],
    From["Encoded"],
    To["DecodingContext"] | From["DecodingContext"] | RD,
    To["EncodingContext"] | From["EncodingContext"] | RE,
    To["ast"],
    decodeTo<To, From, RD, RE>,
    To["~annotate.in"],
    To["~type.make.in"],
    To["~type.make"],
    To["~type.isReadonly"],
    To["~type.isOptional"],
    To["~type.default"],
    From["~encoded.isReadonly"],
    From["~encoded.isOptional"]
  >
{
  readonly from: From
  readonly to: To
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface compose<To extends Top, From extends Top> extends decodeTo<To, From, never, never> {}

class decodeTo$<To extends Top, From extends Top, RD, RE> extends make$<decodeTo<To, From, RD, RE>>
  implements decodeTo<To, From, RD, RE>
{
  constructor(
    readonly ast: From["ast"],
    readonly from: From,
    readonly to: To
  ) {
    super(ast, (ast) => new decodeTo$<To, From, RD, RE>(ast, this.from, this.to))
  }
}

/**
 * @since 4.0.0
 */
export function decodeTo<To extends Top>(to: To): <From extends Top>(from: From) => compose<To, From>
export function decodeTo<To extends Top, From extends Top, RD = never, RE = never>(
  to: To,
  transformation: {
    readonly decode: SchemaGetter.SchemaGetter<NoInfer<To["Encoded"]>, NoInfer<From["Type"]>, RD>
    readonly encode: SchemaGetter.SchemaGetter<NoInfer<From["Type"]>, NoInfer<To["Encoded"]>, RE>
  }
): (from: From) => decodeTo<To, From, RD, RE>
export function decodeTo<To extends Top, From extends Top, RD = never, RE = never>(
  to: To,
  transformation?: {
    readonly decode: SchemaGetter.SchemaGetter<To["Encoded"], From["Type"], RD>
    readonly encode: SchemaGetter.SchemaGetter<From["Type"], To["Encoded"], RE>
  } | undefined
) {
  return (from: From) => {
    return new decodeTo$(
      SchemaAST.decodeTo(
        from.ast,
        to.ast,
        transformation ? SchemaTransformation.make(transformation) : SchemaTransformation.passthrough()
      ),
      from,
      to
    )
  }
}

/**
 * Like {@link decodeTo}, but the transformation is applied to the type codec
 * (`typeCodec(self)`).
 *
 * @since 4.0.0
 */
export function decode<S extends Top, RD = never, RE = never>(transformation: {
  readonly decode: SchemaGetter.SchemaGetter<S["Type"], S["Type"], RD>
  readonly encode: SchemaGetter.SchemaGetter<S["Type"], S["Type"], RE>
}) {
  return (self: S): decodeTo<typeCodec<S>, S, RD, RE> => {
    return self.pipe(decodeTo(typeCodec(self), SchemaTransformation.make(transformation)))
  }
}

/**
 * @since 4.0.0
 */
export function encodeTo<To extends Top>(
  to: To
): <From extends Top>(from: From) => decodeTo<From, To, never, never>
export function encodeTo<To extends Top, From extends Top, RD = never, RE = never>(
  to: To,
  transformation: {
    readonly decode: SchemaGetter.SchemaGetter<NoInfer<From["Encoded"]>, NoInfer<To["Type"]>, RD>
    readonly encode: SchemaGetter.SchemaGetter<NoInfer<To["Type"]>, NoInfer<From["Encoded"]>, RE>
  }
): (from: From) => decodeTo<From, To, RD, RE>
export function encodeTo<To extends Top, From extends Top, RD = never, RE = never>(
  to: To,
  transformation?: {
    readonly decode: SchemaGetter.SchemaGetter<From["Encoded"], To["Type"], RD>
    readonly encode: SchemaGetter.SchemaGetter<To["Type"], From["Encoded"], RE>
  }
): (from: From) => decodeTo<From, To, RD, RE> {
  return (from: From): decodeTo<From, To, RD, RE> => {
    return transformation ? to.pipe(decodeTo(from, transformation)) : to.pipe(decodeTo(from))
  }
}

/**
 * Like {@link encodeTo}, but the transformation is applied to the encoded codec
 * (`encodedCodec(self)`).
 *
 * @since 4.0.0
 */
export function encode<S extends Top, RD = never, RE = never>(transformation: {
  readonly decode: SchemaGetter.SchemaGetter<S["Encoded"], S["Encoded"], RD>
  readonly encode: SchemaGetter.SchemaGetter<S["Encoded"], S["Encoded"], RE>
}) {
  return (self: S): decodeTo<S, encodedCodec<S>, RD, RE> => {
    return encodedCodec(self).pipe(decodeTo(self, SchemaTransformation.make(transformation)))
  }
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface withConstructorDefault<S extends Top> extends
  Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
    S["ast"],
    withConstructorDefault<S>,
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.isReadonly"],
    S["~type.isOptional"],
    "has-constructor-default",
    S["~encoded.isReadonly"],
    S["~encoded.isOptional"]
  >
{}

/**
 * Provide a default value when the input is `Option<undefined>`.
 *
 * @since 4.0.0
 */
export function withConstructorDefault<S extends Top & { readonly "~type.default": "no-constructor-default" }>(
  defaultValue: (
    input: O.Option<undefined>
    // `"~type.make.in"` is intentional here because it makes easier to define the default value
  ) => O.Option<S["~type.make.in"]> | Effect.Effect<O.Option<S["~type.make.in"]>>
) {
  return (self: S): withConstructorDefault<S> => {
    return make<withConstructorDefault<S>>(SchemaAST.withConstructorDefault(self.ast, defaultValue))
  }
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface tag<Tag extends SchemaAST.LiteralValue> extends withConstructorDefault<Literal<Tag>> {}

/**
 * Literal + withConstructorDefault
 *
 * @since 4.0.0
 */
export function tag<Tag extends SchemaAST.LiteralValue>(literal: Tag): tag<Tag> {
  return Literal(literal).pipe(withConstructorDefault(() => O.some(literal)))
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Option<S extends Top> extends declare<O.Option<S["Type"]>, O.Option<S["Encoded"]>, readonly [S]> {
  readonly "~rebuild.out": Option<S>
}

/**
 * @since 4.0.0
 */
export function Option<S extends Top>(value: S): Option<S> {
  return declare([value])<O.Option<S["Encoded"]>>()(
    ([value]) => (oinput, ast, options) => {
      if (O.isOption(oinput)) {
        if (O.isNone(oinput)) {
          return Result.okNone
        }
        const input = oinput.value
        return SchemaToParser.decodeUnknownSchemaResult(value)(input, options).pipe(SchemaResult.mapBoth(
          {
            onSuccess: O.some,
            onFailure: (issue) => {
              const actual = O.some(oinput)
              return new SchemaIssue.Composite(ast, actual, [issue])
            }
          }
        ))
      }
      return Result.err(new SchemaIssue.InvalidType(ast, O.some(oinput)))
    },
    {
      constructorTitle: "Option",
      defaultJsonSerializer: ([value]) =>
        link<O.Option<S["Encoded"]>>()(
          Union([Tuple([value]), Tuple([])]),
          SchemaTransformation.transform({
            decode: Arr.head,
            encode: (o) => (O.isSome(o) ? [o.value] as const : [] as const)
          })
        )
    }
  )
}

/**
 * @since 4.0.0
 */
export const NonEmptyString = String.check(SchemaCheck.nonEmpty)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Map$<Key extends Top, Value extends Top> extends
  declare<
    globalThis.Map<Key["Type"], Value["Type"]>,
    globalThis.Map<Key["Encoded"], Value["Encoded"]>,
    readonly [Key, Value]
  >
{
  readonly "~rebuild.out": Map$<Key, Value>
}

/**
 * @since 4.0.0
 */
export function Map<Key extends Top, Value extends Top>(key: Key, value: Value): Map$<Key, Value> {
  return declare([key, value])<globalThis.Map<Key["Encoded"], Value["Encoded"]>>()(
    ([key, value]) => (input, ast, options) => {
      if (input instanceof globalThis.Map) {
        const array = Array(Tuple([key, value]))
        return SchemaToParser.decodeUnknownSchemaResult(array)([...input], options).pipe(SchemaResult.mapBoth(
          {
            onSuccess: (array: ReadonlyArray<readonly [Key["Type"], Value["Type"]]>) => new globalThis.Map(array),
            onFailure: (issue) => new SchemaIssue.Composite(ast, O.some(input), [issue])
          }
        ))
      }
      return Result.err(new SchemaIssue.InvalidType(ast, O.some(input)))
    },
    {
      constructorTitle: "Map",
      defaultJsonSerializer: ([key, value]) =>
        link<globalThis.Map<Key["Encoded"], Value["Encoded"]>>()(
          Array(Tuple([key, value])),
          SchemaTransformation.transform({
            decode: (entries) => new globalThis.Map(entries),
            encode: (map) => [...map.entries()]
          })
        )
    }
  )
}

/**
 * @since 4.0.0
 */
export interface Opaque<Self, S extends Top> extends
  Bottom<
    Self,
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
    S["ast"],
    S["~rebuild.out"],
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.isReadonly"],
    S["~type.isOptional"],
    S["~type.default"],
    S["~encoded.isReadonly"],
    S["~encoded.isOptional"]
  >
{
  new(_: never): S["Type"]
}

/**
 * @since 4.0.0
 */
export function Opaque<Self>() {
  return <S extends Top>(schema: S): Opaque<Self, S> & Omit<S, "Type" | "Encoded"> => {
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    class Opaque {}
    Object.setPrototypeOf(Opaque, schema)
    return Opaque as any
  }
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface instanceOf<C> extends declare<C, C, readonly []> {
  readonly "~rebuild.out": instanceOf<C>
}

/**
 * @since 4.0.0
 */
export function instanceOf<const C extends new(...args: Array<any>) => any>(
  options: {
    readonly constructor: C
    readonly annotations?: SchemaAnnotations.Declaration<InstanceType<C>, readonly []> | undefined
  }
): instanceOf<InstanceType<C>> {
  return declareRefinement({
    is: (u): u is InstanceType<C> => u instanceof options.constructor,
    annotations: options.annotations
  })
}

/**
 * @since 4.0.0
 */
export function link<T>() { // TODO: better name
  return <To extends Top>(
    encodeTo: To,
    transformation: SchemaTransformation.SchemaTransformation<T, To["Type"], never, never>
  ): SchemaAST.Link => {
    return new SchemaAST.Link(encodeTo.ast, transformation)
  }
}

/**
 * @since 4.0.0
 */
export const URL = instanceOf({
  constructor: globalThis.URL,
  annotations: {
    title: "URL",
    defaultJsonSerializer: () =>
      link<URL>()(
        String,
        SchemaTransformation.transform({
          decode: (s) => new globalThis.URL(s),
          encode: (url) => url.toString()
        })
      )
  }
})

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Date extends instanceOf<globalThis.Date> {
  readonly "~rebuild.out": Date
}

/**
 * @since 4.0.0
 */
export const Date: Date = instanceOf({
  constructor: globalThis.Date,
  annotations: {
    title: "Date",
    defaultJsonSerializer: () =>
      link<globalThis.Date>()(
        String,
        SchemaTransformation.transform({
          decode: (s) => new globalThis.Date(s),
          encode: (date) => date.toISOString()
        })
      )
  }
})

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface UnknownFromJsonString extends decodeTo<Unknown, String, never, never> {
  readonly "~rebuild.out": UnknownFromJsonString
}

/**
 * @since 4.0.0
 */
export const UnknownFromJsonString: UnknownFromJsonString = String.pipe(
  decodeTo(
    Unknown,
    SchemaTransformation.json()
  )
)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Finite extends Number {
  readonly "~rebuild.out": Finite
}

/**
 * All finite numbers, excluding `NaN`, `Infinity`, and `-Infinity`.
 *
 * @since 4.0.0
 */
export const Finite = Number.check(SchemaCheck.finite)

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface FiniteFromString extends decodeTo<Number, String, never, never> {
  readonly "~rebuild.out": FiniteFromString
}

/**
 * @since 4.0.0
 */
export const FiniteFromString: FiniteFromString = String.pipe(
  decodeTo(
    Finite,
    SchemaTransformation.numberFromString
  )
)

/**
 * @since 4.0.0
 */
export function getNativeClassSchema<C extends new(...args: Array<any>) => any, S extends Struct<Struct.Fields>>(
  constructor: C,
  options: {
    readonly encoding: S
    readonly annotations?: SchemaAnnotations.Declaration<InstanceType<C>, readonly []>
  }
): decodeTo<instanceOf<C>, S, never, never> {
  const transformation = SchemaTransformation.transform<InstanceType<C>, S["Type"]>({
    decode: (props) => new constructor(props),
    encode: identity
  })
  return instanceOf({
    constructor,
    annotations: {
      defaultJsonSerializer: () => link<InstanceType<C>>()(options.encoding, transformation),
      ...options.annotations
    }
  }).pipe(encodeTo(options.encoding, transformation))
}

//
// Class APIs
//

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface Class<Self, S extends Top & { readonly fields: Struct.Fields }, Inherited> extends
  Bottom<
    Self,
    S["Encoded"],
    S["DecodingContext"],
    S["EncodingContext"],
    SchemaAST.Declaration,
    Class<Self, S, Self>,
    SchemaAnnotations.Declaration<Self, readonly [S]>,
    S["~type.make.in"],
    Self,
    S["~type.isReadonly"],
    S["~type.isOptional"],
    S["~type.default"],
    S["~encoded.isReadonly"],
    S["~encoded.isOptional"]
  >
{
  new(props: S["~type.make.in"], options?: MakeOptions): S["Type"] & Inherited
  readonly identifier: string
  readonly fields: S["fields"]
}

/**
 * Not all classes are extendable (e.g. `RequestClass`).
 *
 * @category Api interface
 * @since 4.0.0
 */
export interface ExtendableClass<Self, S extends Top & { readonly fields: Struct.Fields }, Inherited>
  extends Class<Self, S, Inherited>
{
  readonly "~rebuild.out": ExtendableClass<Self, S, Self>
  extend<Extended>(
    identifier: string
  ): <NewFields extends Struct.Fields>(
    fields: NewFields,
    annotations?: SchemaAnnotations.Bottom<Extended>
  ) => ExtendableClass<Extended, Struct<Simplify<Merge<S["fields"], NewFields>>>, Self>
}

function makeClass<
  Self,
  S extends Top & {
    readonly Type: object
    readonly fields: Struct.Fields
  },
  Inherited extends new(...args: ReadonlyArray<any>) => any
>(
  Inherited: Inherited,
  identifier: string,
  schema: S,
  annotations?: SchemaAnnotations.Declaration<unknown, ReadonlyArray<Top>>
): any {
  const computeAST = getComputeAST(schema.ast, { title: identifier, ...annotations }, undefined, undefined)

  return class extends Inherited {
    constructor(...[input, options]: ReadonlyArray<any>) {
      if (options?.disableValidation) {
        super(input, options)
      } else {
        const validated = schema.makeSync(input, options)
        super({ ...input, ...validated }, { ...options, disableValidation: true })
      }
    }

    static readonly [TypeId]: TypeId = TypeId

    declare static readonly "Type": Self
    declare static readonly "Encoded": S["Encoded"]
    declare static readonly "DecodingContext": S["DecodingContext"]
    declare static readonly "EncodingContext": S["EncodingContext"]

    declare static readonly "~rebuild.out": Class<Self, S, Self>
    declare static readonly "~annotate.in": SchemaAnnotations.Declaration<Self, readonly [S]>
    declare static readonly "~type.make.in": S["~type.make.in"]
    declare static readonly "~type.make": Self

    declare static readonly "~type.isReadonly": S["~type.isReadonly"]
    declare static readonly "~type.isOptional": S["~type.isOptional"]
    declare static readonly "~type.default": S["~type.default"]

    declare static readonly "~encoded.isReadonly": S["~encoded.isReadonly"]
    declare static readonly "~encoded.isOptional": S["~encoded.isOptional"]

    static readonly identifier = identifier
    static readonly fields = schema.fields

    static get ast(): SchemaAST.Declaration {
      return computeAST(this)
    }
    static pipe() {
      return pipeArguments(this, arguments)
    }
    static rebuild(ast: SchemaAST.Declaration): Class<Self, S, Self> {
      const computeAST = getComputeAST(this.ast, ast.annotations, ast.checks, ast.context)
      return class extends this {
        static get ast() {
          return computeAST(this)
        }
      }
    }
    static makeSync(input: S["~type.make.in"], options?: MakeOptions): Self {
      return new this(input, options)
    }
    static annotate(annotations: SchemaAnnotations.Bottom<Self>): Class<Self, S, Self> {
      return this.rebuild(SchemaAST.annotate(this.ast, annotations))
    }
    static check(
      ...checks: readonly [
        SchemaCheck.SchemaCheck<Self>,
        ...ReadonlyArray<SchemaCheck.SchemaCheck<Self>>
      ]
    ): Class<Self, S, Self> {
      return this.rebuild(SchemaAST.appendChecks(this.ast, checks))
    }
    static extend<Extended>(
      identifier: string
    ): <NewFields extends Struct.Fields>(
      fields: NewFields,
      annotations?: SchemaAnnotations.Bottom<Extended>
    ) => Class<Extended, Struct<Simplify<Merge<S["fields"], NewFields>>>, Self> {
      return (fields, annotations) => {
        const struct = schema.pipe(extend(fields))
        return makeClass(
          this,
          identifier,
          struct,
          annotations
        )
      }
    }
  }
}

const makeGetLink = (self: new(...args: ReadonlyArray<any>) => any) => (ast: SchemaAST.AST) =>
  new SchemaAST.Link(
    ast,
    new SchemaTransformation.SchemaTransformation(
      SchemaGetter.transform((input) => new self(input)),
      SchemaGetter.transformOrFail((input) => {
        if (!(input instanceof self)) {
          return Result.err(new SchemaIssue.InvalidType(ast, input))
        }
        return Result.ok(input)
      })
    )
  )

function getComputeAST(
  from: SchemaAST.AST,
  annotations: SchemaAnnotations.Declaration<unknown, ReadonlyArray<Top>> | undefined,
  checks: SchemaAST.Checks | undefined,
  context: SchemaAST.Context | undefined
) {
  let memo: SchemaAST.Declaration | undefined
  return (self: any) => {
    if (memo === undefined) {
      const getLink = makeGetLink(self)
      const contextLink = getLink(SchemaAST.unknownKeyword)
      memo = new SchemaAST.Declaration(
        [from],
        () => (input, ast) => {
          if (input instanceof self) {
            return Result.ok(input)
          }
          return Result.err(new SchemaIssue.InvalidType(ast, O.some(input)))
        },
        {
          defaultJsonSerializer: ([from]: [Top]) => getLink(from.ast),
          ...annotations
        },
        checks,
        [getLink(from)],
        context ?
          new SchemaAST.Context(
            context.isOptional,
            context.isReadonly,
            context.defaultValue,
            context.make ? [...context.make, contextLink] : [contextLink],
            context.annotations
          ) :
          new SchemaAST.Context(false, true, undefined, [contextLink], undefined)
      )
    }
    return memo
  }
}

/**
 * @since 4.0.0
 */
export const Class: {
  <Self, Brand = {}>(identifier: string): {
    <const Fields extends Struct.Fields>(
      fields: Fields,
      annotations?: SchemaAnnotations.Bottom<Self>
    ): ExtendableClass<Self, Struct<Fields>, Brand>
    <S extends Struct<Struct.Fields>>(
      schema: S,
      annotations?: SchemaAnnotations.Bottom<Self>
    ): ExtendableClass<Self, S, Brand>
  }
} = <Self, Brand = {}>(identifier: string) =>
(
  schema: Struct.Fields | Struct<Struct.Fields>,
  annotations?: SchemaAnnotations.Bottom<Self>
): ExtendableClass<Self, Struct<Struct.Fields>, Brand> => {
  const struct = isSchema(schema) ? schema : Struct(schema)

  return makeClass(
    Data.Class,
    identifier,
    struct,
    annotations
  )
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface ErrorClass<Self, S extends Top & { readonly fields: Struct.Fields }, Inherited>
  extends ExtendableClass<Self, S, Inherited>
{
  readonly "~rebuild.out": ErrorClass<Self, S, Self>
}

/**
 * @since 4.0.0
 */
export const ErrorClass: {
  <Self, Brand = {}>(identifier: string): {
    <const Fields extends Struct.Fields>(
      fields: Fields,
      annotations?: SchemaAnnotations.Bottom<Self>
    ): ErrorClass<Self, Struct<Fields>, Cause.YieldableError & Brand>
    <S extends Struct<Struct.Fields>>(
      schema: S,
      annotations?: SchemaAnnotations.Bottom<Self>
    ): ErrorClass<Self, S, Cause.YieldableError & Brand>
  }
} = <Self, Brand = {}>(identifier: string) =>
(
  schema: Struct.Fields | Struct<Struct.Fields>,
  annotations?: SchemaAnnotations.Bottom<Self>
): ErrorClass<Self, Struct<Struct.Fields>, Cause.YieldableError & Brand> => {
  const struct = isSchema(schema) ? schema : Struct(schema)

  return makeClass(
    core.Error,
    identifier,
    struct,
    annotations
  )
}

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface RequestClass<
  Self,
  Payload extends Struct<Struct.Fields>,
  Success extends Top,
  Error extends Top,
  Inherited
> extends Class<Self, Payload, Inherited> {
  readonly "~rebuild.out": RequestClass<Self, Payload, Success, Error, Self>
  readonly payload: Payload
  readonly success: Success
  readonly error: Error
}

/**
 * @since 4.0.0
 */
export const RequestClass =
  <Self, Brand = {}>(identifier: string) =>
  <Payload extends Struct<Struct.Fields>, Success extends Top, Error extends Top>(
    options: {
      readonly payload: Payload
      readonly success: Success
      readonly error: Error
      readonly annotations?: SchemaAnnotations.Bottom<Self>
    }
  ): RequestClass<
    Self,
    Payload,
    Success,
    Error,
    Request.Request<
      Success["Type"],
      Error["Type"],
      Success["DecodingContext"] | Success["EncodingContext"] | Error["DecodingContext"] | Error["EncodingContext"]
    > & Brand
  > => {
    return class RequestClass extends makeClass(
      Request.Class,
      identifier,
      options.payload,
      options.annotations
    ) {
      static readonly payload = options.payload
      static readonly success = options.success
      static readonly error = options.error
    } as any
  }

/**
 * @category Api interface
 * @since 4.0.0
 */
export interface declareRefinement<T> extends declare<T, T, readonly []> {
  readonly "~rebuild.out": declareRefinement<T>
}

/**
 * @since 4.0.0
 */
export function declareRefinement<T>(
  options: {
    readonly is: (u: unknown) => u is T
    annotations?: SchemaAnnotations.Declaration<T, readonly []> | undefined
  }
): declareRefinement<T> {
  return declare([])<T>()(
    () => (input, ast) =>
      options.is(input) ?
        Result.ok(input) :
        Result.err(new SchemaIssue.InvalidType(ast, O.some(input))),
    options.annotations
  )
}

/**
 * @since 4.0.0
 */
export function declare<const TypeParameters extends ReadonlyArray<Top>>(typeParameters: TypeParameters) {
  return <E>() =>
  <T>(
    run: (
      typeParameters: {
        readonly [K in keyof TypeParameters]: Codec<TypeParameters[K]["Type"], TypeParameters[K]["Encoded"]>
      }
    ) => (u: unknown, self: SchemaAST.Declaration, options: SchemaAST.ParseOptions) => SchemaResult.SchemaResult<T>,
    annotations?: SchemaAnnotations.Declaration<T, TypeParameters>
  ): declare<T, E, TypeParameters> => {
    return make<declare<T, E, TypeParameters>>(
      new SchemaAST.Declaration(
        typeParameters.map((tp) => tp.ast),
        (typeParameters) => run(typeParameters.map(make) as any),
        annotations,
        undefined,
        undefined,
        undefined
      )
    )
  }
}
