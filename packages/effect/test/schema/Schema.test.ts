import { Cause, DateTime, Effect, Exit, flow, pipe, ServiceMap, String as Str } from "effect"
import { Option, Order, Predicate, Redacted, Result, Struct, Tuple } from "effect/data"
import { Equal } from "effect/interfaces"
import { AST, Check, Getter, Issue, Schema, ToParser, Transformation } from "effect/schema"
import { TestSchema } from "effect/testing"
import { produce } from "immer"
import { deepStrictEqual, fail, ok, strictEqual } from "node:assert"
import { describe, it } from "vitest"
import { assertFalse, assertInclude, assertTrue, throws } from "../utils/assert.ts"

const verifyGeneration = true

const equals = TestSchema.Asserts.ast.fields.equals

const Trim = Schema.String.pipe(Schema.decode(Transformation.trim()))

const SnakeToCamel = Schema.String.pipe(
  Schema.decode(
    Transformation.snakeToCamel()
  )
)

const NumberFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Number,
    {
      decode: Getter.Number(),
      encode: Getter.String()
    }
  )
)

describe("Schema", () => {
  it("isSchema", () => {
    class A extends Schema.Class<A>("A")(Schema.Struct({
      a: Schema.String
    })) {}
    class B extends Schema.Opaque<B>()(Schema.Struct({ a: Schema.String })) {}
    assertTrue(Schema.isSchema(Schema.String))
    assertTrue(Schema.isSchema(A))
    assertTrue(Schema.isSchema(B))
    assertFalse(Schema.isSchema({}))
  })

  it("toString", () => {
    const schema = Schema.String
    const result = Schema.decodeUnknownExit(schema)(null)
    assertTrue(Exit.isFailure(result))
    strictEqual(String(result.cause.failures[0]), "Fail(SchemaError(Expected string, got null))")
  })

  describe("annotate", () => {
    it("should remove any existing id annotation", () => {
      const schema = Schema.String.annotate({ identifier: "a" })
      strictEqual(schema.ast.annotations?.identifier, "a")
      strictEqual(schema.annotate({}).ast.annotations?.identifier, undefined)
    })
  })

  describe("parseOptions annotation", () => {
    it("Number", async () => {
      const schema = Schema.Number.check(Check.positive(), Check.int()).annotate({ parseOptions: { errors: "all" } })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.fail(
        -1.2,
        `Expected a value greater than 0, got -1.2
Expected an integer, got -1.2`
      )
    })

    it("Struct", async () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Struct({
          c: Schema.String,
          d: Schema.String
        }).annotate({ parseOptions: { errors: "first" } })
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding({ parseOptions: { errors: "all" } })
      await decoding.fail(
        { a: "a", b: {} },
        `Missing key
  at ["b"]["c"]`
      )
    })
  })

  describe("Literal", () => {
    it("should throw an error if the literal is not a finite number", () => {
      throws(
        () => Schema.Literal(Infinity),
        new Error("LiteralType must be a finite number")
      )
      throws(
        () => Schema.Literal(-Infinity),
        new Error("LiteralType must be a finite number")
      )
      throws(
        () => Schema.Literal(NaN),
        new Error("LiteralType must be a finite number")
      )
    })

    it("should expose the literal", () => {
      const schema = Schema.Literal("a")
      strictEqual(schema.literal, "a")
      strictEqual(schema.annotate({}).literal, "a")
    })

    it(`"a"`, async () => {
      const schema = Schema.Literal("a")
      const asserts = new TestSchema.Asserts(schema)

      const make = asserts.make()
      await make.succeed("a")
      await make.fail(null, `Expected "a", got null`)

      const decoding = asserts.decoding()
      await decoding.succeed("a")
      await decoding.fail(1, `Expected "a", got 1`)

      const encoding = asserts.encoding()
      await encoding.succeed("a")
      await encoding.fail(1, `Expected "a", got 1`)
    })

    it(`1`, async () => {
      const schema = Schema.Literal(1)
      const asserts = new TestSchema.Asserts(schema)

      const make = asserts.make()
      await make.succeed(1)
      await make.fail(null, `Expected 1, got null`)

      const decoding = asserts.decoding()
      await decoding.succeed(1)
      await decoding.fail("1", `Expected 1, got "1"`)

      const encoding = asserts.encoding()
      await encoding.succeed(1)
      await encoding.fail("1", `Expected 1, got "1"`)
    })
  })

  describe("Literals", () => {
    it("red, green, blue", async () => {
      const schema = Schema.Literals(["red", "green", "blue"])

      deepStrictEqual(schema.literals, ["red", "green", "blue"])

      const asserts = new TestSchema.Asserts(schema)
      const make = asserts.make()
      await make.succeed("red")
      await make.succeed("green")
      await make.succeed("blue")
      await make.fail("yellow", `Expected "red" | "green" | "blue", got "yellow"`)
    })

    it("pick", () => {
      const schema = Schema.Literals(["a", "b", "c"]).pick(["a", "b"])

      deepStrictEqual(schema.literals, ["a", "b"])
    })
  })

  it("Never", async () => {
    const schema = Schema.Never
    const asserts = new TestSchema.Asserts(schema)

    const make = asserts.make()
    await make.fail(null as never, `Expected never, got null`)

    const decoding = asserts.decoding()
    await decoding.fail("a", `Expected never, got "a"`)

    const encoding = asserts.encoding()
    await encoding.fail("a", `Expected never, got "a"`)
  })

  it("Any", async () => {
    const schema = Schema.Any
    const asserts = new TestSchema.Asserts(schema)

    const make = asserts.make()
    await make.succeed("a")

    const decoding = asserts.decoding()
    await decoding.succeed("a")
  })

  it("Unknown", async () => {
    const schema = Schema.Unknown
    const asserts = new TestSchema.Asserts(schema)

    const make = asserts.make()
    await make.succeed("a")

    const decoding = asserts.decoding()
    await decoding.succeed("a")
  })

  it("Null", async () => {
    const schema = Schema.Null
    const asserts = new TestSchema.Asserts(schema)

    const make = asserts.make()
    await make.succeed(null)
    await make.fail(undefined, `Expected null, got undefined`)
  })

  it("Undefined", async () => {
    const schema = Schema.Undefined
    const asserts = new TestSchema.Asserts(schema)

    const make = asserts.make()
    await make.succeed(undefined)
    await make.fail(null, `Expected undefined, got null`)
  })

  it("String", async () => {
    const schema = Schema.String
    const asserts = new TestSchema.Asserts(schema)

    const make = asserts.make()
    await make.succeed("a")
    await make.fail(null, `Expected string, got null`)

    const decoding = asserts.decoding()
    await decoding.succeed("a")
    await decoding.fail(1, `Expected string, got 1`)

    const encoding = asserts.encoding()
    await encoding.succeed("a")
    await encoding.fail(1, `Expected string, got 1`)
  })

  it("Number", async () => {
    const schema = Schema.Number
    const asserts = new TestSchema.Asserts(schema)

    const make = asserts.make()
    await make.succeed(1)
    await make.fail(null, `Expected number, got null`)

    const decoding = asserts.decoding()
    await decoding.succeed(1)
    await decoding.fail("a", `Expected number, got "a"`)

    const encoding = asserts.encoding()
    await encoding.succeed(1)
    await encoding.fail("a", `Expected number, got "a"`)
  })

  it("Boolean", async () => {
    const schema = Schema.Boolean
    const asserts = new TestSchema.Asserts(schema)

    const make = asserts.make()
    await make.succeed(true)
    await make.succeed(false)
    await make.fail(null, `Expected boolean, got null`)

    const decoding = asserts.decoding()
    await decoding.succeed(true)
    await decoding.succeed(false)
    await decoding.fail("a", `Expected boolean, got "a"`)

    const encoding = asserts.encoding()
    await encoding.succeed(true)
    await encoding.succeed(false)
    await encoding.fail("a", `Expected boolean, got "a"`)
  })

  it("Symbol", async () => {
    const schema = Schema.Symbol
    const asserts = new TestSchema.Asserts(schema)

    const make = asserts.make()
    await make.succeed(Symbol("a"))
    await make.fail(null, `Expected symbol, got null`)

    const decoding = asserts.decoding()
    await decoding.succeed(Symbol("a"))
    await decoding.fail("a", `Expected symbol, got "a"`)

    const encoding = asserts.encoding()
    await encoding.succeed(Symbol("a"))
    await encoding.fail("a", `Expected symbol, got "a"`)
  })

  it("UniqueSymbol", async () => {
    const a = Symbol("a")
    const schema = Schema.UniqueSymbol(a)
    const asserts = new TestSchema.Asserts(schema)

    const make = asserts.make()
    await make.succeed(a)
    await make.fail(Symbol("b"), `Expected Symbol(a), got Symbol(b)`)

    const decoding = asserts.decoding()
    await decoding.succeed(a)
    await decoding.fail(Symbol("b"), `Expected Symbol(a), got Symbol(b)`)
  })

  it("BigInt", async () => {
    const schema = Schema.BigInt
    const asserts = new TestSchema.Asserts(schema)

    const make = asserts.make()
    await make.succeed(1n)
    await make.fail(null, `Expected bigint, got null`)

    const decoding = asserts.decoding()
    await decoding.succeed(1n)
    await decoding.fail("1", `Expected bigint, got "1"`)

    const encoding = asserts.encoding()
    await encoding.succeed(1n)
    await encoding.fail("1", `Expected bigint, got "1"`)
  })

  it("Void", async () => {
    const schema = Schema.Void
    const asserts = new TestSchema.Asserts(schema)

    const make = asserts.make()
    await make.succeed(undefined)
    await make.fail(null, `Expected void, got null`)

    const decoding = asserts.decoding()
    await decoding.succeed(undefined)
    await decoding.fail(null, `Expected void, got null`)

    const encoding = asserts.encoding()
    await encoding.succeed(undefined)
    await encoding.fail("1", `Expected void, got "1"`)
  })

  it("Object", async () => {
    const schema = Schema.Object
    const asserts = new TestSchema.Asserts(schema)

    const make = asserts.make()
    await make.succeed({})
    await make.succeed([])
    await make.fail(null, `Expected object | array | function, got null`)

    const decoding = asserts.decoding()
    await decoding.succeed({})
    await decoding.succeed([])
    await decoding.fail("1", `Expected object | array | function, got "1"`)

    const encoding = asserts.encoding()
    await encoding.succeed({})
    await encoding.succeed([])
    await encoding.fail("1", `Expected object | array | function, got "1"`)
  })

  describe("Struct", () => {
    it("should throw an error if there are duplicate property signatures", () => {
      throws(
        () =>
          new AST.TypeLiteral(
            [
              new AST.PropertySignature("a", Schema.String.ast),
              new AST.PropertySignature("b", Schema.String.ast),
              new AST.PropertySignature("c", Schema.String.ast),
              new AST.PropertySignature("a", Schema.String.ast),
              new AST.PropertySignature("c", Schema.String.ast)
            ],
            []
          ),
        new Error(`Duplicate identifiers: ["a","c"]. ts(2300)`)
      )
    })

    describe("propertyOrder", () => {
      it("all required fields", () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.String
        })

        const input = { c: "c", b: "b", a: "a", d: "d" }
        const output = Schema.decodeUnknownSync(schema)(input, {
          propertyOrder: "original",
          onExcessProperty: "preserve"
        })
        deepStrictEqual(Object.keys(output), ["c", "b", "a", "d"])
      })

      it("optional field with default", () => {
        const schema = Schema.Struct({
          a: Schema.String.pipe(Schema.encode({
            decode: Getter.withDefault(() => "default-a"),
            encode: Getter.passthrough()
          })),
          b: Schema.String
        })

        const input = { c: "c", b: "b", d: "d" }
        const output = Schema.decodeUnknownSync(schema)(input, {
          propertyOrder: "original",
          onExcessProperty: "preserve"
        })
        deepStrictEqual(Object.keys(output), ["c", "b", "d", "a"])
      })
    })

    describe("onExcessProperty", () => {
      it("error", async () => {
        const schema = Schema.Struct({
          a: Schema.String
        })
        const asserts = new TestSchema.Asserts(schema)
        const decoding = asserts.decoding({ parseOptions: { onExcessProperty: "error" } })
        await decoding.fail(
          { a: "a", b: "b" },
          `Unexpected key
  at ["b"]`
        )
        const sym = Symbol("sym")
        await decoding.fail(
          { a: "a", [sym]: "sym" },
          `Unexpected key
  at [Symbol(sym)]`
        )

        const decodingAll = asserts.decoding({ parseOptions: { onExcessProperty: "error", errors: "all" } })
        await decodingAll.fail(
          { a: "a", b: "b", c: "c" },
          `Unexpected key
  at ["b"]
Unexpected key
  at ["c"]`
        )
      })

      it("preserve", async () => {
        const schema = Schema.Struct({
          a: Schema.String
        })
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding({ parseOptions: { onExcessProperty: "preserve" } })
        const sym = Symbol("sym")
        await decoding.succeed(
          { a: "a", b: "b", c: "c", [sym]: "sym" }
        )
      })
    })

    it("should corectly handle __proto__", async () => {
      const schema = Schema.Struct({
        ["__proto__"]: Schema.String
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ ["__proto__"]: "a" })
      await decoding.fail(
        { __proto__: "a" },
        `Missing key
  at ["__proto__"]`
      )
    })

    it(`{ readonly "a": string }`, async () => {
      const schema = Schema.Struct({
        a: Schema.String
      })
      const asserts = new TestSchema.Asserts(schema)

      // Should be able to access the fields
      deepStrictEqual(schema.fields, { a: Schema.String })

      const make = asserts.make()
      await make.succeed({ a: "a" })
      await make.fail(null, `Expected object, got null`)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "a" })
      await decoding.fail(
        {},
        `Missing key
  at ["a"]`
      )
      await decoding.fail(
        { a: 1 },
        `Expected string, got 1
  at ["a"]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed({ a: "a" })
      await encoding.fail(
        {},
        `Missing key
  at ["a"]`
      )
      await encoding.fail(
        { a: 1 },
        `Expected string, got 1
  at ["a"]`
      )
    })

    it(`{ readonly "a": <transformation> }`, async () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "1" }, { a: 1 })
      await decoding.fail(
        { a: "a" },
        `Expected a finite number, got NaN
  at ["a"]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed({ a: 1 }, { a: "1" })
      await encoding.fail(
        { a: "a" },
        `Expected number, got "a"
  at ["a"]`
      )
    })

    it(`Schema.optionalKey: { readonly "a"?: string }`, async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.String)
      })
      const asserts = new TestSchema.Asserts(schema)

      const make = asserts.make()
      await make.succeed({ a: "a" })
      await make.succeed({})

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "a" })
      await decoding.succeed({})
      await decoding.fail(
        { a: 1 },
        `Expected string, got 1
  at ["a"]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed({ a: "a" })
      await encoding.succeed({})
      await encoding.fail(
        { a: 1 },
        `Expected string, got 1
  at ["a"]`
      )
    })

    it(`Schema.optional: { readonly "a"?: string | undefined }`, async () => {
      const schema = Schema.Struct({
        a: Schema.optional(Schema.String)
      })
      const asserts = new TestSchema.Asserts(schema)

      const make = asserts.make()
      await make.succeed({ a: "a" })
      await make.succeed({ a: undefined })
      await make.succeed({})

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "a" })
      await decoding.succeed({ a: undefined })
      await decoding.succeed({})
      await decoding.fail(
        { a: 1 },
        `Expected string | undefined, got 1
  at ["a"]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed({ a: "a" })
      await encoding.succeed({ a: undefined })
      await encoding.succeed({})
      await encoding.fail(
        { a: 1 },
        `Expected string | undefined, got 1
  at ["a"]`
      )
    })

    it(`{ readonly "a"?: <transformation> }`, async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.FiniteFromString)
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "1" }, { a: 1 })
      await decoding.succeed({})
      await decoding.fail(
        { a: undefined },
        `Expected string, got undefined
  at ["a"]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed({ a: 1 }, { a: "1" })
      await encoding.succeed({})
    })

    describe("ParseOptions", () => {
      it(`{ errors: "all" }`, async () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.Number
        })
        const asserts = new TestSchema.Asserts(schema)

        const make = asserts.make({ parseOptions: { errors: "all" } })
        await make.fail(
          {},
          `Missing key
  at ["a"]
Missing key
  at ["b"]`
        )

        const decoding = asserts.decoding({ parseOptions: { errors: "all" } })
        await decoding.fail(
          {},
          `Missing key
  at ["a"]
Missing key
  at ["b"]`
        )

        const encoding = asserts.encoding({ parseOptions: { errors: "all" } })
        await encoding.fail(
          {},
          `Missing key
  at ["a"]
Missing key
  at ["b"]`
        )
      })
    })

    describe("merge", () => {
      it("Struct", async () => {
        const from = Schema.Struct({
          a: Schema.String
        })
        const schema = from.mapFields(Struct.merge({ b: Schema.String }))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed({ a: "a", b: "b" })
        await decoding.fail(
          { b: "b" },
          `Missing key
  at ["a"]`
        )
        await decoding.fail(
          { a: "a" },
          `Missing key
  at ["b"]`
        )
      })

      it("overlapping fields", async () => {
        const from = Schema.Struct({
          a: Schema.String,
          b: Schema.String
        })
        const schema = from.mapFields(Struct.merge({ b: Schema.Number, c: Schema.Number }))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed({ a: "a", b: 1, c: 2 })
        await decoding.fail(
          { a: "a", b: "b" },
          `Expected number, got "b"
  at ["b"]`
        )
      })

      it("Struct & check & preserveChecks: true", async () => {
        const from = Schema.Struct({
          a: Schema.String,
          b: Schema.String
        }).check(
          Check.make(({ a, b }) => a === b, { title: "a === b" })
        )
        const schema = from.mapFields(Struct.merge({ c: Schema.String }), { preserveChecks: true })
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed({ a: "a", b: "a", c: "c" })
        await decoding.fail(
          { a: "", b: "b", c: "c" },
          `Expected a === b, got {"a":"","b":"b","c":"c"}`
        )
      })
    })

    describe("pick", () => {
      it("Struct", async () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.String
        }).mapFields(Struct.pick(["a"]))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed({ a: "a" })
      })
    })

    describe("omit", () => {
      it("Struct", async () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.String
        }).mapFields(Struct.omit(["b"]))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed({ a: "a" })
      })
    })
  })

  describe("Tuple", () => {
    it("A required element cannot follow an optional element", () => {
      throws(
        () => Schema.Tuple([Schema.optionalKey(Schema.String), Schema.String]),
        new Error("A required element cannot follow an optional element. ts(1257)")
      )
      throws(
        () => Schema.Tuple([Schema.optional(Schema.String), Schema.String]),
        new Error("A required element cannot follow an optional element. ts(1257)")
      )
    })

    it("should fail on unexpected indexes", async () => {
      const schema = Schema.Tuple([Schema.String])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.fail(
        ["a", "b"],
        `Unexpected key
  at [1]`
      )
      const decodingAll = asserts.decoding({ parseOptions: { errors: "all" } })
      await decodingAll.fail(
        ["a", "b", "c"],
        `Unexpected key
  at [1]
Unexpected key
  at [2]`
      )
    })

    it(`readonly [string]`, async () => {
      const schema = Schema.Tuple([Schema.NonEmptyString])
      const asserts = new TestSchema.Asserts(schema)

      // should be able to access the elements
      deepStrictEqual(schema.elements, [Schema.NonEmptyString])

      const make = asserts.make()
      await make.succeed(["a"])
      await make.fail(
        [""],
        `Expected a value with a length of at least 1, got ""
  at [0]`
      )

      const decoding = asserts.decoding()
      await decoding.succeed(["a"])
      await decoding.fail(null, `Expected array, got null`)
      await decoding.fail(
        [],
        `Missing key
  at [0]`
      )
      await decoding.fail(
        [1],
        `Expected string, got 1
  at [0]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed(["a"])
      await encoding.fail(
        [],
        `Missing key
  at [0]`
      )
      await encoding.fail(
        [1],
        `Expected string, got 1
  at [0]`
      )
    })

    it(`readonly [string?]`, async () => {
      const schema = Schema.Tuple([Schema.String.pipe(Schema.optionalKey)])
      const asserts = new TestSchema.Asserts(schema)

      const make = asserts.make()
      await make.succeed(["a"])
      await make.succeed([])

      const decoding = asserts.decoding()
      await decoding.succeed(["a"])
      await decoding.succeed([])

      const encoding = asserts.encoding()
      await encoding.succeed(["a"])
      await encoding.succeed([])
    })
  })

  describe("Array", () => {
    it("should expose the item schema", () => {
      const schema = Schema.Array(Schema.String)
      strictEqual(schema.schema, Schema.String)
      strictEqual(schema.annotate({}).schema, Schema.String)
    })

    it("readonly string[]", async () => {
      const schema = Schema.Array(Schema.String)
      const asserts = new TestSchema.Asserts(schema)

      const make = asserts.make()
      await make.succeed(["a", "b"])

      const decoding = asserts.decoding()
      await decoding.succeed(["a", "b"])
      await decoding.fail(
        ["a", 1],
        `Expected string, got 1
  at [1]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed(["a", "b"])
      await encoding.fail(
        ["a", 1],
        `Expected string, got 1
  at [1]`
      )
    })
  })

  describe("NonEmptyArray", () => {
    it("should expose the item schema", () => {
      const schema = Schema.NonEmptyArray(Schema.String)
      strictEqual(schema.schema, Schema.String)
    })

    it("readonly string[]", async () => {
      const schema = Schema.NonEmptyArray(Schema.String)
      const asserts = new TestSchema.Asserts(schema)

      const make = asserts.make()
      await make.succeed(["a"])
      await make.succeed(["a", "b"])

      const decoding = asserts.decoding()
      await decoding.succeed(["a"])
      await decoding.succeed(["a", "b"])
      await decoding.fail(
        [],
        `Missing key
  at [0]`
      )
      await decoding.fail(
        ["a", 1],
        `Expected string, got 1
  at [1]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed(["a"])
      await encoding.succeed(["a", "b"])
      await encoding.fail(
        [],
        `Missing key
  at [0]`
      )
      await encoding.fail(
        ["a", 1],
        `Expected string, got 1
  at [1]`
      )
    })
  })

  it("Trimmed", async () => {
    const schema = Schema.Trimmed
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }

    const decoding = asserts.decoding()
    await decoding.succeed("a")
    await decoding.fail(
      " a ",
      `Expected a string with no leading or trailing whitespace, got " a "`
    )
  })

  describe("Checks", () => {
    describe("check", () => {
      it("single check", async () => {
        const schema = Schema.String.check(Check.minLength(3))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed("abc")
        await decoding.fail(
          "ab",
          `Expected a value with a length of at least 3, got "ab"`
        )
      })

      it("multiple checks", async () => {
        const schema = Schema.String.check(
          Check.minLength(3),
          Check.includes("c")
        )
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed("abc")
        await decoding.fail(
          "ab",
          `Expected a value with a length of at least 3, got "ab"`
        )
        const decodingAll = asserts.decoding({ parseOptions: { errors: "all" } })
        await decodingAll.fail(
          "ab",
          `Expected a value with a length of at least 3, got "ab"
Expected a string including "c", got "ab"`
        )
      })

      it("aborting checks", async () => {
        const schema = Schema.String.check(
          Check.abort(Check.minLength(2)),
          Check.includes("b")
        )
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.fail(
          "a",
          `Expected a value with a length of at least 2, got "a"`
        )
      })
    })

    describe("refinements", () => {
      it("refineByGuard", async () => {
        const schema = Schema.Option(Schema.String).pipe(
          Schema.refineByGuard(Option.isSome, { title: "isSome" }),
          Schema.check(
            Check.make(({ value }) => value.length > 0, { title: "length > 0" })
          )
        )
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed(Option.some("a"))
        await decoding.fail(
          Option.some(""),
          `Expected length > 0, got some("")`
        )
        await decoding.fail(
          Option.none(),
          `Expected isSome, got none()`
        )
      })

      describe("brand", () => {
        it("single brand", () => {
          const schema = Schema.Number.pipe(Schema.brand("MyBrand"))

          deepStrictEqual(schema.ast.checks?.[0]?.annotations?.["~effect/schema/Check/brand"], "MyBrand")
        })

        it("double brand", () => {
          const schema = Schema.Number.pipe(
            Schema.brand("MyBrand"),
            Schema.brand("MyBrand2")
          )

          deepStrictEqual(schema.ast.checks?.[0]?.annotations?.["~effect/schema/Check/brand"], "MyBrand")
          deepStrictEqual(schema.ast.checks?.[1]?.annotations?.["~effect/schema/Check/brand"], "MyBrand2")
        })

        it("annotate should support getters", () => {
          const schema = Schema.String.pipe(Schema.brand("brand")).annotate({
            get examples() {
              return [
                schema.makeUnsafe("a"),
                schema.makeUnsafe("b")
              ]
            }
          })

          deepStrictEqual(schema.ast.checks?.[0]?.annotations?.examples, ["a", "b"])
        })

        it("annotateKey should support getters", () => {
          const schema = Schema.String.pipe(
            Schema.brand("brand")
          ).annotateKey({
            get examples() {
              return [
                schema.makeUnsafe("a"),
                schema.makeUnsafe("b")
              ]
            }
          })

          deepStrictEqual(schema.ast.context?.annotations?.examples, ["a", "b"])
        })
      })

      it("group", async () => {
        const usernameGroup = Check.makeGroup(
          [
            Check.minLength(3),
            Check.regex(/^[a-zA-Z0-9]+$/, {
              title: "alphanumeric",
              description: "must contain only letters and numbers"
            }),
            Check.trimmed()
          ],
          {
            title: "username",
            description: "a valid username"
          }
        ).pipe(Check.brand("Username"))

        const Username = Schema.String.pipe(Schema.refine(usernameGroup))
        const asserts = new TestSchema.Asserts(Username)

        const decoding = asserts.decoding()
        await decoding.succeed("abc")
        await decoding.fail(
          "",
          `Expected a value with a length of at least 3, got ""`
        )
      })
    })

    describe("String checks", () => {
      it("regex", async () => {
        const schema = Schema.String.check(Check.regex(/^a/))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed("a")
        await decoding.fail(
          "b",
          `Expected a string matching the regex ^a, got "b"`
        )

        const encoding = asserts.encoding()
        await encoding.succeed("a")
        await encoding.fail(
          "b",
          `Expected a string matching the regex ^a, got "b"`
        )
      })

      it("startsWith", async () => {
        const schema = Schema.String.check(Check.startsWith("a"))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed("a")
        await decoding.fail(
          "b",
          `Expected a string starting with "a", got "b"`
        )

        const encoding = asserts.encoding()
        await encoding.succeed("a")
        await encoding.fail(
          "b",
          `Expected a string starting with "a", got "b"`
        )
      })

      it("endsWith", async () => {
        const schema = Schema.String.check(Check.endsWith("a"))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed("a")
        await decoding.fail(
          "b",
          `Expected a string ending with "a", got "b"`
        )

        const encoding = asserts.encoding()
        await encoding.succeed("a")
        await encoding.fail(
          "b",
          `Expected a string ending with "a", got "b"`
        )
      })

      it("lowercased", async () => {
        const schema = Schema.String.check(Check.lowercased())
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed("a")
        await decoding.fail(
          "A",
          `Expected a string with all characters in lowercase, got "A"`
        )

        const encoding = asserts.encoding()
        await encoding.succeed("a")
        await encoding.fail(
          "A",
          `Expected a string with all characters in lowercase, got "A"`
        )
      })

      it("uppercased", async () => {
        const schema = Schema.String.check(Check.uppercased())
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed("A")
        await decoding.fail(
          "a",
          `Expected a string with all characters in uppercase, got "a"`
        )

        const encoding = asserts.encoding()
        await encoding.succeed("A")
        await encoding.fail(
          "a",
          `Expected a string with all characters in uppercase, got "a"`
        )
      })

      it("capitalized", async () => {
        const schema = Schema.String.check(Check.capitalized())
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed("Abc")
        await decoding.fail(
          "abc",
          `Expected a string with the first character in uppercase, got "abc"`
        )

        const encoding = asserts.encoding()
        await encoding.succeed("Abc")
        await encoding.fail(
          "abc",
          `Expected a string with the first character in uppercase, got "abc"`
        )
      })

      it("uncapitalized", async () => {
        const schema = Schema.String.check(Check.uncapitalized())
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed("aBC")
        await decoding.fail(
          "ABC",
          `Expected a string with the first character in lowercase, got "ABC"`
        )

        const encoding = asserts.encoding()
        await encoding.succeed("aBC")
        await encoding.fail(
          "ABC",
          `Expected a string with the first character in lowercase, got "ABC"`
        )
      })

      it("minLength", async () => {
        const schema = Schema.String.check(Check.minLength(1))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed("a")
        await decoding.fail(
          "",
          `Expected a value with a length of at least 1, got ""`
        )

        const encoding = asserts.encoding()
        await encoding.succeed("a")
        await encoding.fail(
          "",
          `Expected a value with a length of at least 1, got ""`
        )
      })

      it("minEntries", async () => {
        const schema = Schema.Record(Schema.String, Schema.Finite).check(Check.minEntries(1))
        const asserts = new TestSchema.Asserts(schema)

        const decodingAll = asserts.decoding({ parseOptions: { errors: "all" } })
        await decodingAll.succeed({ a: 1, b: 2 })
        await decodingAll.fail(
          {},
          `Expected an object with at least 1 entries, got {}`
        )
      })

      it("maxEntries", async () => {
        const schema = Schema.Record(Schema.String, Schema.Finite).check(Check.maxEntries(2))
        const asserts = new TestSchema.Asserts(schema)

        const decodingAll = asserts.decoding({ parseOptions: { errors: "all" } })
        await decodingAll.succeed({ a: 1, b: 2 })
        await decodingAll.fail(
          { a: 1, b: 2, c: 3 },
          `Expected an object with at most 2 entries, got {"a":1,"b":2,"c":3}`
        )
        await decodingAll.fail(
          { a: 1, b: 2, c: 3 },
          `Expected an object with at most 2 entries, got {"a":1,"b":2,"c":3}`
        )
      })
    })

    describe("Number checks", () => {
      it("greaterThan", async () => {
        const schema = Schema.Number.check(Check.greaterThan(1))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed(2)
        await decoding.fail(
          1,
          `Expected a value greater than 1, got 1`
        )

        const encoding = asserts.encoding()
        await encoding.succeed(2)
        await encoding.fail(
          1,
          `Expected a value greater than 1, got 1`
        )
      })

      it("greaterThanOrEqualTo", async () => {
        const schema = Schema.Number.check(Check.greaterThanOrEqualTo(1))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed(1)
        await decoding.fail(
          0,
          `Expected a value greater than or equal to 1, got 0`
        )
      })

      it("lessThan", async () => {
        const schema = Schema.Number.check(Check.lessThan(1))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed(0)
        await decoding.fail(
          1,
          `Expected a value less than 1, got 1`
        )
      })

      it("lessThanOrEqualTo", async () => {
        const schema = Schema.Number.check(Check.lessThanOrEqualTo(1))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed(1)
        await decoding.fail(
          2,
          `Expected a value less than or equal to 1, got 2`
        )
      })

      it("multipleOf", async () => {
        const schema = Schema.Number.check(Check.multipleOf(2))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed(4)
        await decoding.fail(
          3,
          `Expected a value that is a multiple of 2, got 3`
        )
      })

      it("between", async () => {
        const schema = Schema.Number.check(Check.between(1, 3))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed(2)
        await decoding.fail(
          0,
          `Expected a value between 1 and 3, got 0`
        )

        const encoding = asserts.encoding()
        await encoding.succeed(2)
        await encoding.fail(
          0,
          `Expected a value between 1 and 3, got 0`
        )
      })

      it("int", async () => {
        const schema = Schema.Number.check(Check.int())
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed(1)
        await decoding.fail(
          1.1,
          `Expected an integer, got 1.1`
        )

        const encoding = asserts.encoding()
        await encoding.succeed(1)
        await encoding.fail(
          1.1,
          `Expected an integer, got 1.1`
        )
        await decoding.fail(
          NaN,
          `Expected an integer, got NaN`
        )
        await decoding.fail(
          Infinity,
          `Expected an integer, got Infinity`
        )
        await decoding.fail(
          -Infinity,
          `Expected an integer, got -Infinity`
        )
      })

      it("int32", async () => {
        const schema = Schema.Number.check(Check.int32())
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed(1)
        await decoding.fail(
          1.1,
          `Expected an integer, got 1.1`
        )
        await decoding.fail(
          Number.MAX_SAFE_INTEGER + 1,
          `Expected an integer, got 9007199254740992`
        )
        await decoding.fail(
          1.1,
          `Expected an integer, got 1.1`
        )
        await decoding.fail(
          Number.MIN_SAFE_INTEGER - 1,
          `Expected an integer, got -9007199254740992`
        )
        const decodingAll = asserts.decoding({ parseOptions: { errors: "all" } })
        await decodingAll.fail(
          Number.MAX_SAFE_INTEGER + 1,
          `Expected an integer, got 9007199254740992
Expected a value between -2147483648 and 2147483647, got 9007199254740992`
        )

        const encoding = asserts.encoding()
        await encoding.succeed(1)
        await encoding.fail(
          1.1,
          `Expected an integer, got 1.1`
        )
        await encoding.fail(
          Number.MAX_SAFE_INTEGER + 1,
          `Expected an integer, got 9007199254740992`
        )
      })
    })

    describe("BigInt Checks", () => {
      const options = { order: Order.bigint, format: (value: bigint) => `${value}n` }

      const between = Check.deriveBetween(options)
      const greaterThan = Check.deriveGreaterThan(options)
      const greaterThanOrEqualTo = Check.deriveGreaterThanOrEqualTo(options)
      const lessThan = Check.deriveLessThan(options)
      const lessThanOrEqualTo = Check.deriveLessThanOrEqualTo(options)

      it("between", async () => {
        const schema = Schema.BigInt.check(between(5n, 10n))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed(5n)
        await decoding.succeed(7n)
        await decoding.succeed(10n)
        await decoding.fail(
          4n,
          `Expected a value between 5n and 10n, got 4n`
        )
      })

      it("greaterThan", async () => {
        const schema = Schema.BigInt.check(greaterThan(5n))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed(6n)
        await decoding.fail(
          5n,
          `Expected a value greater than 5n, got 5n`
        )
      })

      it("greaterThanOrEqualTo", async () => {
        const schema = Schema.BigInt.check(greaterThanOrEqualTo(5n))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed(5n)
        await decoding.succeed(6n)
        await decoding.fail(
          4n,
          `Expected a value greater than or equal to 5n, got 4n`
        )
      })

      it("lessThan", async () => {
        const schema = Schema.BigInt.check(lessThan(5n))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed(4n)
        await decoding.fail(
          5n,
          `Expected a value less than 5n, got 5n`
        )
      })

      it("lessThanOrEqualTo", async () => {
        const schema = Schema.BigInt.check(lessThanOrEqualTo(5n))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed(5n)
        await decoding.succeed(4n)
        await decoding.fail(
          6n,
          `Expected a value less than or equal to 5n, got 6n`
        )
      })
    })

    describe("Record checks", () => {
      it("entries", async () => {
        const schema = Schema.Record(Schema.String, Schema.Number).check(Check.entries(2))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed({ a: 1, b: 2 })
        await decoding.succeed({ ["__proto__"]: 0, "": 0 })
        await decoding.fail(
          { a: 1 },
          `Expected an object with exactly 2 entries, got {"a":1}`
        )
        await decoding.fail(
          { a: 1, b: 2, c: 3 },
          `Expected an object with exactly 2 entries, got {"a":1,"b":2,"c":3}`
        )
      })
    })

    describe("Structural checks", () => {
      it("Array + minLength", async () => {
        const schema = Schema.Struct({
          tags: Schema.Array(Schema.NonEmptyString).check(Check.minLength(3))
        })
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.fail(
          {},
          `Missing key
  at ["tags"]`
        )
        const decodingAll = asserts.decoding({ parseOptions: { errors: "all" } })
        await decodingAll.fail(
          { tags: ["a", ""] },
          `Expected a value with a length of at least 1, got ""
  at ["tags"][1]
Expected a value with a length of at least 3, got ["a",""]
  at ["tags"]`
        )
      })

      it("Record + maxEntries", async () => {
        const schema = Schema.Record(Schema.String, Schema.Finite).check(Check.maxEntries(2))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.fail(
          null,
          `Expected object, got null`
        )
        const decodingAll = asserts.decoding({ parseOptions: { errors: "all" } })
        await decodingAll.fail(
          { a: 1, b: NaN, c: 3 },
          `Expected a finite number, got NaN
  at ["b"]
Expected an object with at most 2 entries, got {"a":1,"b":NaN,"c":3}`
        )
      })

      it("Map + maxSize", async () => {
        const schema = Schema.Map(Schema.String, Schema.Finite).check(Check.maxSize(2))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.fail(
          null,
          `Expected Map, got null`
        )
        const decodingAll = asserts.decoding({ parseOptions: { errors: "all" } })
        await decodingAll.fail(
          new Map([["a", 1], ["b", NaN], ["c", 3]]),
          `Expected a finite number, got NaN
  at ["entries"][1][1]
Expected a value with a size of at most 2, got Map([["a",1],["b",NaN],["c",3]])`
        )
      })
    })

    describe("Array checks", () => {
      it("UniqueArray", async () => {
        const schema = Schema.UniqueArray(Schema.Struct({
          a: Schema.String,
          b: Schema.String
        }))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed([{ a: "a", b: "b" }, { a: "c", b: "d" }])
        await decoding.fail(
          [{ a: "a", b: "b" }, { a: "a", b: "b" }],
          `Expected an array with unique items, got [{"a":"a","b":"b"},{"a":"a","b":"b"}]`
        )
      })
    })
  })

  describe("Transformations", () => {
    it("Finite", async () => {
      const schema = Schema.Finite
      const asserts = new TestSchema.Asserts(schema)
      if (verifyGeneration) {
        const arbitrary = asserts.arbitrary()
        arbitrary.verifyGeneration()
      }
    })

    it("FiniteFromString", async () => {
      const schema = Schema.FiniteFromString
      const asserts = new TestSchema.Asserts(schema)

      if (verifyGeneration) {
        const arbitrary = asserts.arbitrary()
        arbitrary.verifyGeneration()
      }

      const decoding = asserts.decoding()
      await decoding.succeed("1", 1)
      await decoding.fail(
        "a",
        `Expected a finite number, got NaN`
      )

      const encoding = asserts.encoding()
      await encoding.succeed(1, "1")
      await encoding.fail(
        "a",
        `Expected number, got "a"`
      )
    })

    it("NumberToString & greaterThan", async () => {
      const schema = Schema.FiniteFromString.check(Check.greaterThan(2))
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("3", 3)
      await decoding.fail(
        "1",
        `Expected a value greater than 2, got 1`
      )

      const encoding = asserts.encoding()
      await encoding.succeed(3, "3")
      await encoding.fail(
        1,
        `Expected a value greater than 2, got 1`
      )
    })
  })

  describe("decodeTo", () => {
    it("should expose the source and the target schemas", () => {
      const schema = Schema.FiniteFromString

      strictEqual(schema.from.ast._tag, "StringKeyword")
      strictEqual(schema.to, Schema.Finite)
    })

    it("required to required", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.decodeTo(
            Schema.String,
            Transformation.passthrough()
          )
        )
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "a" })
      await decoding.fail(
        {},
        `Missing key
  at ["a"]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed({ a: "a" })
      await encoding.fail(
        {},
        `Missing key
  at ["a"]`
      )
    })

    it("required to optional", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.decodeTo(
            Schema.optionalKey(Schema.String),
            {
              decode: Getter.required(),
              encode: Getter.withDefault(() => "default")
            }
          )
        )
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "a" })
      await decoding.fail(
        {},
        `Missing key
  at ["a"]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed({ a: "a" })
      await encoding.succeed({}, { a: "default" })
    })

    it("optionalKey to required", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.String).pipe(
          Schema.decodeTo(
            Schema.String,
            {
              decode: Getter.withDefault(() => "default"),
              encode: Getter.passthrough()
            }
          )
        )
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "a" })
      await decoding.succeed({}, { a: "default" })

      const encoding = asserts.encoding()
      await encoding.succeed({ a: "a" })
    })

    it("double transformation", async () => {
      const schema = Trim.pipe(Schema.decodeTo(
        Schema.FiniteFromString,
        Transformation.passthrough()
      ))
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed(" 2 ", 2)
      await decoding.fail(
        " a2 ",
        `Expected a finite number, got NaN`
      )

      const encoding = asserts.encoding()
      await encoding.succeed(2, "2")
    })

    it("double transformation with checks", async () => {
      const schema = Schema.Struct({
        a: Schema.String.check(Check.minLength(2)).pipe(
          Schema.decodeTo(
            Schema.String.check(Check.minLength(3)),
            Transformation.passthrough()
          ),
          Schema.decodeTo(
            Schema.String,
            Transformation.passthrough()
          )
        )
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "aaa" })
      await decoding.fail(
        { a: "aa" },
        `Expected a value with a length of at least 3, got "aa"
  at ["a"]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed({ a: "aaa" })
      await encoding.fail(
        { a: "aa" },
        `Expected a value with a length of at least 3, got "aa"
  at ["a"]`
      )
    })

    it("nested defaults", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.Struct({
          b: Schema.optionalKey(Schema.String)
        })).pipe(Schema.decodeTo(
          Schema.Struct({
            b: Schema.optionalKey(Schema.String).pipe(
              Schema.decodeTo(
                Schema.String,
                {
                  decode: Getter.withDefault(() => "default-b"),
                  encode: Getter.passthrough()
                }
              )
            )
          }),
          {
            decode: Getter.withDefault(() => ({})),
            encode: Getter.passthrough()
          }
        ))
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: { b: "b" } })
      await decoding.succeed({ a: {} }, { a: { b: "default-b" } })
      await decoding.succeed({}, { a: { b: "default-b" } })
    })
  })

  describe("decode", () => {
    it("double transformation", async () => {
      const schema = Schema.String.pipe(
        Schema.decode(
          Transformation.trim().compose(
            Transformation.toLowerCase()
          )
        )
      )
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed(" A ", "a")

      const encoding = asserts.encoding()
      await encoding.succeed(" A ", " A ")
    })
  })

  describe("encodeTo", () => {
    it("required to required", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.encodeTo(
            Schema.String,
            Transformation.passthrough()
          )
        )
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "a" })
      await decoding.fail(
        {},
        `Missing key
  at ["a"]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed({ a: "a" })
      await encoding.fail(
        {},
        `Missing key
  at ["a"]`
      )
    })

    it("required to optionalKey", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.encodeTo(
            Schema.optionalKey(Schema.String),
            {
              decode: Getter.withDefault(() => "default"),
              encode: Getter.passthrough()
            }
          )
        )
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "a" })
      await decoding.succeed({}, { a: "default" })

      const encoding = asserts.encoding()
      await encoding.succeed({ a: "a" })
    })

    it("optionalKey to required", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.String).pipe(
          Schema.encodeTo(
            Schema.String,
            {
              decode: Getter.required(),
              encode: Getter.withDefault(() => "default")
            }
          )
        )
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "a" })
      await decoding.fail(
        {},
        `Missing key
  at ["a"]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed({ a: "a" })
      await encoding.succeed({}, { a: "default" })
    })

    it("double transformation", async () => {
      const schema = Schema.FiniteFromString.pipe(Schema.encodeTo(
        Trim,
        Transformation.passthrough()
      ))
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed(" 2 ", 2)
      await decoding.fail(
        " a2 ",
        `Expected a finite number, got NaN`
      )

      const encoding = asserts.encoding()
      await encoding.succeed(2, "2")
    })

    it("double transformation with checks", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.encodeTo(
            Schema.String.check(Check.minLength(3)),
            Transformation.passthrough()
          ),
          Schema.encodeTo(
            Schema.String.check(Check.minLength(2)),
            Transformation.passthrough()
          )
        )
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "aaa" })
      await decoding.fail(
        { a: "aa" },
        `Expected a value with a length of at least 3, got "aa"
  at ["a"]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed({ a: "aaa" })
      await encoding.fail(
        { a: "aa" },
        `Expected a value with a length of at least 3, got "aa"
  at ["a"]`
      )
    })
  })

  describe("encode", () => {
    it("double transformation", async () => {
      const schema = Schema.String.pipe(
        Schema.encode(
          Transformation.trim().compose(
            Transformation.toLowerCase()
          ).flip()
        )
      )
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed(" A ", " A ")

      const encoding = asserts.encoding()
      await encoding.succeed(" A ", "a")
    })
  })

  describe("flip", () => {
    it("should expose the schema", () => {
      const schema = Schema.Struct({
        a: Schema.String
      })
      const flipped = schema.pipe(Schema.flip)
      strictEqual(flipped.schema, schema)
    })

    it("string & minLength(3) <-> number & greaterThan(2)", async () => {
      const schema = Schema.FiniteFromString.pipe(
        Schema.check(Check.greaterThan(2)),
        Schema.flip,
        Schema.check(Check.minLength(3))
      )
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.fail(
        2,
        `Expected a value greater than 2, got 2`
      )
      await decoding.fail(
        3,
        `Expected a value with a length of at least 3, got "3"`
      )

      const encoding = asserts.encoding()
      await encoding.succeed("123", 123)
    })

    it("should work with withConstructorDefault", async () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
      })
      const asserts = new TestSchema.Asserts(schema)

      const make = asserts.make()
      await make.succeed({ a: 1 })
      await make.succeed({}, { a: -1 })

      const flipped = schema.pipe(Schema.flip)
      const assertsFlipped = new TestSchema.Asserts(flipped)
      throws(() => flipped.makeUnsafe({} as any))
      const makeFlipped = assertsFlipped.make()
      await makeFlipped.succeed({ a: "1" })

      const flipped2 = flipped.pipe(Schema.flip)
      const assertsFlipped2 = new TestSchema.Asserts(flipped2)
      deepStrictEqual(flipped2.fields, schema.fields)
      const makeFlipped2 = assertsFlipped2.make()
      await makeFlipped2.succeed({ a: 1 })
      await makeFlipped2.succeed({}, { a: -1 })
    })
  })

  it("declareRefinement", async () => {
    const schema = Schema.declare(
      (u) => u instanceof File,
      { title: "File" }
    )
    const asserts = new TestSchema.Asserts(schema)

    const decoding = asserts.decoding()
    await decoding.succeed(new File([], "a.txt"))
    await decoding.fail("a", `Expected File, got "a"`)
  })

  describe("Redacted", () => {
    it("should expose the value", () => {
      const schema = Schema.Redacted(Schema.String)
      strictEqual(schema.value, Schema.String)
      strictEqual(schema.annotate({}).value, Schema.String)
    })

    it("Redacted(Finite)", async () => {
      const schema = Schema.Redacted(Schema.Finite)
      const asserts = new TestSchema.Asserts(schema)

      if (verifyGeneration) {
        const arbitrary = asserts.arbitrary()
        arbitrary.verifyGeneration()
      }

      const decoding = asserts.decoding()
      await decoding.succeed(Redacted.make(123))
      await decoding.fail(null, `Expected Redacted, got null`)
      await decoding.fail(
        Redacted.make("a"),
        `Invalid data <redacted>
  at ["value"]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed(Redacted.make(123))
      await encoding.fail(null, `Expected Redacted, got null`)
      await encoding.fail(
        Redacted.make("a"),
        `Invalid data <redacted>
  at ["value"]`
      )
    })

    it("with label", async () => {
      const schema = Schema.Redacted(Schema.String, { label: "password" })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed(Redacted.make("a", { label: "password" }))
      await decoding.fail(
        Redacted.make("a", { label: "API key" }),
        `Expected "password", got "API key"
  at ["label"]`
      )
      await decoding.fail(
        Redacted.make(1, { label: "API key" }),
        `Expected "password", got "API key"
  at ["label"]`
      )
      await decoding.fail(
        Redacted.make(1, { label: "password" }),
        `Invalid data <redacted:password>
  at ["value"]`
      )
    })
  })

  describe("Option", () => {
    it("should expose the value", () => {
      const schema = Schema.Option(Schema.String)
      strictEqual(schema.value, Schema.String)
      strictEqual(schema.annotate({}).value, Schema.String)
    })

    it("Option(FiniteFromString)", async () => {
      const schema = Schema.Option(Schema.FiniteFromString)
      const asserts = new TestSchema.Asserts(schema)

      if (verifyGeneration) {
        const arbitrary = asserts.arbitrary()
        arbitrary.verifyGeneration()
      }

      const decoding = asserts.decoding()
      await decoding.succeed(Option.none())
      await decoding.succeed(Option.some("123"), Option.some(123))
      await decoding.fail(null, `Expected Option, got null`)
      await decoding.fail(
        Option.some(null),
        `Expected string, got null
  at ["value"]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed(Option.none())
      await encoding.succeed(Option.some(123), Option.some("123"))
      await encoding.fail(null, `Expected Option, got null`)
      await encoding.fail(
        Option.some(null),
        `Expected number, got null
  at ["value"]`
      )
    })
  })

  it("OptionFromNullOr", async () => {
    const schema = Schema.OptionFromNullOr(Schema.FiniteFromString)
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }

    const decoding = asserts.decoding()
    await decoding.succeed(null, Option.none())
    await decoding.succeed("1", Option.some(1))
    await decoding.fail("a", `Expected a finite number, got NaN`)

    const encoding = asserts.encoding()
    await encoding.succeed(Option.none(), null)
    await encoding.succeed(Option.some(1), "1")
  })

  it("OptionFromOptionalKey", async () => {
    const schema = Schema.Struct({
      a: Schema.OptionFromOptionalKey(Schema.FiniteFromString)
    })
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }

    const decoding = asserts.decoding()
    await decoding.succeed({}, { a: Option.none() })
    await decoding.succeed({ a: "1" }, { a: Option.some(1) })
    await decoding.fail(
      { a: undefined },
      `Expected string, got undefined
  at ["a"]`
    )
    await decoding.fail(
      { a: "a" },
      `Expected a finite number, got NaN
  at ["a"]`
    )

    const encoding = asserts.encoding()
    await encoding.succeed({ a: Option.none() }, {})
    await encoding.succeed({ a: Option.some(1) }, { a: "1" })
  })

  it("OptionFromOptional", async () => {
    const schema = Schema.Struct({
      a: Schema.OptionFromOptional(Schema.FiniteFromString)
    })
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }

    const decoding = asserts.decoding()
    await decoding.succeed({}, { a: Option.none() })
    await decoding.succeed({ a: undefined }, { a: Option.none() })
    await decoding.succeed({ a: "1" }, { a: Option.some(1) })
    await decoding.fail(
      { a: "a" },
      `Expected a finite number, got NaN
  at ["a"]`
    )

    const encoding = asserts.encoding()
    await encoding.succeed({ a: Option.none() }, {})
    await encoding.succeed({ a: Option.some(1) }, { a: "1" })
  })

  describe("Result", () => {
    it("should expose the values", () => {
      const schema = Schema.Result(Schema.String, Schema.Number)
      strictEqual(schema.success, Schema.String)
      strictEqual(schema.annotate({}).success, Schema.String)
      strictEqual(schema.failure, Schema.Number)
      strictEqual(schema.annotate({}).failure, Schema.Number)
    })

    it("Result(FiniteFromString, FiniteFromString)", async () => {
      const schema = Schema.Result(Schema.FiniteFromString, Schema.FiniteFromString)
      const asserts = new TestSchema.Asserts(schema)

      if (verifyGeneration) {
        const arbitrary = asserts.arbitrary()
        arbitrary.verifyGeneration()
      }

      const decoding = asserts.decoding()
      await decoding.succeed(Result.succeed("1"), Result.succeed(1))
      await decoding.succeed(Result.fail("2"), Result.fail(2))
      await decoding.fail(null, `Expected Result, got null`)
      await decoding.fail(
        Result.succeed("a"),
        `Expected a finite number, got NaN
  at ["success"]`
      )
      await decoding.fail(
        Result.fail("b"),
        `Expected a finite number, got NaN
  at ["failure"]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed(Result.succeed(1), Result.succeed("1"))
      await encoding.succeed(Result.fail(2), Result.fail("2"))
    })
  })

  it("Defect", async () => {
    const schema = Schema.Defect
    const asserts = new TestSchema.Asserts(schema)

    const noPrototypeObject = Object.create(null)
    noPrototypeObject.message = "a"

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }

    const decoding = asserts.decoding()
    // Error: message only
    await decoding.succeed({ message: "a" }, new Error("a", { cause: { message: "a" } }))
    await decoding.succeed(noPrototypeObject, new Error("a", { cause: { message: "a" } }))
    // Error: message and name
    await decoding.succeed(
      { message: "a", name: "b" },
      (() => {
        const err = new Error("a", { cause: { message: "a", name: "b" } })
        err.name = "b"
        return err
      })()
    )
    // Error: message, name, and stack
    await decoding.succeed(
      { message: "a", name: "b", stack: "c" },
      (() => {
        const err = new Error("a", { cause: { message: "a", name: "b", stack: "c" } })
        err.name = "b"
        err.stack = "c"
        return err
      })()
    )
    // string
    await decoding.succeed("a", "a")

    const encoding = asserts.encoding()
    // Error
    await encoding.succeed(new Error("a"), { name: "Error", message: "a" })
    // string
    await encoding.succeed("a")
    // a value with a custom toString method
    await encoding.succeed({ toString: () => "a" }, "a")
    // anything else
    await encoding.succeed({ a: 1 }, `{"a":1}`)
    await encoding.succeed(noPrototypeObject, "a")
  })

  describe("CauseFailure", () => {
    it("should expose the values", () => {
      const schema = Schema.CauseFailure(Schema.String, Schema.Number)
      strictEqual(schema.error, Schema.String)
      strictEqual(schema.annotate({}).error, Schema.String)
      strictEqual(schema.defect, Schema.Number)
      strictEqual(schema.annotate({}).defect, Schema.Number)
    })

    it("CauseFailure(FiniteFromString, FiniteFromString)", async () => {
      const schema = Schema.CauseFailure(Schema.FiniteFromString, Schema.FiniteFromString)
      const asserts = new TestSchema.Asserts(schema)

      if (verifyGeneration) {
        const arbitrary = asserts.arbitrary()
        arbitrary.verifyGeneration()
      }
    })
  })

  describe("Cause", () => {
    it("should expose the values", () => {
      const schema = Schema.Cause(Schema.String, Schema.Number)
      strictEqual(schema.error, Schema.String)
      strictEqual(schema.annotate({}).error, Schema.String)
      strictEqual(schema.defect, Schema.Number)
      strictEqual(schema.annotate({}).defect, Schema.Number)
    })

    it("Cause(FiniteFromString, FiniteFromString)", async () => {
      const schema = Schema.Cause(Schema.FiniteFromString, Schema.FiniteFromString)
      const asserts = new TestSchema.Asserts(schema)

      if (verifyGeneration) {
        const arbitrary = asserts.arbitrary()
        arbitrary.verifyGeneration()
      }

      const decoding = asserts.decoding()
      await decoding.succeed(Cause.fail("1"), Cause.fail(1))
      await decoding.succeed(Cause.die("2"), Cause.die(2))
      await decoding.succeed(Cause.interrupt(3))

      await decoding.fail(
        Cause.fail("a"),
        `Expected a finite number, got NaN
  at ["failures"][0]["error"]`
      )
      await decoding.fail(
        Cause.die("a"),
        `Expected a finite number, got NaN
  at ["failures"][0]["defect"]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed(Cause.fail(1), Cause.fail("1"))
      await encoding.succeed(Cause.die(2), Cause.die("2"))
      await encoding.succeed(Cause.interrupt(3))

      await encoding.fail(
        Cause.fail("a"),
        `Expected number, got "a"
  at ["failures"][0]["error"]`
      )
      await encoding.fail(
        Cause.die("a"),
        `Expected number, got "a"
  at ["failures"][0]["defect"]`
      )
    })
  })

  it("Error", async () => {
    const schema = Schema.Error
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }
  })

  describe("Exit", () => {
    it("should expose the values", () => {
      const schema = Schema.Exit(Schema.String, Schema.Number, Schema.Boolean)
      strictEqual(schema.value, Schema.String)
      strictEqual(schema.annotate({}).value, Schema.String)
      strictEqual(schema.error, Schema.Number)
      strictEqual(schema.annotate({}).error, Schema.Number)
      strictEqual(schema.defect, Schema.Boolean)
      strictEqual(schema.annotate({}).defect, Schema.Boolean)
    })

    it("Exit(FiniteFromString, String, Unknown)", async () => {
      const schema = Schema.Exit(Schema.FiniteFromString, Schema.String, Schema.Unknown)
      const asserts = new TestSchema.Asserts(schema)

      if (verifyGeneration) {
        const arbitrary = asserts.arbitrary()
        arbitrary.verifyGeneration()
      }

      const decoding = asserts.decoding()
      await decoding.succeed(Exit.succeed("123"), Exit.succeed(123))
      await decoding.succeed(Exit.fail("boom"))
      await decoding.fail(
        null,
        `Expected Exit, got null`
      )
      await decoding.fail(
        Exit.succeed(123),
        `Expected string, got 123
  at ["value"]`
      )
      await decoding.fail(
        Exit.fail(null),
        `Expected string, got null
  at ["cause"]["failures"][0]["error"]`
      )
    })

    it("Exit(FiniteFromString, String, Defect)", async () => {
      const schema = Schema.Exit(Schema.FiniteFromString, Schema.String, Schema.Defect)
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      const boomError = new Error("boom message", {
        cause: {
          name: "boom",
          message: "boom message"
        }
      })
      boomError.name = "boom"

      await decoding.succeed(
        Exit.die({
          name: "boom",
          message: "boom message"
        }),
        Exit.die(boomError)
      )
    })
  })

  describe("suspend", () => {
    it("should work", async () => {
      interface Category<A, T> {
        readonly a: A
        readonly categories: ReadonlyArray<T>
      }
      interface CategoryType extends Category<number, CategoryType> {}
      interface CategoryEncoded extends Category<string, CategoryEncoded> {}

      const schema = Schema.Struct({
        a: Schema.FiniteFromString.check(Check.greaterThan(0)),
        categories: Schema.Array(Schema.suspend((): Schema.Codec<CategoryType, CategoryEncoded> => schema))
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "1", categories: [] }, { a: 1, categories: [] })
      await decoding.succeed({ a: "1", categories: [{ a: "2", categories: [] }] }, {
        a: 1,
        categories: [{ a: 2, categories: [] }]
      })
      await decoding.fail(
        {
          a: "1",
          categories: [{ a: "a", categories: [] }]
        },
        `Expected a finite number, got NaN
  at ["categories"][0]["a"]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed({ a: 1, categories: [] }, { a: "1", categories: [] })
      await encoding.succeed({ a: 1, categories: [{ a: 2, categories: [] }] }, {
        a: "1",
        categories: [{ a: "2", categories: [] }]
      })
      await encoding.fail(
        { a: 1, categories: [{ a: -1, categories: [] }] },
        `Expected a value greater than 0, got -1
  at ["categories"][0]["a"]`
      )
    })
  })

  describe("withConstructorDefault", () => {
    describe("Struct", () => {
      it("should not apply defaults when decoding / encoding", async () => {
        const schema = Schema.Struct({
          a: Schema.String.pipe(Schema.optionalKey, Schema.withConstructorDefault(() => Option.some("a")))
        })
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed({}, {})

        const encoding = asserts.encoding()
        await encoding.succeed({}, {})
      })

      it("should pass the input to the default value", async () => {
        const schema = Schema.Struct({
          a: Schema.String.pipe(
            Schema.UndefinedOr,
            Schema.withConstructorDefault((o) => {
              if (Option.isSome(o)) {
                return Option.some("undefined-default")
              }
              return Option.some("otherwise-default")
            })
          )
        })
        const asserts = new TestSchema.Asserts(schema)

        const make = asserts.make()

        await make.succeed({ a: "a" })
        await make.succeed({}, { a: "otherwise-default" })
        await make.succeed({ a: undefined }, { a: "undefined-default" })
      })

      it("Struct & Some", async () => {
        const schema = Schema.Struct({
          a: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
        })
        const asserts = new TestSchema.Asserts(schema)

        const make = asserts.make()
        await make.succeed({ a: 1 })
        await make.succeed({}, { a: -1 })
      })

      it("Struct & None", async () => {
        const schema = Schema.Struct({
          a: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.none()))
        })
        const asserts = new TestSchema.Asserts(schema)

        const make = asserts.make()
        await make.succeed({ a: 1 })
        await make.fail(
          {},
          `Missing key
  at ["a"]`
        )
        await make.fail(
          {},
          `Missing key
  at ["a"]`
        )
      })

      describe("nested defaults", () => {
        it("Struct", async () => {
          const schema = Schema.Struct({
            a: Schema.Struct({
              b: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
            }).pipe(Schema.withConstructorDefault(() => Option.some({})))
          })
          const asserts = new TestSchema.Asserts(schema)

          const make = asserts.make()
          await make.succeed({ a: { b: 1 } })
          await make.succeed({ a: {} }, { a: { b: -1 } })
          await make.succeed({}, { a: { b: -1 } })
        })

        it("Class", async () => {
          class A extends Schema.Class<A>("A")(Schema.Struct({
            a: Schema.Struct({
              b: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
            }).pipe(Schema.withConstructorDefault(() => Option.some({})))
          })) {}

          const asserts = new TestSchema.Asserts(A)

          const make = asserts.make()
          await make.succeed({ a: { b: 1 } }, new A({ a: { b: 1 } }))
          await make.succeed({ a: {} }, new A({ a: { b: -1 } }))
          await make.succeed({}, new A({ a: { b: -1 } }))

          deepStrictEqual(A.makeUnsafe({ a: { b: 1 } }), new A({ a: { b: 1 } }))
          deepStrictEqual(A.makeUnsafe({ a: {} }), new A({ a: { b: -1 } }))
          deepStrictEqual(A.makeUnsafe({}), new A({ a: { b: -1 } }))
        })
      })

      it("Struct & Effect sync", async () => {
        const schema = Schema.Struct({
          a: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Effect.succeed(Option.some(-1))))
        })
        const asserts = new TestSchema.Asserts(schema)

        const make = asserts.make()
        await make.succeed({ a: 1 })
        await make.succeed({}, { a: -1 })
      })

      it("Struct & Effect async", async () => {
        const schema = Schema.Struct({
          a: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() =>
            Effect.gen(function*() {
              yield* Effect.sleep(100)
              return Option.some(-1)
            })
          ))
        })
        const asserts = new TestSchema.Asserts(schema)

        const make = asserts.make()
        await make.succeed({ a: 1 })
        await make.succeed({}, { a: -1 })
      })

      it("Struct & Effect async & service", async () => {
        class Service extends ServiceMap.Key<Service, { value: Effect.Effect<number> }>()("Service") {}

        const schema = Schema.Struct({
          a: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() =>
            Effect.gen(function*() {
              yield* Effect.sleep(100)
              const oservice = yield* Effect.serviceOption(Service)
              if (Option.isNone(oservice)) {
                return Option.none()
              }
              return Option.some(yield* oservice.value.value)
            })
          ))
        })
        const asserts = new TestSchema.Asserts(schema)

        const make = asserts.make()

        await make.succeed({ a: 1 })
        await make.fail(
          {},
          `Missing key
  at ["a"]`
        )
        const effect = await ToParser.makeEffect(schema)({}).pipe(
          Effect.provideService(Service, { value: Effect.succeed(-1) }),
          Effect.result,
          Effect.runPromise
        )
        deepStrictEqual(effect, Result.succeed({ a: -1 }))
      })
    })

    describe("Tuple", () => {
      it("Tuple & Some", async () => {
        const schema = Schema.Tuple(
          [Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.some(-1)))]
        )
        const asserts = new TestSchema.Asserts(schema)

        const make = asserts.make()
        await make.succeed([1])
        await make.succeed([], [-1])
      })

      it("nested defaults (Struct)", async () => {
        const schema = Schema.Tuple(
          [
            Schema.Struct({
              b: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
            }).pipe(Schema.withConstructorDefault(() => Option.some({})))
          ]
        )
        const asserts = new TestSchema.Asserts(schema)

        const make = asserts.make()
        await make.succeed([{ b: 1 }])
        await make.succeed([{}], [{ b: -1 }])
        await make.succeed([], [{ b: -1 }])
      })

      it("inner defaults (Tuple)", async () => {
        const schema = Schema.Tuple(
          [
            Schema.Tuple([
              Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
            ])
          ]
        )
        const asserts = new TestSchema.Asserts(schema)

        const make = asserts.make()
        await make.succeed([[1]])
        await make.succeed([[]], [[-1]])
      })

      it("nested defaults (Tuple)", async () => {
        const schema = Schema.Tuple(
          [
            Schema.Tuple([
              Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
            ]).pipe(Schema.withConstructorDefault(() => Option.some([] as const)))
          ]
        )
        const asserts = new TestSchema.Asserts(schema)

        const make = asserts.make()
        await make.succeed([[1]])
        await make.succeed([[]], [[-1]])
        await make.succeed([], [[-1]])
      })
    })
  })

  describe("Record", () => {
    it("Record(String, Number)", async () => {
      const schema = Schema.Record(Schema.String, Schema.Number)
      const asserts = new TestSchema.Asserts(schema)

      const make = asserts.make()
      await make.succeed({ a: 1 })
      await make.fail(null, `Expected object, got null`)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: 1 })
      await decoding.fail(null, "Expected object, got null")
      await decoding.fail(
        { a: "b" },
        `Expected number, got "b"
  at ["a"]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed({ a: 1 })
      await encoding.fail(
        { a: "b" },
        `Expected number, got "b"
  at ["a"]`
      )
      await encoding.fail(null, "Expected object, got null")
    })

    it("Record(String, optionalKey(Number)) should throw", async () => {
      throws(
        () => Schema.Record(Schema.String, Schema.optionalKey(Schema.Number)),
        new Error("Cannot use `Schema.optionalKey` with index signatures, use `Schema.optional` instead.")
      )
    })

    it("Record(String, optional(Number))", async () => {
      const schema = Schema.Record(Schema.String, Schema.optional(Schema.Number))
      const asserts = new TestSchema.Asserts(schema)

      const make = asserts.make()
      await make.succeed({ a: 1 })
      await make.succeed({ a: undefined })
      await make.fail(null, `Expected object, got null`)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: 1 })
      await decoding.succeed({ a: undefined })

      const encoding = asserts.encoding()
      await encoding.succeed({ a: 1 })
      await encoding.succeed({ a: undefined })
    })

    it("Record(Symbol, Number)", async () => {
      const schema = Schema.Record(Schema.Symbol, Schema.Number)
      const asserts = new TestSchema.Asserts(schema)

      const make = asserts.make()
      await make.succeed({ [Symbol.for("a")]: 1 })
      await make.fail(null, `Expected object, got null`)

      const decoding = asserts.decoding()
      await decoding.succeed({ [Symbol.for("a")]: 1 })
      await decoding.fail(null, "Expected object, got null")
      await decoding.fail(
        { [Symbol.for("a")]: "b" },
        `Expected number, got "b"
  at [Symbol(a)]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed({ [Symbol.for("a")]: 1 })
      await encoding.fail(
        { [Symbol.for("a")]: "b" },
        `Expected number, got "b"
  at [Symbol(a)]`
      )
      await encoding.fail(null, "Expected object, got null")
    })

    it("Record(SnakeToCamel, NumberFromString)", async () => {
      const schema = Schema.Record(SnakeToCamel, NumberFromString)
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "1" }, { a: 1 })
      await decoding.succeed({ a_b: "1" }, { aB: 1 })
      await decoding.succeed({ a_b: "1", aB: "2" }, { aB: 2 })

      const encoding = asserts.encoding()
      await encoding.succeed({ a: 1 }, { a: "1" })
      await encoding.succeed({ aB: 1 }, { a_b: "1" })
      await encoding.succeed({ a_b: 1, aB: 2 }, { a_b: "2" })
    })

    it("Record(SnakeToCamel, Number, { keyValueCombiner: ... })", async () => {
      const schema = Schema.Record(SnakeToCamel, NumberFromString, {
        keyValueCombiner: {
          decode: {
            combine: ([_, v1], [k2, v2]) => [k2, v1 + v2]
          },
          encode: {
            combine: ([_, v1], [k2, v2]) => [k2, v1 + "e" + v2]
          }
        }
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "1" }, { a: 1 })
      await decoding.succeed({ a_b: "1" }, { aB: 1 })
      await decoding.succeed({ a_b: "1", aB: "2" }, { aB: 3 })

      const encoding = asserts.encoding()
      await encoding.succeed({ a: 1 }, { a: "1" })
      await encoding.succeed({ aB: 1 }, { a_b: "1" })
      await encoding.succeed({ a_b: 1, aB: 2 }, { a_b: "1e2" })
    })

    it("UniqueSymbol", async () => {
      const a = Symbol.for("a")
      const schema = Schema.Record(Schema.UniqueSymbol(a), Schema.Number)
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ [a]: 1 })
      await decoding.fail(
        { [a]: "b" },
        `Expected number, got "b"
  at [Symbol(a)]`
      )
    })

    describe("Literals keys", () => {
      it("Record(Literals, Number)", async () => {
        const schema = Schema.Record(Schema.Literals(["a", "b"]), Schema.Number)
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed({ a: 1, b: 2 })
        await decoding.fail(
          { a: 1 },
          `Missing key
  at ["b"]`
        )
        await decoding.fail(
          { b: 2 },
          `Missing key
  at ["a"]`
        )
      })

      it("Record(Literals, optionalKey(Number))", async () => {
        const schema = Schema.Record(Schema.Literals(["a", "b"]), Schema.optionalKey(Schema.Number))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed({})
        await decoding.succeed({ a: 1 })
        await decoding.succeed({ b: 2 })
        await decoding.succeed({ a: 1, b: 2 })
      })

      it("Record(Literals, mutableKey(Number))", async () => {
        const schema = Schema.Record(Schema.Literals(["a", "b"]), Schema.mutableKey(Schema.Number))
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed({ a: 1, b: 2 })
      })

      it("Record(Literals, mutableKey(optionalKey(Number)))", async () => {
        const schema = Schema.Record(
          Schema.Literals(["a", "b"]),
          Schema.mutableKey(Schema.optionalKey(Schema.Number))
        )
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.succeed({})
        await decoding.succeed({ a: 1 })
        await decoding.succeed({ b: 2 })
        await decoding.succeed({ a: 1, b: 2 })
      })
    })

    it("Record(Number, String)", async () => {
      const schema = Schema.Record(Schema.Number, Schema.FiniteFromString)
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ 1: "1", 2.2: "2", Infinity: "3", NaN: "4", "-Infinity": "5" }, {
        "1": 1,
        "2.2": 2,
        Infinity: 3,
        NaN: 4,
        "-Infinity": 5
      })
      await decoding.fail(
        { 1: null },
        `Expected string, got null
  at ["1"]`
      )
      await decoding.fail(
        { 1: "a" },
        `Expected a finite number, got NaN
  at ["1"]`
      )
    })

    it("Record(Int, String)", async () => {
      const schema = Schema.Record(Schema.Int, Schema.FiniteFromString)
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ 1: "1" }, { "1": 1 })
      await decoding.fail(
        { 1: null },
        `Expected string, got null
  at ["1"]`
      )
      await decoding.fail(
        { 1: "a" },
        `Expected a finite number, got NaN
  at ["1"]`
      )
      await decoding.fail(
        { Infinity: "1" },
        `Expected an integer, got Infinity
  at ["Infinity"]`
      )
      await decoding.fail(
        { NaN: "1" },
        `Expected an integer, got NaN
  at ["NaN"]`
      )
      await decoding.fail(
        { "-Infinity": "1" },
        `Expected an integer, got -Infinity
  at ["-Infinity"]`
      )
    })

    it("Record(Union(Number, string), FiniteFromString)", async () => {
      const schema = Schema.Record(Schema.Union([Schema.Number, Schema.Literal("a")]), Schema.FiniteFromString)
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed(
        { a: "-1", 1: "1", 2.2: "2", Infinity: "3", NaN: "4", "-Infinity": "5" },
        {
          a: -1,
          "1": 1,
          "2.2": 2,
          Infinity: 3,
          NaN: 4,
          "-Infinity": 5
        }
      )
    })
  })

  describe("Union", () => {
    it("empty", async () => {
      const schema = Schema.Union([])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.fail(null, `Expected never, got null`)
    })

    it(`String`, async () => {
      const schema = Schema.Union([Schema.String])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a")
      await decoding.fail(null, `Expected string, got null`)
    })

    it(`String | Number`, async () => {
      const schema = Schema.Union([Schema.String, Schema.Number])
      const asserts = new TestSchema.Asserts(schema)

      deepStrictEqual(schema.members, [Schema.String, Schema.Number])

      const decoding = asserts.decoding()
      await decoding.succeed("a")
      await decoding.succeed(1)
      await decoding.fail(
        null,
        `Expected string | number, got null`
      )
    })

    it(`String | Never`, async () => {
      const schema = Schema.Union([Schema.String, Schema.Never])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a")
      await decoding.fail(null, `Expected string | never, got null`)
    })

    it(`String & minLength(1) | number & greaterThan(0)`, async () => {
      const schema = Schema.Union([
        Schema.NonEmptyString,
        Schema.Number.check(Check.greaterThan(0))
      ])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a")
      await decoding.succeed(1)
      await decoding.fail(
        "",
        `Expected a value with a length of at least 1, got ""`
      )
      await decoding.fail(
        -1,
        `Expected a value greater than 0, got -1`
      )
    })

    it(`mode: "oneOf"`, async () => {
      const schema = Schema.Union([
        Schema.Struct({ a: Schema.String }),
        Schema.Struct({ b: Schema.Number })
      ], { mode: "oneOf" })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "a" })
      await decoding.succeed({ b: 1 })
      await decoding.fail(
        { a: "a", b: 1 },
        `Expected exactly one member to match the input {"a":"a","b":1}`
      )
    })

    it("{} & Literal", async () => {
      const schema = Schema.Union([
        Schema.Struct({}),
        Schema.Literal("a")
      ])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed([])
    })

    describe("should exclude members based on failed sentinels", () => {
      it("string | struct", async () => {
        const schema = Schema.Union([
          Schema.String,
          Schema.Struct({ _tag: Schema.Literal("a"), a: Schema.String })
        ])
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.fail(
          {},
          `Expected string | { _tag: "a", ... }, got {}`
        )
      })

      it("tagged union", async () => {
        const schema = Schema.Union([
          Schema.Struct({ _tag: Schema.Literal("a"), a: Schema.String }),
          Schema.Struct({ _tag: Schema.Literal("b"), b: Schema.Number })
        ])
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.fail(
          { _tag: "a" },
          `Missing key
  at ["a"]`
        )
        await decoding.fail(
          { _tag: "b" },
          `Missing key
  at ["b"]`
        )
        await decoding.fail(
          { _tag: "c" },
          `Expected { _tag: "a", ... } | { _tag: "b", ... }, got {"_tag":"c"}`
        )
      })
    })
  })

  describe("TupleWithRest", () => {
    it("A required element cannot follow an optional element", () => {
      throws(
        () =>
          Schema.TupleWithRest(
            Schema.Tuple([Schema.optionalKey(Schema.String)]),
            [Schema.Boolean, Schema.String]
          ),
        new Error("A required element cannot follow an optional element. ts(1257)")
      )
      throws(
        () =>
          Schema.TupleWithRest(
            Schema.Tuple([Schema.optional(Schema.String)]),
            [Schema.Boolean, Schema.String]
          ),
        new Error("A required element cannot follow an optional element. ts(1257)")
      )
    })

    it("An optional element cannot follow a rest element", () => {
      throws(
        () =>
          Schema.TupleWithRest(
            Schema.Tuple([]),
            [Schema.Boolean, Schema.optionalKey(Schema.String)]
          ),
        new Error("An optional element cannot follow a rest element. ts(1266)")
      )
      throws(
        () =>
          Schema.TupleWithRest(
            Schema.Tuple([]),
            [Schema.Boolean, Schema.optional(Schema.String)]
          ),
        new Error("An optional element cannot follow a rest element. ts(1266)")
      )
    })

    it("[FiniteFromString, String] + [Boolean, String]", async () => {
      const schema = Schema.TupleWithRest(
        Schema.Tuple([Schema.FiniteFromString, Schema.String]),
        [Schema.Boolean, Schema.String]
      )
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed(["1", "a", true, "b"], [1, "a", true, "b"])
    })
  })

  describe("StructWithRest", () => {
    it("should throw an error if there are duplicate index signatures", () => {
      throws(
        () =>
          Schema.StructWithRest(
            Schema.Struct({}),
            [
              Schema.Record(Schema.String, Schema.Number),
              Schema.Record(Schema.Symbol, Schema.Number),
              Schema.Record(Schema.TemplateLiteral(["a", Schema.String]), Schema.Number),
              Schema.Record(Schema.TemplateLiteral(["b", Schema.String]), Schema.Number),
              Schema.Record(Schema.String, Schema.Number),
              Schema.Record(Schema.TemplateLiteral(["a", Schema.String]), Schema.Number)
            ]
          ),
        new Error(`Duplicate index signatures: ["StringKeyword","a\${StringKeyword}"]. ts(2374)`)
      )
    })

    it("should throw an error if there are encodings", () => {
      throws(
        () =>
          Schema.StructWithRest(
            Schema.Struct({}).pipe(Schema.encodeTo(Schema.String)),
            [Schema.Record(Schema.String, Schema.Number)]
          ),
        new Error(`StructWithRest does not support encodings`)
      )
    })

    it("Record(String, Number)", async () => {
      const schema = Schema.StructWithRest(
        Schema.Struct({ a: Schema.Number }),
        [Schema.Record(Schema.String, Schema.Number)]
      )
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: 1 })
      await decoding.succeed({ a: 1, b: 2 })
      await decoding.fail(
        { a: 1, b: "" },
        `Expected number, got ""
  at ["b"]`
      )
    })

    it("Record(Symbol, Number)", async () => {
      const schema = Schema.StructWithRest(
        Schema.Struct({ a: Schema.Number }),
        [Schema.Record(Schema.Symbol, Schema.Number)]
      )
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: 1 })
      await decoding.succeed({ a: 1, [Symbol.for("b")]: 2 })
      await decoding.fail(
        { a: 1, [Symbol.for("b")]: "c" },
        `Expected number, got "c"
  at [Symbol(b)]`
      )
    })

    it("Record(`a${string}`, Number)", async () => {
      const schema = Schema.StructWithRest(
        Schema.Struct({ a: Schema.Number }),
        [Schema.Record(Schema.TemplateLiteral(["a", Schema.String]), Schema.Finite)]
      )
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: 1 })
      await decoding.succeed({ a: 1, "ab": 2 })
      await decoding.fail(
        { a: NaN, "ab": 2 },
        `Expected a finite number, got NaN
  at ["a"]`
      )
      await decoding.fail(
        { a: 1, "ab": "c" },
        `Expected number, got "c"
  at ["ab"]`
      )
    })

    it("should preserve both checks", async () => {
      const schema = Schema.StructWithRest(
        Schema.Struct({ a: Schema.Number }).check(
          Check.make((s) => s.a > 0, { title: "agt(0)" })
        ),
        [
          Schema.Record(Schema.String, Schema.Number).check(
            Check.make((s) => s.b === undefined || s.b > 1, { title: "bgt(1)" })
          )
        ]
      )
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: 1 })
      await decoding.succeed({ a: 1, b: 2 })
      await decoding.fail(
        { a: 0 },
        `Expected agt(0), got {"a":0}`
      )
      await decoding.fail(
        { a: 1, b: 1 },
        `Expected bgt(1), got {"a":1,"b":1}`
      )
    })
  })

  describe("NullOr", () => {
    it("NullOr(String)", async () => {
      const schema = Schema.NullOr(Schema.NonEmptyString)
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a")
      await decoding.succeed(null)
      await decoding.fail(undefined, `Expected string | null, got undefined`)
      await decoding.fail(
        "",
        `Expected a value with a length of at least 1, got ""`
      )
    })
  })

  describe("UndefinedOr", () => {
    it("UndefinedOr(String)", async () => {
      const schema = Schema.UndefinedOr(Schema.NonEmptyString)
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a")
      await decoding.succeed(undefined)
      await decoding.fail(null, `Expected string | undefined, got null`)
      await decoding.fail(
        "",
        `Expected a value with a length of at least 1, got ""`
      )
    })
  })

  describe("NullishOr", () => {
    it("NullishOr(String)", async () => {
      const schema = Schema.NullishOr(Schema.NonEmptyString)
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a")
      await decoding.succeed(null)
      await decoding.succeed(undefined)
      await decoding.fail(
        "",
        `Expected a value with a length of at least 1, got ""`
      )
    })
  })

  it("PropertyKey", async () => {
    const schema = Schema.PropertyKey
    const asserts = new TestSchema.Asserts(schema)
    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }
  })

  it("BooleanFromBit", async () => {
    const schema = Schema.BooleanFromBit
    const asserts = new TestSchema.Asserts(schema)
    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }
  })

  it("Uint8Array", async () => {
    const schema = Schema.Uint8Array
    const asserts = new TestSchema.Asserts(schema)
    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }
  })

  it("Date", async () => {
    const schema = Schema.Date
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }

    const decoding = asserts.decoding()
    await decoding.succeed(new Date("2021-01-01"))
    await decoding.fail(null, `Expected Date, got null`)
    await decoding.fail(0, `Expected Date, got 0`)
  })

  it("ValidDate", async () => {
    const schema = Schema.ValidDate
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }
  })

  it("DateTimeUtc", async () => {
    const schema = Schema.DateTimeUtc
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }

    const decoding = asserts.decoding()
    await decoding.succeed(DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"))

    const encoding = asserts.encoding()
    await encoding.succeed(DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"))
  })

  it("DateTimeUtcFromValidDate", async () => {
    const schema = Schema.DateTimeUtcFromDate
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }

    const decoding = asserts.decoding()
    await decoding.succeed(new Date("2021-01-01T00:00:00.000Z"), DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"))
    await decoding.fail(new Date("invalid date"), `Expected a valid date, got Invalid Date`)

    const encoding = asserts.encoding()
    await encoding.succeed(DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"), new Date("2021-01-01T00:00:00.000Z"))
  })

  it("DateTimeUtcFromString", async () => {
    const schema = Schema.DateTimeUtcFromString
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }

    const decoding = asserts.decoding()
    await decoding.succeed("2021-01-01T00:00:00.000Z", DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"))
    await decoding.fail(null, `Expected string, got null`)

    const encoding = asserts.encoding()
    await encoding.succeed(DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"), "2021-01-01T00:00:00.000Z")
  })

  it("DateTimeUtcFromMillis", async () => {
    const schema = Schema.DateTimeUtcFromMillis
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }

    const decoding = asserts.decoding()
    await decoding.succeed(1609459200000, DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"))
    await decoding.fail(null, `Expected number, got null`)

    const encoding = asserts.encoding()
    await encoding.succeed(DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"), 1609459200000)
  })

  it("Map", async () => {
    const schema = Schema.Map(Schema.String, Schema.Number)
    const asserts = new TestSchema.Asserts(schema)

    strictEqual(schema.key, Schema.String)
    strictEqual(schema.annotate({}).key, Schema.String)
    strictEqual(schema.value, Schema.Number)
    strictEqual(schema.annotate({}).value, Schema.Number)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }

    const decoding = asserts.decoding()
    await decoding.succeed(new Map([["a", 1]]))
    await decoding.fail(null, `Expected Map, got null`)
    await decoding.fail(
      new Map([["a", "b"]]),
      `Expected number, got "b"
  at ["entries"][0][1]`
    )

    const encoding = asserts.encoding()
    await encoding.succeed(new Map([["a", 1]]))
  })

  describe("Transformations", () => {
    it("toLowerCase", async () => {
      const schema = Schema.String.pipe(
        Schema.decodeTo(
          Schema.String,
          Transformation.toLowerCase()
        )
      )
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("A", "a")
      await decoding.succeed("B", "b")
    })

    it("toUpperCase", async () => {
      const schema = Schema.String.pipe(
        Schema.decodeTo(Schema.String, Transformation.toUpperCase())
      )
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a", "A")
      await decoding.succeed("b", "B")
    })
  })

  describe("Opaque", () => {
    it("Struct", () => {
      class A extends Schema.Opaque<A>()(Schema.Struct({ a: Schema.String })) {}

      const schema = A

      const instance = schema.makeUnsafe({ a: "a" })
      strictEqual(instance.a, "a")
      deepStrictEqual(A.fields, { a: Schema.String })
    })
  })

  describe("instanceOf", () => {
    it("arg: message: string", async () => {
      class MyError extends Error {
        constructor(message?: string) {
          super(message)
          this.name = "MyError"
          Object.setPrototypeOf(this, MyError.prototype)
        }
      }

      const schema = Schema.instanceOf(
        MyError,
        {
          title: "MyError",
          defaultIsoSerializer: () =>
            Schema.link<MyError>()(
              Schema.String,
              Transformation.transform({
                decode: (message) => new MyError(message),
                encode: (e) => e.message
              })
            )
        }
      )
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed(new MyError("a"))
      await decoding.fail(null, `Expected MyError, got null`)

      const encoding = asserts.encoding()
      await encoding.succeed(new MyError("a"))
      await encoding.fail(null, `Expected MyError, got null`)
    })
  })

  it("Duration", async () => {
    const schema = Schema.Duration
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }
  })

  describe("tag", () => {
    it("decoding: required & encoding: required & constructor: required", async () => {
      const schema = Schema.Struct({
        _tag: Schema.Literal("a"),
        a: Schema.FiniteFromString
      })
      const asserts = new TestSchema.Asserts(schema)

      const make = asserts.make()
      await make.succeed({ _tag: "a", a: 1 })

      const decoding = asserts.decoding()
      await decoding.succeed({ _tag: "a", a: "1" }, { _tag: "a", a: 1 })

      const encoding = asserts.encoding()
      await encoding.succeed({ _tag: "a", a: 1 }, { _tag: "a", a: "1" })
    })

    it("decoding: required & encoding: required & constructor: optional", async () => {
      const schema = Schema.Struct({
        _tag: Schema.tag("a"),
        a: Schema.FiniteFromString
      })
      const asserts = new TestSchema.Asserts(schema)

      const make = asserts.make()
      await make.succeed({ _tag: "a", a: 1 })
      await make.succeed({ a: 1 }, { _tag: "a", a: 1 })

      const decoding = asserts.decoding()
      await decoding.succeed({ _tag: "a", a: "1" }, { _tag: "a", a: 1 })

      const encoding = asserts.encoding()
      await encoding.succeed({ _tag: "a", a: 1 }, { _tag: "a", a: "1" })
    })

    it("decoding: default & encoding: omit & constructor: optional", async () => {
      const schema = Schema.Struct({
        _tag: Schema.tag("a").pipe(
          Schema.encodeTo(
            Schema.optionalKey(Schema.Literal("a")),
            {
              decode: Getter.withDefault(() => "a" as const),
              encode: Getter.omit()
            }
          )
        ),
        a: Schema.FiniteFromString
      })
      const asserts = new TestSchema.Asserts(schema)

      const make = asserts.make()
      await make.succeed({ _tag: "a", a: 1 })
      await make.succeed({ a: 1 }, { _tag: "a", a: 1 })

      const decoding = asserts.decoding()
      await decoding.succeed({ _tag: "a", a: "1" }, { _tag: "a", a: 1 })
      await decoding.succeed({ a: "1" }, { _tag: "a", a: 1 })

      const encoding = asserts.encoding()
      await encoding.succeed({ _tag: "a", a: 1 }, { a: "1" })
    })
  })

  it("URL", async () => {
    const schema = Schema.URL
    const asserts = new TestSchema.Asserts(schema)
    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }
  })

  describe("UnknownFromJsonString / fromJsonString", () => {
    it("use case: Unknown <-> JSON string", async () => {
      const schema = Schema.UnknownFromJsonString
      const asserts = new TestSchema.Asserts(schema)

      if (verifyGeneration) {
        const arbitrary = asserts.arbitrary()
        arbitrary.verifyGeneration()
      }

      const decoding = asserts.decoding()
      await decoding.succeed(`{"a":1}`, { a: 1 })
      await decoding.fail(
        `{"a"`,
        "SyntaxError: Expected ':' after property name in JSON at position 4 (line 1 column 5)"
      )

      const encoding = asserts.encoding()
      await encoding.succeed({ a: 1 }, `{"a":1}`)
    })

    it("use case: create a JSON string serializer for an existing schema", async () => {
      const struct = Schema.Struct({ b: Schema.Number })
      const schema = Schema.fromJsonString(struct)
      const asserts = new TestSchema.Asserts(schema)

      if (verifyGeneration) {
        const arbitrary = asserts.arbitrary()
        arbitrary.verifyGeneration()
      }

      const decoding = asserts.decoding()
      await decoding.succeed(`{"b":1}`, { b: 1 })
      await decoding.fail(
        `{"a":null}`,
        `Missing key
  at ["b"]`
      )
    })

    it("use case: parse / stringify a nested schema", async () => {
      const schema = Schema.Struct({
        a: Schema.fromJsonString(Schema.Struct({ b: Schema.Number }))
      })
      const asserts = new TestSchema.Asserts(schema)

      if (verifyGeneration) {
        const arbitrary = asserts.arbitrary()
        arbitrary.verifyGeneration()
      }

      const decoding = asserts.decoding()
      await decoding.succeed({ a: `{"b":2}` }, { a: { b: 2 } })
      await decoding.fail(
        { a: `{"a":null}` },
        `Missing key
  at ["a"]["b"]`
      )
    })
  })

  it("Trim", async () => {
    const schema = Schema.Trim
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }

    const decoding = asserts.decoding()
    await decoding.succeed("a")
    await decoding.succeed("a ", "a")
    await decoding.succeed(" a", "a")
    await decoding.succeed(" a ", "a")
    await decoding.succeed("a\n", "a")

    const encoding = asserts.encoding()
    await encoding.succeed("a")
    await encoding.fail(
      "a ",
      `Expected a string with no leading or trailing whitespace, got "a "`
    )
  })

  it("transformOrFail", async () => {
    const schema = Schema.String.pipe(
      Schema.decodeTo(
        Schema.String,
        Transformation.transformOrFail({
          decode: (s) =>
            s === "a"
              ? Effect.fail(new Issue.Forbidden(Option.some(s), { message: `input should not be "a"` }))
              : Effect.succeed(s),
          encode: (s) =>
            s === "b"
              ? Effect.fail(new Issue.Forbidden(Option.some(s), { message: `input should not be "b"` }))
              : Effect.succeed(s)
        })
      )
    )
    const asserts = new TestSchema.Asserts(schema)

    const decoding = asserts.decoding()
    await decoding.succeed("b")
    await decoding.fail(
      "a",
      `input should not be "a"`
    )

    const encoding = asserts.encoding()
    await encoding.succeed("a")
    await encoding.fail(
      "b",
      `input should not be "b"`
    )
  })

  describe("TemplateLiteral", () => {
    it("should expose the parts", () => {
      const parts = ["a", Schema.String] as const
      const schema = Schema.TemplateLiteral(parts)
      deepStrictEqual(schema.parts, parts)
    })

    it("getTemplateLiteralRegExp", () => {
      const assertSource = (
        parts: Schema.TemplateLiteral.Parts,
        source: string
      ) => {
        strictEqual(AST.getTemplateLiteralRegExp(Schema.TemplateLiteral(parts).ast).source, source)
      }

      assertSource(["a"], "^(a)$")
      assertSource(["a", "b"], "^(a)(b)$")
      assertSource([Schema.Literals(["a", "b"]), "c"], "^(a|b)(c)$")
      assertSource(
        [Schema.Literals(["a", "b"]), "c", Schema.Literals(["d", "e"])],
        "^(a|b)(c)(d|e)$"
      )
      assertSource(
        [Schema.Literals(["a", "b"]), Schema.String, Schema.Literals(["d", "e"])],
        "^(a|b)([\\s\\S]*?)(d|e)$"
      )
      assertSource(["a", Schema.String], "^(a)([\\s\\S]*?)$")
      assertSource(["a", Schema.String, "b"], "^(a)([\\s\\S]*?)(b)$")
      assertSource(
        ["a", Schema.String, "b", Schema.Number],
        "^(a)([\\s\\S]*?)(b)([+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?)$"
      )
      assertSource(["a", Schema.Number], "^(a)([+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?)$")
      assertSource([Schema.String, "a"], "^([\\s\\S]*?)(a)$")
      assertSource([Schema.Number, "a"], "^([+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?)(a)$")
      assertSource(
        [Schema.Union([Schema.String, Schema.Literal(1)]), Schema.Union([Schema.Number, Schema.Literal("true")])],
        "^([\\s\\S]*?|1)([+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?|true)$"
      )
      assertSource(
        [Schema.Union([Schema.Literals(["a", "b"]), Schema.Literals([1, 2])])],
        "^(a|b|1|2)$"
      )
      assertSource(
        ["c", Schema.Union([Schema.TemplateLiteral(["a", Schema.String, "b"]), Schema.Literal("e")]), "d"],
        "^(c)(a[\\s\\S]*?b|e)(d)$"
      )
      assertSource(
        ["<", Schema.TemplateLiteral(["h", Schema.Literals([1, 2])]), ">"],
        "^(<)(h(?:1|2))(>)$"
      )
      assertSource(
        [
          "-",
          Schema.Union([
            Schema.TemplateLiteral(["a", Schema.Literals(["b", "c"])]),
            Schema.TemplateLiteral(["d", Schema.Literals(["e", "f"])])
          ])
        ],
        "^(-)(a(?:b|c)|d(?:e|f))$"
      )
    })

    it(`"a"`, async () => {
      const schema = Schema.TemplateLiteral(["a"])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a")
      await decoding.fail(null, "Expected `a`, got null")
      await decoding.fail(
        "ab",
        "Expected `a`, got \"ab\""
      )
      await decoding.fail(
        "",
        "Expected `a`, got \"\""
      )
    })

    it(`"a b"`, async () => {
      const schema = Schema.TemplateLiteral(["a", " ", "b"])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a b")

      await decoding.fail(
        "a  b",
        "Expected `a b`, got \"a  b\""
      )
    })

    it(`"[" + string + "]"`, async () => {
      const schema = Schema.TemplateLiteral(["[", Schema.String, "]"])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("[a]")

      await decoding.fail(
        "a",
        "Expected `[${string}]`, got \"a\""
      )
    })

    it(`"a" + string`, async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.String])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a")
      await decoding.succeed("ab")

      await decoding.fail(
        null,
        "Expected `a${string}`, got null"
      )
      await decoding.fail(
        "",
        "Expected `a${string}`, got \"\""
      )
    })

    it(`"a" + number`, async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.Number])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a1")
      await decoding.succeed("a+1")
      await decoding.succeed("a1.2")

      await decoding.succeed("a-1.401298464324817e-45")
      await decoding.succeed("a1.401298464324817e-45")
      await decoding.succeed("a+1.401298464324817e-45")
      await decoding.succeed("a-1.401298464324817e+45")
      await decoding.succeed("a1.401298464324817e+45")
      await decoding.succeed("a+1.401298464324817e+45")

      await decoding.succeed("a-1.401298464324817E-45")
      await decoding.succeed("a1.401298464324817E-45")
      await decoding.succeed("a+1.401298464324817E-45")
      await decoding.succeed("a-1.401298464324817E+45")
      await decoding.succeed("a1.401298464324817E+45")
      await decoding.succeed("a+1.401298464324817E+45")

      await decoding.fail(
        null,
        "Expected `a${number}`, got null"
      )
      await decoding.fail(
        "",
        "Expected `a${number}`, got \"\""
      )
      await decoding.fail(
        "aa",
        "Expected `a${number}`, got \"aa\""
      )
    })

    it(`"a" + bigint`, async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.BigInt])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a0")
      await decoding.succeed("a1")
      await decoding.succeed("a-1")

      await decoding.fail(
        null,
        "Expected `a${bigint}`, got null"
      )
      await decoding.fail(
        "",
        "Expected `a${bigint}`, got \"\""
      )
      await decoding.fail(
        "aa",
        "Expected `a${bigint}`, got \"aa\""
      )
      await decoding.fail(
        "a1.2",
        "Expected `a${bigint}`, got \"a1.2\""
      )
      await decoding.fail(
        "a+1",
        "Expected `a${bigint}`, got \"a+1\""
      )
    })

    it(`string`, async () => {
      const schema = Schema.TemplateLiteral([Schema.String])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a")
      await decoding.succeed("ab")
      await decoding.succeed("")
      await decoding.succeed("\n")
      await decoding.succeed("\r")
      await decoding.succeed("\r\n")
      await decoding.succeed("\t")
    })

    it(`\\n + string`, async () => {
      const schema = Schema.TemplateLiteral(["\n", Schema.String])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("\n")
      await decoding.succeed("\na")
      await decoding.fail(
        "a",
        "Expected `\n${string}`, got \"a\""
      )
    })

    it(`a\\nb  + string`, async () => {
      const schema = Schema.TemplateLiteral(["a\nb ", Schema.String])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a\nb ")
      await decoding.succeed("a\nb c")
    })

    it(`"a" + string + "b"`, async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.String, "b"])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("ab")
      await decoding.succeed("acb")
      await decoding.succeed("abb")
      await decoding.fail(
        "",
        "Expected `a${string}b`, got \"\""
      )
      await decoding.fail(
        "a",
        "Expected `a${string}b`, got \"a\""
      )
      await decoding.fail(
        "b",
        "Expected `a${string}b`, got \"b\""
      )

      const encoding = asserts.encoding()
      await encoding.succeed("acb")
    })

    it(`"a" + string + "b" + string`, async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.String, "b", Schema.String])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("ab")
      await decoding.succeed("acb")
      await decoding.succeed("acbd")
      await decoding.fail(
        "a",
        "Expected `a${string}b${string}`, got \"a\""
      )
      await decoding.fail(
        "b",
        "Expected `a${string}b${string}`, got \"b\""
      )
    })

    it("https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html", async () => {
      const EmailLocaleIDs = Schema.Literals(["welcome_email", "email_heading"])
      const FooterLocaleIDs = Schema.Literals(["footer_title", "footer_sendoff"])
      const schema = Schema.TemplateLiteral([Schema.Union([EmailLocaleIDs, FooterLocaleIDs]), "_id"])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("welcome_email_id")
      await decoding.succeed("email_heading_id")
      await decoding.succeed("footer_title_id")
      await decoding.succeed("footer_sendoff_id")

      await decoding.fail(
        "_id",
        "Expected `${\"welcome_email\" | \"email_heading\" | \"footer_title\" | \"footer_sendoff\"}_id`, got \"_id\""
      )
    })

    it(`string + 0`, async () => {
      const schema = Schema.TemplateLiteral([Schema.String, 0])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a0")
      await decoding.fail(
        "a",
        "Expected `${string}0`, got \"a\""
      )
    })

    it(`string + 1n`, async () => {
      const schema = Schema.TemplateLiteral([Schema.String, 1n])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a1")
      await decoding.fail(
        "a",
        "Expected `${string}1`, got \"a\""
      )
    })

    it(`string + ("a" | 0)`, async () => {
      const schema = Schema.TemplateLiteral([Schema.String, Schema.Literals(["a", 0])])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a0")
      await decoding.succeed("aa")
      await decoding.fail(
        "b",
        "Expected `${string}${\"a\" | 0}`, got \"b\""
      )
    })

    it(`(string | 1) + (number | true)`, async () => {
      const schema = Schema.TemplateLiteral([
        Schema.Union([Schema.String, Schema.Literal(1)]),
        Schema.Union([Schema.Number, Schema.Literal("true")])
      ])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("atrue")
      await decoding.succeed("-2")
      await decoding.succeed("10.1")
      await decoding.fail(
        "",
        "Expected `${string | 1}${number | \"true\"}`, got \"\""
      )
    })

    it("`c${`a${string}b` | \"e\"}d`", async () => {
      const schema = Schema.TemplateLiteral(
        ["c", Schema.Union([Schema.TemplateLiteral(["a", Schema.String, "b"]), Schema.Literal("e")]), "d"]
      )
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("ced")
      await decoding.succeed("cabd")
      await decoding.succeed("casbd")
      await decoding.succeed("ca  bd")
      await decoding.fail(
        "",
        "Expected `c${`a${string}b` | \"e\"}d`, got \"\""
      )
    })

    it("< + h + (1|2) + >", async () => {
      const schema = Schema.TemplateLiteral(["<", Schema.TemplateLiteral(["h", Schema.Literals([1, 2n])]), ">"])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("<h1>")
      await decoding.succeed("<h2>")
      await decoding.fail(
        "<h3>",
        "Expected `<${`h${1 | 2}`}>`, got \"<h3>\""
      )
    })

    it(`"a" + check`, async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.NonEmptyString])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("ab")
      await decoding.fail(
        null,
        "Expected `a${string}`, got null"
      )
      await decoding.fail(
        "",
        "Expected `a${string}`, got \"\""
      )
      await decoding.fail(
        "a",
        "Expected `a${string}`, got \"a\""
      )
    })

    it(`"a" + transformation`, async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.FiniteFromString])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a")
      await decoding.succeed("a1")

      await decoding.fail(
        null,
        "Expected `a${string}`, got null"
      )
      await decoding.fail(
        "",
        "Expected `a${string}`, got \"\""
      )
      await decoding.fail(
        "ab",
        "Expected `a${string}`, got \"ab\""
      )
    })
  })

  describe("TemplateLiteralParser", () => {
    it("should expose the parts", () => {
      const parts = ["a", Schema.String] as const
      const schema = Schema.TemplateLiteralParser(parts)
      deepStrictEqual(schema.parts, parts)
    })

    it(`"a"`, async () => {
      const schema = Schema.TemplateLiteralParser(["a"])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a", ["a"])
      await decoding.fail(
        "ab",
        `Missing key
  at [0]`
      )
      await decoding.fail(
        "",
        `Missing key
  at [0]`
      )
      await decoding.fail(
        null,
        "Expected string, got null"
      )
    })

    it(`"a b"`, async () => {
      const schema = Schema.TemplateLiteralParser(["a", " ", "b"])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a b", ["a", " ", "b"])

      await decoding.fail(
        "a  b",
        `Missing key
  at [0]`
      )
    })

    it(`Int + "a"`, async () => {
      const schema = Schema.TemplateLiteralParser([Schema.Int, "a"])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("1a", [1, "a"])
      await decoding.fail(
        "1.1a",
        `Expected an integer, got 1.1
  at [0]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed([1, "a"], "1a")
      await encoding.fail(
        [1.1, "a"],
        `Expected an integer, got 1.1
  at [0]`
      )
    })

    it(`NumberFromString + "a" + NonEmptyString`, async () => {
      const schema = Schema.TemplateLiteralParser([Schema.FiniteFromString, "a", Schema.NonEmptyString])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("100ab", [100, "a", "b"])
      await decoding.succeed("100ab23a", [100, "a", "b23a"])
      await decoding.fail(
        "-ab",
        `Expected a finite number, got NaN
  at [0]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed([100, "a", "b"], "100ab")
      await encoding.fail(
        [100, "a", ""],
        `Expected a value with a length of at least 1, got ""
  at [2]`
      )
    })

    it(`"h" + (1 | 2 | 3)`, async () => {
      const schema = Schema.TemplateLiteralParser(["h", Schema.Literals([1, 2, 3])])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("h1", ["h", 1])
    })

    it(`"c" + (\`a\${string}b\`|"e") + "d"`, async () => {
      const schema = Schema.TemplateLiteralParser([
        "c",
        Schema.Union([Schema.TemplateLiteralParser(["a", Schema.NonEmptyString, "b"]), Schema.Literal("e")]),
        "d"
      ])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("ca bd", ["c", ["a", " ", "b"], "d"])
      await decoding.succeed("ced", ["c", "e", "d"])
      await decoding.fail(
        "cabd",
        `Expected a value with a length of at least 1, got ""
  at [1][1]`
      )
      await decoding.fail(
        "ed",
        `Missing key
  at [0]`
      )
    })

    it(`"c" + (\`a\${number}b\`|"e") + "d"`, async () => {
      const schema = Schema.TemplateLiteralParser([
        "c",
        Schema.Union([
          Schema.TemplateLiteralParser(["a", Schema.Finite.check(Check.int()), "b"]),
          Schema.Literal("e")
        ]),
        "d"
      ])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("ced", ["c", "e", "d"])
      await decoding.succeed("ca1bd", ["c", ["a", 1, "b"], "d"])
      await decoding.fail(
        "ca1.1bd",
        `Expected an integer, got 1.1
  at [1][1]`
      )
      await decoding.fail(
        "ca-bd",
        `Missing key
  at [1][0]`
      )
    })

    it(`readonly ["<", \`h\${1 | 2}\`, ">"]`, async () => {
      const schema = Schema.TemplateLiteralParser(["<", Schema.TemplateLiteral(["h", Schema.Literals([1, 2])]), ">"])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("<h1>", ["<", "h1", ">"])
      await decoding.succeed("<h2>", ["<", "h2", ">"])
      await decoding.fail(
        "<h3>",
        `Missing key
  at [0]`
      )
    })

    it(`readonly ["<", readonly ["h", 1 | 2], ">"]`, async () => {
      const schema = Schema.TemplateLiteralParser([
        "<",
        Schema.TemplateLiteralParser(["h", Schema.Literals([1, 2])]),
        ">"
      ])
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("<h1>", ["<", ["h", 1], ">"])
      await decoding.succeed("<h2>", ["<", ["h", 2], ">"])
      await decoding.fail(
        "<h3>",
        `Missing key
  at [1][0]`
      )
    })
  })

  describe("Class", () => {
    it("suspend before initialization", async () => {
      const schema = Schema.suspend(() => string)
      class A extends Schema.Class<A>("A")(Schema.Struct({ a: schema })) {}
      const string = Schema.String

      const asserts = new TestSchema.Asserts(A)
      const make = asserts.make()
      await make.succeed(new A({ a: "a" }))
      await make.succeed({ a: "a" }, new A({ a: "a" }))

      const decoding = asserts.decoding()
      await decoding.succeed(new A({ a: "a" }))
    })

    it("should memoize the ast", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}
      assertTrue(A.ast === A.ast)
    })

    describe("should be compatible with `immer`", () => {
      it("`[immerable]`", () => {
        class A extends Schema.Class<A>("A")({
          a: Schema.Struct({ b: Schema.FiniteFromString }).pipe(Schema.optional),
          c: Schema.FiniteFromString
        }) {}

        const a = new A({ a: { b: 1 }, c: 2 })

        const modified = produce(a, (draft) => {
          if (draft.a) {
            draft.a.b = 2
          }
        })

        assertTrue(modified instanceof A)
        strictEqual(modified.a?.b, 2)
        strictEqual(modified.c, 2)
        strictEqual(a.a?.b, 1)
      })

      it("Equality", () => {
        class A extends Schema.Class<A>("A")({
          a: Schema.String
        }) {}

        const a = new A({ a: "a" })
        const a1 = produce(a, (draft) => {
          draft.a = "a1"
        })
        const a2 = produce(a, (draft) => {
          draft.a = "a1"
        })
        assertTrue(Equal.equals(a1, new A({ a: "a1" })))
        assertTrue(Equal.equals(a1, a2))
      })
    })

    it("Struct with nested Class", async () => {
      class A extends Schema.Class<A, { readonly brand: unique symbol }>("A")(Schema.Struct({
        a: Schema.String
      })) {}
      const schema = Schema.Struct({
        a: A.pipe(Schema.withConstructorDefault(() => Option.some(new A({ a: "default" }))))
      })
      const asserts = new TestSchema.Asserts(schema)

      const make = asserts.make()
      await make.succeed({ a: new A({ a: "a" }) })
      await make.succeed({}, { a: new A({ a: "default" }) })
    })

    it("Class with nested Class", async () => {
      class A extends Schema.Class<A, { readonly brand: unique symbol }>("A")(Schema.Struct({
        a: Schema.String
      })) {}
      class B extends Schema.Class<B, { readonly brand: unique symbol }>("B")(Schema.Struct({
        a: A.pipe(Schema.withConstructorDefault(() => Option.some(new A({ a: "default" }))))
      })) {}
      const schema = B
      const asserts = new TestSchema.Asserts(schema)

      const make = asserts.make()
      await make.succeed({ a: new A({ a: "a" }) }, new B({ a: new A({ a: "a" }) }))
      await make.succeed({}, new B({ a: new A({ a: "default" }) }))
    })

    it("should be possible to define a class with a mutable field", async () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.mutableKey(Schema.String)
      }) {
        public update() {
          this.a = "b"
        }
      }
      const asserts = new TestSchema.Asserts(A)

      const make = asserts.make()
      await make.succeed(new A({ a: "a" }))
      await make.succeed({ a: "a" }, new A({ a: "a" }))

      const a = new A({ a: "a" })
      a.update()
      strictEqual(a.a, "b")
    })

    it("Fields argument", async () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {
        readonly _a = 1
      }
      const asserts = new TestSchema.Asserts(A)

      // should be a schema
      assertTrue(Schema.isSchema(A))
      // should expose the fields
      deepStrictEqual(A.fields, { a: Schema.String })
      // should expose the identifier
      strictEqual(A.identifier, "A")

      strictEqual(A.name, "A")

      assertTrue(new A({ a: "a" }) instanceof A)
      assertTrue(A.makeUnsafe({ a: "a" }) instanceof A)

      // test additional fields
      strictEqual(new A({ a: "a" })._a, 1)
      strictEqual(A.makeUnsafe({ a: "a" })._a, 1)

      // test Equal.equals
      assertTrue(Equal.equals(new A({ a: "a" }), new A({ a: "a" })))
      assertFalse(Equal.equals(new A({ a: "a" }), new A({ a: "b" })))

      const make = asserts.make()
      await make.succeed(new A({ a: "a" }))
      await make.succeed({ a: "a" }, new A({ a: "a" }))

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "a" }, new A({ a: "a" }))
      await decoding.fail(
        { a: 1 },
        `Expected string, got 1
  at ["a"]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed(new A({ a: "a" }), { a: "a" })
      await encoding.fail(
        null,
        "Expected A, got null"
      )
      await encoding.fail(
        { a: "a" },
        `Expected A, got {"a":"a"}`
      )
    })

    it("Struct argument", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {
        readonly _a = 1
      }
      const asserts = new TestSchema.Asserts(A)

      // should be a schema
      assertTrue(Schema.isSchema(A))
      // should expose the fields
      deepStrictEqual(A.fields, { a: Schema.String })
      // should expose the identifier
      strictEqual(A.identifier, "A")

      strictEqual(A.name, "A")

      assertTrue(new A({ a: "a" }) instanceof A)
      assertTrue(A.makeUnsafe({ a: "a" }) instanceof A)

      // test additional fields
      strictEqual(new A({ a: "a" })._a, 1)
      strictEqual(A.makeUnsafe({ a: "a" })._a, 1)

      // test Equal.equals
      assertTrue(Equal.equals(new A({ a: "a" }), new A({ a: "a" })))
      assertFalse(Equal.equals(new A({ a: "a" }), new A({ a: "b" })))

      const make = asserts.make()
      await make.succeed(new A({ a: "a" }))
      await make.succeed({ a: "a" }, new A({ a: "a" }))

      if (verifyGeneration) {
        const arbitrary = asserts.arbitrary()
        arbitrary.verifyGeneration()
      }

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "a" }, new A({ a: "a" }))
      await decoding.fail(
        { a: 1 },
        `Expected string, got 1
  at ["a"]`
      )

      const encoding = asserts.encoding()
      await encoding.succeed(new A({ a: "a" }), { a: "a" })
      await encoding.fail(
        null,
        "Expected A, got null"
      )
      await encoding.fail(
        { a: "a" },
        `Expected A, got {"a":"a"}`
      )
    })

    it("annotate", async () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}

      const Annotated = A.annotate({})

      // should be a schema
      assertTrue(Schema.isSchema(Annotated))
      // should expose the fields
      deepStrictEqual(Annotated.from.fields, { a: Schema.String })

      assertTrue(Annotated.makeUnsafe(new A({ a: "a" })) instanceof A)
    })

    it("extend", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {
        readonly _a = 1
      }
      class B extends A.extend<B>("B")({
        b: Schema.Number
      }) {
        readonly _b = 2
      }
      const asserts = new TestSchema.Asserts(B)

      const instance = new B({ a: "a", b: 2 })

      assertTrue(instance instanceof A)
      assertTrue(B.makeUnsafe({ a: "a", b: 2 }) instanceof A)
      assertTrue(instance instanceof B)
      assertTrue(B.makeUnsafe({ a: "a", b: 2 }) instanceof B)

      strictEqual(instance.a, "a")
      strictEqual(instance._a, 1)
      strictEqual(instance.b, 2)
      strictEqual(instance._b, 2)

      const make = asserts.make()
      await make.succeed(new B({ a: "a", b: 2 }))
      await make.succeed({ a: "a", b: 2 }, new B({ a: "a", b: 2 }))

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "a", b: 2 }, new B({ a: "a", b: 2 }))
    })
  })

  describe("ErrorClass", () => {
    it("fields argument", async () => {
      class E extends Schema.ErrorClass<E>("E")({
        id: Schema.Number
      }) {}
      const asserts = new TestSchema.Asserts(E)

      const err = new E({ id: 1 })

      strictEqual(String(err), `Error`)
      assertInclude(err.stack, "Schema.test.ts:")
      strictEqual(err.id, 1)

      const make = asserts.make()
      await make.succeed(new E({ id: 1 }))
      await make.succeed({ id: 1 }, new E({ id: 1 }))
    })

    it("Struct argument", async () => {
      class E extends Schema.ErrorClass<E>("E")(Schema.Struct({
        id: Schema.Number
      })) {}
      const asserts = new TestSchema.Asserts(E)

      const err = new E({ id: 1 })

      strictEqual(String(err), `Error`)
      assertInclude(err.stack, "Schema.test.ts:")
      strictEqual(err.id, 1)

      const make = asserts.make()
      await make.succeed(new E({ id: 1 }))
      await make.succeed({ id: 1 }, new E({ id: 1 }))

      if (verifyGeneration) {
        const arbitrary = asserts.arbitrary()
        arbitrary.verifyGeneration()
      }
    })

    it("extend", async () => {
      class A extends Schema.ErrorClass<A>("A")({
        a: Schema.String
      }) {
        readonly _a = 1
      }
      class B extends A.extend<B>("B")({
        b: Schema.Number
      }) {
        readonly _b = 2
      }
      const asserts = new TestSchema.Asserts(B)

      const instance = new B({ a: "a", b: 2 })

      strictEqual(String(instance), `Error`)
      assertInclude(instance.stack, "Schema.test.ts:")

      assertTrue(instance instanceof A)
      assertTrue(B.makeUnsafe({ a: "a", b: 2 }) instanceof A)
      assertTrue(instance instanceof B)
      assertTrue(B.makeUnsafe({ a: "a", b: 2 }) instanceof B)

      strictEqual(instance.a, "a")
      strictEqual(instance._a, 1)
      strictEqual(instance.b, 2)
      strictEqual(instance._b, 2)

      const make = asserts.make()
      await make.succeed(new B({ a: "a", b: 2 }))
      await make.succeed({ a: "a", b: 2 }, new B({ a: "a", b: 2 }))

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "a", b: 2 }, new B({ a: "a", b: 2 }))
    })
  })

  describe("Enum", () => {
    it("enums should be exposed", () => {
      enum Fruits {
        Apple,
        Banana
      }
      const schema = Schema.Enums(Fruits)
      strictEqual(schema.enums.Apple, 0)
      strictEqual(schema.enums.Banana, 1)
    })

    it("Numeric enums", async () => {
      enum Fruits {
        Apple,
        Banana
      }
      const schema = Schema.Enums(Fruits)
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed(Fruits.Apple)
      await decoding.succeed(Fruits.Banana)
      await decoding.succeed(0)
      await decoding.succeed(1)

      await decoding.fail(
        3,
        `Expected 0 | 1, got 3`
      )

      const encoding = asserts.encoding()
      await encoding.succeed(Fruits.Apple, 0)
      await encoding.succeed(Fruits.Banana, 1)
    })

    it("String enums", async () => {
      enum Fruits {
        Apple = "apple",
        Banana = "banana",
        Cantaloupe = 0
      }
      const schema = Schema.Enums(Fruits)
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed(Fruits.Apple)
      await decoding.succeed(Fruits.Cantaloupe)
      await decoding.succeed("apple")
      await decoding.succeed("banana")
      await decoding.succeed(0)
      await decoding.succeed(0)

      await decoding.fail(
        "Cantaloupe",
        `Expected "apple" | "banana" | 0, got "Cantaloupe"`
      )

      const encoding = asserts.encoding()
      await encoding.succeed(Fruits.Apple)
      await encoding.succeed(Fruits.Banana)
      await encoding.succeed(Fruits.Cantaloupe)
    })

    it("Const enums", async () => {
      const Fruits = {
        Apple: "apple",
        Banana: "banana",
        Cantaloupe: 3
      } as const
      const schema = Schema.Enums(Fruits)
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("apple")
      await decoding.succeed("banana")
      await decoding.succeed(3)

      await decoding.fail(
        "Cantaloupe",
        `Expected "apple" | "banana" | 3, got "Cantaloupe"`
      )

      const encoding = asserts.encoding()
      await encoding.succeed(Fruits.Apple, "apple")
      await encoding.succeed(Fruits.Banana, "banana")
      await encoding.succeed(Fruits.Cantaloupe, 3)
    })
  })

  describe("catchDecoding", () => {
    it("sync fallback", async () => {
      const fallback = Effect.succeed(Option.some("b"))
      const schema = Schema.String.pipe(Schema.catchDecoding(() => fallback)).check(Check.nonEmpty())
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a")
      await decoding.succeed(null, "b")
      await decoding.fail(
        "",
        `Expected a value with a length of at least 1, got ""`
      )

      const encoding = asserts.encoding()
      await encoding.succeed("a")
      await encoding.fail(
        null,
        "Expected string, got null"
      )
    })

    it("async fallback", async () => {
      const fallback = Effect.succeed(Option.some("b")).pipe(Effect.delay(100))
      const schema = Schema.String.pipe(Schema.catchDecoding(() => fallback))
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a")
      await decoding.succeed(null, "b")
    })
  })

  it("catchDecodingWithContext", async () => {
    class Service extends ServiceMap.Key<Service, { fallback: Effect.Effect<string> }>()("Service") {}

    const schema = Schema.String.pipe(Schema.catchDecodingWithContext(() =>
      Effect.gen(function*() {
        const service = yield* Service
        return Option.some(yield* service.fallback)
      })
    ))
    const asserts = new TestSchema.Asserts(schema)

    const decoding = asserts.decoding().provide(
      Service,
      { fallback: Effect.succeed("b") }
    )
    await decoding.succeed("a")
    await decoding.succeed(null, "b")
  })

  describe("decodingMiddleware", () => {
    it("providing a service", async () => {
      class Service extends ServiceMap.Key<Service, { fallback: Effect.Effect<string> }>()("Service") {}

      const schema = Schema.String.pipe(
        Schema.catchDecodingWithContext(() =>
          Effect.gen(function*() {
            const service = yield* Service
            return Option.some(yield* service.fallback)
          })
        ),
        Schema.decodingMiddleware((sr) =>
          Effect.isEffect(sr)
            ? Effect.provideService(sr, Service, { fallback: Effect.succeed("b") })
            : sr
        )
      )
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a")
      await decoding.succeed(null, "b")
    })

    it("forced failure", async () => {
      const schema = Schema.String.pipe(
        Schema.decodingMiddleware(() => Effect.fail(new Issue.Forbidden(Option.none(), { message: "my message" })))
      )
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.fail(
        "a",
        "my message"
      )
    })
  })

  describe("encodingMiddleware", () => {
    it("providing a service", async () => {
      class Service extends ServiceMap.Key<Service, { fallback: Effect.Effect<string> }>()("Service") {}

      const schema = Schema.String.pipe(
        Schema.catchEncodingWithContext(() =>
          Effect.gen(function*() {
            const service = yield* Service
            return Option.some(yield* service.fallback)
          })
        ),
        Schema.encodingMiddleware((sr) =>
          Effect.isEffect(sr)
            ? Effect.provideService(sr, Service, { fallback: Effect.succeed("b") })
            : sr
        )
      )
      const asserts = new TestSchema.Asserts(schema)

      const encoding = asserts.encoding()
      await encoding.succeed("a")
      await encoding.succeed(null, "b")
    })

    it("forced failure", async () => {
      const schema = Schema.String.pipe(
        Schema.encodingMiddleware(() => Effect.fail(new Issue.Forbidden(Option.none(), { message: "my message" })))
      )
      const asserts = new TestSchema.Asserts(schema)

      const encoding = asserts.encoding()
      await encoding.fail("a", "my message")
    })
  })

  describe("Optional Fields", () => {
    it("Exact Optional Property", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.FiniteFromString)
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "1" }, { a: 1 })
      await decoding.succeed({})

      const encoding = asserts.encoding()
      await encoding.succeed({ a: 1 }, { a: "1" })
      await encoding.succeed({})
    })

    it("Optional Property", async () => {
      const schema = Schema.Struct({
        a: Schema.optional(Schema.FiniteFromString)
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "1" }, { a: 1 })
      await decoding.succeed({})
      await decoding.succeed({ a: undefined })

      const encoding = asserts.encoding()
      await encoding.succeed({ a: 1 }, { a: "1" })
      await encoding.succeed({})
      await encoding.succeed({ a: undefined })
    })

    it("Exact Optional Property with Nullability", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.NullOr(Schema.FiniteFromString))
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "1" }, { a: 1 })
      await decoding.succeed({})
      await decoding.succeed({ a: null })

      const encoding = asserts.encoding()
      await encoding.succeed({ a: 1 }, { a: "1" })
      await encoding.succeed({})
      await encoding.succeed({ a: null })
    })

    it("Optional Property with Nullability", async () => {
      const schema = Schema.Struct({
        a: Schema.optional(Schema.NullOr(Schema.FiniteFromString))
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "1" }, { a: 1 })
      await decoding.succeed({})
      await decoding.succeed({ a: undefined })
      await decoding.succeed({ a: null })

      const encoding = asserts.encoding()
      await encoding.succeed({ a: 1 }, { a: "1" })
      await encoding.succeed({})
      await encoding.succeed({ a: null })
      await encoding.succeed({ a: undefined })
    })

    it("Optional Property to Exact Optional Property", async () => {
      const schema = Schema.Struct({
        a: Schema.optional(Schema.FiniteFromString).pipe(Schema.decodeTo(Schema.optionalKey(Schema.Number), {
          decode: Getter.transformOptional(Option.filter(Predicate.isNotUndefined)),
          encode: Getter.passthrough()
        }))
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "1" }, { a: 1 })
      await decoding.succeed({})
      await decoding.succeed({ a: undefined }, {})

      const encoding = asserts.encoding()
      await encoding.succeed({ a: 1 }, { a: "1" })
      await encoding.succeed({})
    })

    it("Optional Property with Nullability to Optional Property", async () => {
      const schema = Schema.Struct({
        a: Schema.optional(Schema.NullOr(Schema.FiniteFromString)).pipe(
          Schema.decodeTo(Schema.optional(Schema.Number), {
            decode: Getter.transformOptional(Option.filter(Predicate.isNotNull)),
            encode: Getter.passthrough()
          })
        )
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "1" }, { a: 1 })
      await decoding.succeed({})
      await decoding.succeed({ a: undefined })
      await decoding.succeed({ a: null }, {})

      const encoding = asserts.encoding()
      await encoding.succeed({ a: 1 }, { a: "1" })
      await encoding.succeed({})
    })
  })

  describe("asOption", () => {
    it("optionalKey -> Option", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.FiniteFromString).pipe(
          Schema.decodeTo(
            Schema.Option(Schema.Number),
            Transformation.transformOptional({
              decode: Option.some,
              encode: Option.flatten
            })
          )
        )
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "1" }, { a: Option.some(1) })
      await decoding.succeed({}, { a: Option.none() })

      const encoding = asserts.encoding()
      await encoding.succeed({ a: Option.some(1) }, { a: "1" })
      await encoding.succeed({ a: Option.none() }, {})
    })

    it("optional -> Option", async () => {
      const schema = Schema.Struct({
        a: Schema.optional(Schema.FiniteFromString).pipe(
          Schema.decodeTo(
            Schema.Option(Schema.Number),
            Transformation.transformOptional({
              decode: (on) => on.pipe(Option.filter((nu) => nu !== undefined), Option.some),
              encode: Option.flatten
            })
          )
        )
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "1" }, { a: Option.some(1) })
      await decoding.succeed({}, { a: Option.none() })
      await decoding.succeed({ a: undefined }, { a: Option.none() })

      const encoding = asserts.encoding()
      await encoding.succeed({ a: Option.some(1) }, { a: "1" })
      await encoding.succeed({ a: Option.none() }, {})
    })
  })

  it("decodeTo as composition", async () => {
    const From = Schema.Struct({
      a: Schema.String,
      b: Schema.FiniteFromString
    })

    const To = Schema.Struct({
      a: Schema.FiniteFromString,
      b: Schema.UndefinedOr(Schema.Number)
    })

    const schema = From.pipe(Schema.decodeTo(To))
    const asserts = new TestSchema.Asserts(schema)

    const decoding = asserts.decoding()
    await decoding.succeed({ a: "1", b: "2" }, { a: 1, b: 2 })

    const encoding = asserts.encoding()
    await encoding.succeed({ a: 1, b: 2 }, { a: "1", b: "2" })
    await encoding.fail(
      { a: 1, b: NaN },
      `Expected a finite number, got NaN
  at ["b"]`
    )
    await encoding.fail(
      { a: 1, b: undefined },
      `Expected number, got undefined
  at ["b"]`
    )
  })

  it("encodeTo as composition", async () => {
    const From = Schema.Struct({
      a: Schema.String,
      b: Schema.FiniteFromString
    })

    const To = Schema.Struct({
      a: Schema.FiniteFromString,
      b: Schema.UndefinedOr(Schema.Number)
    })

    const schema = To.pipe(Schema.encodeTo(From))
    const asserts = new TestSchema.Asserts(schema)

    const decoding = asserts.decoding()
    await decoding.succeed({ a: "1", b: "2" }, { a: 1, b: 2 })
    await decoding.fail(
      { a: "1", b: null },
      `Expected string, got null
  at ["b"]`
    )

    const encoding = asserts.encoding()
    await encoding.succeed({ a: 1, b: 2 }, { a: "1", b: "2" })
    await encoding.fail(
      { a: 1, b: NaN },
      `Expected a finite number, got NaN
  at ["b"]`
    )
    await encoding.fail(
      { a: 1, b: undefined },
      `Expected number, got undefined
  at ["b"]`
    )
  })

  describe("checkEffect", () => {
    it("no context", async () => {
      const schema = Schema.String.pipe(
        Schema.decode({
          decode: Getter.checkEffect((s) =>
            Effect.gen(function*() {
              if (s.length === 0) {
                return new Issue.InvalidValue(Option.some(s), { message: "input should not be empty string" })
              }
            }).pipe(Effect.delay(100))
          ),
          encode: Getter.passthrough()
        })
      )
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed("a")
      await decoding.fail(
        "",
        "input should not be empty string"
      )
    })

    it("with context", async () => {
      class Service extends ServiceMap.Key<Service, { fallback: Effect.Effect<string> }>()("Service") {}

      const schema = Schema.String.pipe(
        Schema.decode({
          decode: Getter.checkEffect((s) =>
            Effect.gen(function*() {
              yield* Service
              if (s.length === 0) {
                return new Issue.InvalidValue(Option.some(s), { message: "input should not be empty string" })
              }
            })
          ),
          encode: Getter.passthrough()
        })
      )
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding().provide(
        Service,
        { fallback: Effect.succeed("b") }
      )
      await decoding.succeed("a")
      await decoding.fail(
        "",
        "input should not be empty string"
      )
    })
  })

  describe("is", () => {
    it("FiniteFromString", () => {
      const schema = Schema.FiniteFromString
      const is = Schema.is(schema)
      assertTrue(is(1))
      assertFalse(is("a"))
    })
  })

  describe("asserts", () => {
    it("FiniteFromString", () => {
      const schema = Schema.FiniteFromString
      const asserts: Schema.Codec.ToAsserts<typeof schema> = Schema.asserts(schema)
      try {
        asserts(1)
      } catch {
        fail("Expected asserts to not throw an error")
      }
      try {
        asserts("a")
        fail("Expected asserts to throw an error")
      } catch (e) {
        ok(e instanceof Error)
        strictEqual(e.message, `Expected number, got "a"`)
      }
    })
  })

  describe("decodeUnknownPromise / encodeUnknownPromise", () => {
    it("FiniteFromString", async () => {
      const schema = Schema.FiniteFromString
      const decodeUnknownPromise = Schema.decodeUnknownPromise(schema)
      const encodeUnknownPromise = Schema.encodeUnknownPromise(schema)

      const r1 = await decodeUnknownPromise("1").then(Result.succeed, (e) => Result.fail(e.toString()))
      deepStrictEqual(r1, Result.succeed(1))

      const r2 = await decodeUnknownPromise(null).then(Result.succeed, (e) => Result.fail(e.toString()))
      deepStrictEqual(r2, Result.fail("Expected string, got null"))

      const r3 = await encodeUnknownPromise(1).then(Result.succeed, (e) => Result.fail(e.toString()))
      deepStrictEqual(r3, Result.succeed("1"))

      const r4 = await encodeUnknownPromise(null).then(Result.succeed, (e) => Result.fail(e.toString()))
      deepStrictEqual(r4, Result.fail("Expected number, got null"))
    })
  })

  describe("decodeUnknownExit", () => {
    it("should throw on async decoding", () => {
      const AsyncString = Schema.String.pipe(Schema.decode({
        decode: new Getter.Getter((os: Option.Option<string>) =>
          Effect.gen(function*() {
            yield* Effect.sleep("10 millis")
            return os
          })
        ),
        encode: Getter.passthrough()
      }))
      const schema = AsyncString

      throws(() => ToParser.decodeUnknownExit(schema)("1"))
    })

    it("should die on missing dependency", () => {
      class MagicNumber extends ServiceMap.Key<MagicNumber, number>()("MagicNumber") {}
      const DepString = Schema.Number.pipe(Schema.decode({
        decode: Getter.onSome((n) =>
          Effect.gen(function*() {
            const magicNumber = yield* MagicNumber
            return Option.some(n * magicNumber)
          })
        ),
        encode: Getter.passthrough()
      }))
      const schema = DepString
      const exit = ToParser.decodeUnknownExit(schema as any)(1)
      assertTrue(Exit.hasDie(exit))
    })
  })

  describe("annotateKey", () => {
    describe("the messageMissingKey annotation should be used as a error message", () => {
      it("Struct", async () => {
        const schema = Schema.Struct({
          a: Schema.String.pipe(Schema.annotateKey({ messageMissingKey: "this field is required" }))
        })
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.fail(
          {},
          `this field is required
  at ["a"]`
        )
      })

      it("Tuple", async () => {
        const schema = Schema.Tuple([
          Schema.String.pipe(Schema.annotateKey({ messageMissingKey: "this element is required" }))
        ])
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding()
        await decoding.fail(
          [],
          `this element is required
  at [0]`
        )
      })
    })
  })

  describe("Struct.mapFields", () => {
    it("evolve", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.evolve({ a: (v) => Schema.optionalKey(v) }))

      equals(schema.fields, {
        a: Schema.optionalKey(Schema.String),
        b: Schema.Number
      })
    })

    it("evolveKeys", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.evolveKeys({ a: (k) => Str.toUpperCase(k) }))

      equals(schema.fields, {
        A: Schema.String,
        b: Schema.Number
      })
    })

    it("renameKeys", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number,
        c: Schema.Boolean
      }).mapFields(Struct.renameKeys({ a: "A", b: "B" }))

      equals(schema.fields, {
        A: Schema.String,
        B: Schema.Number,
        c: Schema.Boolean
      })
    })

    it("evolveEntries", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.evolveEntries({ a: (k, v) => [Str.toUpperCase(k), Schema.optionalKey(v)] }))

      equals(schema.fields, {
        A: Schema.optionalKey(Schema.String),
        b: Schema.Number
      })
    })

    it("optionalKey", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.optionalKey))

      equals(schema.fields, {
        a: Schema.optionalKey(Schema.String),
        b: Schema.optionalKey(Schema.Number)
      })
    })

    it("mapPick", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.mapPick(["a"], Schema.optionalKey))

      equals(schema.fields, {
        a: Schema.optionalKey(Schema.String),
        b: Schema.Number
      })
    })

    it("mapOmit", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.mapOmit(["b"], Schema.optionalKey))

      equals(schema.fields, {
        a: Schema.optionalKey(Schema.String),
        b: Schema.Number
      })
    })

    it("optional", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.optional))

      equals(schema.fields, {
        a: Schema.optional(Schema.String),
        b: Schema.optional(Schema.Number)
      })
    })

    it("mutableKey", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.mutableKey))

      equals(schema.fields, {
        a: Schema.mutableKey(Schema.String),
        b: Schema.mutableKey(Schema.Number)
      })
    })

    it("mutable", () => {
      const schema = Schema.Struct({
        a: Schema.Array(Schema.String),
        b: Schema.Tuple([Schema.Number])
      }).mapFields(Struct.map(Schema.mutable))

      equals(schema.fields, {
        a: Schema.mutable(Schema.Array(Schema.String)),
        b: Schema.mutable(Schema.Tuple([Schema.Number]))
      })
    })

    it("readonly", () => {
      const schema = Schema.Struct({
        a: Schema.Array(Schema.String),
        b: Schema.Tuple([Schema.Number])
      }).mapFields(Struct.map(Schema.mutable))
        .mapFields(Struct.map(Schema.readonly))

      equals(schema.fields, {
        a: Schema.readonly(Schema.Array(Schema.String)),
        b: Schema.readonly(Schema.Tuple([Schema.Number]))
      })
    })

    it("NullOr", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.NullOr))

      equals(schema.fields, {
        a: Schema.NullOr(Schema.String),
        b: Schema.NullOr(Schema.Number)
      })
    })

    it("UndefinedOr", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.UndefinedOr))

      equals(schema.fields, {
        a: Schema.UndefinedOr(Schema.String),
        b: Schema.UndefinedOr(Schema.Number)
      })
    })

    it("NullishOr", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.NullishOr))

      equals(schema.fields, {
        a: Schema.NullishOr(Schema.String),
        b: Schema.NullishOr(Schema.Number)
      })
    })

    it("should work with flow", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.FiniteFromString,
        c: Schema.Boolean
      }).mapFields(flow(
        Struct.map(Schema.NullOr),
        Struct.mapPick(["a", "c"], Schema.mutableKey)
      ))

      equals(schema.fields, {
        a: Schema.mutableKey(Schema.NullOr(Schema.String)),
        b: Schema.NullOr(Schema.FiniteFromString),
        c: Schema.mutableKey(Schema.NullOr(Schema.Boolean))
      })
    })
  })

  describe("Tuple.mapElements", () => {
    it("appendElement", () => {
      const schema = Schema.Tuple([Schema.String]).mapElements(Tuple.appendElement(Schema.Number))

      TestSchema.Asserts.ast.elements.equals(schema.elements, [Schema.String, Schema.Number])
    })

    it("appendElements", () => {
      const schema = Schema.Tuple([Schema.String]).mapElements(Tuple.appendElements([Schema.Number, Schema.Boolean]))

      TestSchema.Asserts.ast.elements.equals(schema.elements, [Schema.String, Schema.Number, Schema.Boolean])
    })

    it("pick", () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(Tuple.pick([0, 2]))

      TestSchema.Asserts.ast.elements.equals(schema.elements, [Schema.String, Schema.Boolean])
    })

    it("omit", () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(Tuple.omit([1]))

      TestSchema.Asserts.ast.elements.equals(schema.elements, [Schema.String, Schema.Boolean])
    })

    describe("evolve", () => {
      it("readonly [string] -> readonly [string?]", () => {
        const schema = Schema.Tuple([Schema.String]).mapElements(Tuple.evolve([(v) => Schema.optionalKey(v)]))

        TestSchema.Asserts.ast.elements.equals(schema.elements, [Schema.optionalKey(Schema.String)])
      })

      it("readonly [string, number] -> readonly [string, number?]", () => {
        const schema = Schema.Tuple([Schema.String, Schema.Number]).mapElements(
          Tuple.evolve([undefined, (v) => Schema.optionalKey(v)])
        )

        TestSchema.Asserts.ast.elements.equals(schema.elements, [Schema.String, Schema.optionalKey(Schema.Number)])
      })
    })

    describe("renameIndices", () => {
      it("partial index mapping", () => {
        const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(
          Tuple.renameIndices(["1", "0"])
        )
        TestSchema.Asserts.ast.elements.equals(schema.elements, [Schema.Number, Schema.String, Schema.Boolean])
      })

      it("full index mapping", () => {
        const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(
          Tuple.renameIndices(["2", "1", "0"])
        )
        TestSchema.Asserts.ast.elements.equals(schema.elements, [Schema.Boolean, Schema.Number, Schema.String])
      })
    })

    it("NullOr", () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number]).mapElements(Tuple.map(Schema.NullOr))

      TestSchema.Asserts.ast.elements.equals(schema.elements, [
        Schema.NullOr(Schema.String),
        Schema.NullOr(Schema.Number)
      ])
    })
  })

  describe("Union.mapMembers", () => {
    it("appendElement", () => {
      const schema = Schema.Union([Schema.String, Schema.Number]).mapMembers(Tuple.appendElement(Schema.Boolean))

      TestSchema.Asserts.ast.elements.equals(schema.members, [Schema.String, Schema.Number, Schema.Boolean])
    })

    it("evolve", () => {
      const schema = Schema.Union([Schema.String, Schema.Number, Schema.Boolean]).mapMembers(
        Tuple.evolve([
          (v) => Schema.Array(v),
          undefined,
          (v) => Schema.Array(v)
        ])
      )

      TestSchema.Asserts.ast.elements.equals(schema.members, [
        Schema.Array(Schema.String),
        Schema.Number,
        Schema.Array(Schema.Boolean)
      ])
    })

    it("Array", () => {
      const schema = Schema.Union([Schema.String, Schema.Number]).mapMembers(Tuple.map(Schema.Array))

      TestSchema.Asserts.ast.elements.equals(schema.members, [
        Schema.Array(Schema.String),
        Schema.Array(Schema.Number)
      ])
    })
  })

  describe("Literals.mapMembers", () => {
    it("evolve", () => {
      const schema = Schema.Literals(["a", "b", "c"]).mapMembers(Tuple.evolve([
        (a) => Schema.Struct({ _tag: a, a: Schema.String }),
        (b) => Schema.Struct({ _tag: b, b: Schema.Number }),
        (c) => Schema.Struct({ _tag: c, c: Schema.Boolean })
      ]))

      TestSchema.Asserts.ast.elements.equals(schema.members, [
        Schema.Struct({ _tag: Schema.Literal("a"), a: Schema.String }),
        Schema.Struct({ _tag: Schema.Literal("b"), b: Schema.Number }),
        Schema.Struct({ _tag: Schema.Literal("c"), c: Schema.Boolean })
      ])
    })
  })

  it("encodeKeys", async () => {
    const schema = Schema.Struct({
      a: Schema.FiniteFromString,
      b: Schema.String
    }).pipe(Schema.encodeKeys({ a: "c" }))
    const asserts = new TestSchema.Asserts(schema)

    const decoding = asserts.decoding()
    await decoding.succeed({ c: "1", b: "b" }, { a: 1, b: "b" })

    const encoding = asserts.encoding()
    await encoding.succeed({ a: 1, b: "b" }, { c: "1", b: "b" })
  })

  describe("Check.make", () => {
    it("returns undefined", async () => {
      const schema = Schema.String.check(Check.make(() => undefined))
      const asserts = new TestSchema.Asserts(schema)
      const decoding = asserts.decoding()
      await decoding.succeed("a")
    })

    it("returns true", async () => {
      const schema = Schema.String.check(Check.make(() => true))
      const asserts = new TestSchema.Asserts(schema)
      const decoding = asserts.decoding()
      await decoding.succeed("a")
    })

    it("returns false", async () => {
      const schema = Schema.String.check(Check.make(() => false))
      const asserts = new TestSchema.Asserts(schema)
      const decoding = asserts.decoding()
      await decoding.fail(
        "a",
        `Expected <filter>, got "a"`
      )
    })

    it("returns string", async () => {
      const schema = Schema.String.check(Check.make(() => "error message"))
      const asserts = new TestSchema.Asserts(schema)
      const decoding = asserts.decoding()
      await decoding.fail(
        "a",
        `error message`
      )
    })

    describe("returns issue", () => {
      it("abort: false", async () => {
        const schema = Schema.String.check(
          Check.make((s) => new Issue.InvalidValue(Option.some(s), { message: "error message 1" }), {
            title: "filter title 1"
          }),
          Check.make(() => false, { title: "filter title 2", message: "error message 2" })
        )
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding({ parseOptions: { errors: "all" } })
        await decoding.fail(
          "a",
          `error message 1
error message 2`
        )
      })

      it("abort: true", async () => {
        const schema = Schema.String.check(
          Check.make((s) => new Issue.InvalidValue(Option.some(s), { message: "error message 1" }), {
            title: "filter title 1"
          }, true),
          Check.make(() => false, { title: "filter title 2", message: "error message 2" })
        )
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding({ parseOptions: { errors: "all" } })
        await decoding.fail(
          "a",
          `error message 1`
        )
      })
    })

    describe("returns object", () => {
      it("abort: false", async () => {
        const schema = Schema.String.check(
          Check.make(() => ({
            path: ["a"],
            message: "error message 1"
          }), { title: "filter title 1" }),
          Check.make(() => false, { title: "filter title 2", message: "error message 2" })
        )
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding({ parseOptions: { errors: "all" } })
        await decoding.fail(
          "a",
          `error message 1
  at ["a"]
error message 2`
        )
      })

      it("abort: true", async () => {
        const schema = Schema.String.check(
          Check.make(() => ({ path: ["a"], message: "error message 1" }), { title: "error title 1" }, true),
          Check.make(() => false, { title: "error title 2", message: "error message 2" })
        )
        const asserts = new TestSchema.Asserts(schema)

        const decoding = asserts.decoding({ parseOptions: { errors: "all" } })
        await decoding.fail(
          "a",
          `error message 1
  at ["a"]`
        )
      })
    })
  })

  describe("extendTo", () => {
    it("Struct", async () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).pipe(Schema.extendTo({
        c: Schema.String
      }, {
        c: (value) => Option.some(value.a + "c" + value.b)
      }))
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({ a: "1", b: 2 }, { a: "1", b: 2, c: "1c2" })

      const encoding = asserts.encoding()
      await encoding.succeed({ a: "1", b: 2, c: "1c2" }, { a: "1", b: 2 })
    })

    it("Union", async () => {
      const Circle = Schema.Struct({
        radius: Schema.Number
      })

      const Square = Schema.Struct({
        sideLength: Schema.Number
      })

      const DiscriminatedShape = Schema.Union([
        Circle.pipe(Schema.extendTo({ kind: Schema.tag("circle") }, { kind: () => Option.some("circle" as const) })),
        Square.pipe(Schema.extendTo({ kind: Schema.tag("square") }, { kind: () => Option.some("square" as const) }))
      ])
      const asserts = new TestSchema.Asserts(DiscriminatedShape)

      const decoding = asserts.decoding()
      await decoding.succeed({ radius: 1 }, { radius: 1, kind: "circle" })
      await decoding.succeed({ sideLength: 1 }, {
        sideLength: 1,
        kind: "square"
      })

      const encoding = asserts.encoding()
      await encoding.succeed({ radius: 1, kind: "circle" }, { radius: 1 })
      await encoding.succeed({ sideLength: 1, kind: "square" }, {
        sideLength: 1
      })
    })
  })

  describe("Tagged unions", () => {
    describe("asTaggedUnion", () => {
      it("should augment a union", () => {
        const b = Symbol.for("B")
        const schema = Schema.Union([
          Schema.Struct({ _tag: Schema.Literal("A"), a: Schema.String }),
          Schema.Struct({ _tag: Schema.UniqueSymbol(b), b: Schema.FiniteFromString }),
          Schema.Union([
            Schema.Struct({ _tag: Schema.Literal(1), c: Schema.Boolean }),
            Schema.Struct({ _tag: Schema.Literal("D"), d: Schema.Date })
          ])
        ]).pipe(Schema.asTaggedUnion("_tag"))

        // cases
        deepStrictEqual(schema.cases.A, schema.members[0])
        deepStrictEqual(schema.cases[b], schema.members[1])
        deepStrictEqual(schema.cases[1], schema.members[2].members[0])
        deepStrictEqual(schema.cases["1"], schema.members[2].members[0])
        deepStrictEqual(schema.cases.D, schema.members[2].members[1])

        // isAnyOf
        const isAOr1 = schema.isAnyOf(["A", 1])
        assertTrue(isAOr1({ _tag: "A", a: "a" }))
        assertTrue(isAOr1({ _tag: 1, c: true }))
        assertFalse(isAOr1({ _tag: "D", d: new Date() }))
        assertFalse(isAOr1({ _tag: b, b: 1 }))

        // guards
        assertTrue(schema.guards.A({ _tag: "A", a: "a" }))
        assertFalse(schema.guards.A({ _tag: "A", a: 1 }))

        assertTrue(schema.guards[b]({ _tag: b, b: 1 }))
        assertFalse(schema.guards[b]({ _tag: b, b: "b" }))

        assertTrue(schema.guards[1]({ _tag: 1, c: true }))
        assertFalse(schema.guards[1]({ _tag: 1, c: 1 }))

        assertTrue(schema.guards.D({ _tag: "D", d: new Date() }))
        assertFalse(schema.guards.D({ _tag: "D", d: "d" }))

        // match
        deepStrictEqual(
          schema.match({ _tag: "A", a: "a" }, { A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" }),
          "A"
        )
        deepStrictEqual(
          pipe({ _tag: "A", a: "a" }, schema.match({ A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" })),
          "A"
        )
        deepStrictEqual(
          schema.match({ _tag: b, b: 1 }, { A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" }),
          "B"
        )
        deepStrictEqual(
          pipe({ _tag: b, b: 1 }, schema.match({ A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" })),
          "B"
        )
        deepStrictEqual(
          schema.match({ _tag: 1, c: true }, { A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" }),
          "C"
        )
        deepStrictEqual(
          pipe({ _tag: 1, c: true }, schema.match({ A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" })),
          "C"
        )
        deepStrictEqual(
          schema.match({ _tag: "D", d: new Date() }, { A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" }),
          "D"
        )
        deepStrictEqual(
          pipe(
            { _tag: "D", d: new Date() },
            schema.match({ A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" })
          ),
          "D"
        )
      })

      it("should support multiple tags", () => {
        const schema = Schema.Union([
          Schema.Struct({ _tag: Schema.tag("A"), type: Schema.tag("TypeA"), a: Schema.String }),
          Schema.Struct({ _tag: Schema.tag("B"), type: Schema.tag("TypeB"), b: Schema.FiniteFromString })
        ]).pipe(Schema.asTaggedUnion("type"))

        // cases
        deepStrictEqual(schema.cases.TypeA, schema.members[0])
        deepStrictEqual(schema.cases.TypeB, schema.members[1])
      })
    })

    describe("TaggedUnion", () => {
      it("should create a tagged union", () => {
        const schema = Schema.TaggedUnion({
          A: { a: Schema.String },
          C: { c: Schema.Boolean },
          B: { b: Schema.FiniteFromString }
        }).annotate({})

        const { A, B, C } = schema.cases

        // cases
        strictEqual(A.fields._tag.ast.literal, "A")
        strictEqual(A.fields.a, Schema.String)
        strictEqual(B.fields._tag.ast.literal, "B")
        strictEqual(B.fields.b, Schema.FiniteFromString)
        strictEqual(C.fields._tag.ast.literal, "C")
        strictEqual(C.fields.c, Schema.Boolean)

        // isAnyOf
        const isAOrB = schema.isAnyOf(["A", "B"])
        assertTrue(isAOrB({ _tag: "A", a: "a" }))
        assertTrue(isAOrB({ _tag: "B", b: 1 }))
        assertFalse(isAOrB({ _tag: "C", c: true }))

        // guards
        assertTrue(schema.guards.A({ _tag: "A", a: "a" }))
        assertTrue(schema.guards.B({ _tag: "B", b: 1 }))
        assertTrue(schema.guards.C({ _tag: "C", c: true }))
        assertFalse(schema.guards.A({ _tag: "A", b: 1 }))
        assertFalse(schema.guards.B({ _tag: "B", a: "a" }))
        assertFalse(schema.guards.C({ _tag: "C", c: 1 }))

        // match
        deepStrictEqual(
          schema.match({ _tag: "A", a: "a" }, { A: () => "A", B: () => "B", C: () => "C" }),
          "A"
        )
        deepStrictEqual(
          pipe({ _tag: "A", a: "a" }, schema.match({ A: () => "A", B: () => "B", C: () => "C" })),
          "A"
        )
        deepStrictEqual(
          schema.match({ _tag: "B", b: 1 }, { A: () => "A", B: () => "B", C: () => "C" }),
          "B"
        )
        deepStrictEqual(
          pipe({ _tag: "B", b: 1 }, schema.match({ A: () => "A", B: () => "B", C: () => "C" })),
          "B"
        )
        deepStrictEqual(
          schema.match({ _tag: "C", c: true }, { A: () => "A", B: () => "B", C: () => "C" }),
          "C"
        )
        deepStrictEqual(
          pipe({ _tag: "C", c: true }, schema.match({ A: () => "A", B: () => "B", C: () => "C" })),
          "C"
        )
      })
    })
  })

  describe("withDecodingDefaultKey", () => {
    it("should return a decoding default value if the key is missing", async () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString.pipe(Schema.withDecodingDefaultKey(() => "1"))
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({}, { a: 1 })
      await decoding.succeed({ a: "2" }, { a: 2 })
      await decoding.fail(
        { a: undefined },
        `Expected string, got undefined
  at ["a"]`
      )
    })

    it("by default should pass through the value", async () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString.pipe(Schema.withDecodingDefaultKey(() => "1"))
      })
      const asserts = new TestSchema.Asserts(schema)

      const encoding = asserts.encoding()
      await encoding.succeed({ a: 1 }, { a: "1" })
    })

    it("should omit the value if the encoding strategy is set to omit", async () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString.pipe(Schema.withDecodingDefaultKey(() => "1", { encodingStrategy: "omit" }))
      })
      const asserts = new TestSchema.Asserts(schema)

      const encoding = asserts.encoding()
      await encoding.succeed({ a: 1 }, {})
    })

    it("nested default values", async () => {
      const schema = Schema.Struct({
        a: Schema.Struct({
          b: Schema.FiniteFromString.pipe(Schema.withDecodingDefaultKey(() => "1"))
        }).pipe(Schema.withDecodingDefaultKey(() => ({})))
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({}, { a: { b: 1 } })
      await decoding.succeed({ a: {} }, { a: { b: 1 } })
      await decoding.succeed({ a: { b: "2" } }, { a: { b: 2 } })
      await decoding.fail(
        { a: { b: undefined } },
        `Expected string, got undefined
  at ["a"]["b"]`
      )
    })
  })

  describe("withDecodingDefault", () => {
    it("should return a decoding default value if the key is missing", async () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString.pipe(Schema.withDecodingDefault(() => "1"))
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({}, { a: 1 })
      await decoding.succeed({ a: undefined }, { a: 1 })
      await decoding.succeed({ a: "2" }, { a: 2 })
    })

    it("by default should pass through the value", async () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString.pipe(Schema.withDecodingDefault(() => "1"))
      })
      const asserts = new TestSchema.Asserts(schema)

      const encoding = asserts.encoding()
      await encoding.succeed({ a: 1 }, { a: "1" })
    })

    it("should omit the value if the encoding strategy is set to omit", async () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString.pipe(Schema.withDecodingDefault(() => "1", { encodingStrategy: "omit" }))
      })
      const asserts = new TestSchema.Asserts(schema)

      const encoding = asserts.encoding()
      await encoding.succeed({ a: 1 }, {})
    })

    it("nested default values", async () => {
      const schema = Schema.Struct({
        a: Schema.Struct({
          b: Schema.FiniteFromString.pipe(Schema.withDecodingDefault(() => "1"))
        }).pipe(Schema.withDecodingDefault(() => ({})))
      })
      const asserts = new TestSchema.Asserts(schema)

      const decoding = asserts.decoding()
      await decoding.succeed({}, { a: { b: 1 } })
      await decoding.succeed({ a: {} }, { a: { b: 1 } })
      await decoding.succeed({ a: undefined }, { a: { b: 1 } })
      await decoding.succeed({ a: { b: undefined } }, { a: { b: 1 } })
      await decoding.succeed({ a: { b: "2" } }, { a: { b: 2 } })
    })
  })

  it("NonEmptyString", async () => {
    const schema = Schema.NonEmptyString
    const asserts = new TestSchema.Asserts(schema)

    const decoding = asserts.decoding()
    await decoding.succeed("a")
    await decoding.fail(
      "",
      `Expected a value with a length of at least 1, got ""`
    )

    const encoding = asserts.encoding()
    await encoding.succeed("a")
    await encoding.fail(
      "",
      `Expected a value with a length of at least 1, got ""`
    )
  })

  it("Char", async () => {
    const schema = Schema.Char
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }

    const decoding = asserts.decoding()
    await decoding.succeed("a")
    await decoding.fail(
      "ab",
      `Expected a value with a length of 1, got "ab"`
    )

    const encoding = asserts.encoding()
    await encoding.succeed("a")
    await encoding.fail(
      "ab",
      `Expected a value with a length of 1, got "ab"`
    )
  })

  it("Int", async () => {
    const schema = Schema.Int
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }

    const decoding = asserts.decoding()
    await decoding.succeed(1)
    await decoding.fail(
      1.1,
      `Expected an integer, got 1.1`
    )
    await decoding.fail(
      NaN,
      `Expected an integer, got NaN`
    )
    await decoding.fail(
      Infinity,
      `Expected an integer, got Infinity`
    )
    await decoding.fail(
      -Infinity,
      `Expected an integer, got -Infinity`
    )

    const encoding = asserts.encoding()
    await encoding.succeed(1)
    await encoding.fail(
      1.1,
      `Expected an integer, got 1.1`
    )
  })

  it("Capitalize", async () => {
    const schema = Schema.String.pipe(
      Schema.decodeTo(
        Schema.String.check(Check.capitalized()),
        Transformation.capitalize()
      )
    )
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }

    const decoding = asserts.decoding()
    await decoding.succeed("abc", "Abc")

    const encoding = asserts.encoding()
    await encoding.succeed("Abc")
    await encoding.fail(
      "abc",
      `Expected a string with the first character in uppercase, got "abc"`
    )
  })

  it("Uncapitalize", async () => {
    const schema = Schema.String.pipe(
      Schema.decodeTo(
        Schema.String.check(Check.uncapitalized()),
        Transformation.uncapitalize()
      )
    )
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }

    const decoding = asserts.decoding()
    await decoding.succeed("Abc", "abc")

    const encoding = asserts.encoding()
    await encoding.succeed("abc")
    await encoding.fail(
      "Abc",
      `Expected a string with the first character in lowercase, got "Abc"`
    )
  })

  it("Lowercase", async () => {
    const schema = Schema.String.pipe(
      Schema.decodeTo(
        Schema.String.check(Check.lowercased()),
        Transformation.toLowerCase()
      )
    )
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }

    const decoding = asserts.decoding()
    await decoding.succeed("ABC", "abc")

    const encoding = asserts.encoding()
    await encoding.succeed("abc")
    await encoding.fail(
      "ABC",
      `Expected a string with all characters in lowercase, got "ABC"`
    )
  })

  it("Uppercase", async () => {
    const schema = Schema.String.pipe(
      Schema.decodeTo(
        Schema.String.check(Check.uppercased()),
        Transformation.toUpperCase()
      )
    )
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }

    const decoding = asserts.decoding()
    await decoding.succeed("abc", "ABC")

    const encoding = asserts.encoding()
    await encoding.succeed("ABC")
    await encoding.fail(
      "abc",
      `Expected a string with all characters in uppercase, got "abc"`
    )
  })
})

describe("Getter", () => {
  it("succeed", async () => {
    const schema = Schema.Literal(0).pipe(Schema.decodeTo(Schema.Literal("a"), {
      decode: Getter.succeed("a"),
      encode: Getter.succeed(0)
    }))
    const asserts = new TestSchema.Asserts(schema)

    const decoding = asserts.decoding()
    await decoding.succeed(0, "a")
    await decoding.fail(1, `Expected 0, got 1`)

    const encoding = asserts.encoding()
    await encoding.succeed("a", 0)
    await encoding.fail("b", `Expected "a", got "b"`)
  })
})
