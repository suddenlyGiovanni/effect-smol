import { assert, describe, it } from "vitest"
import * as Channel from "../src/Channel.js"
import * as Effect from "../src/Effect.js"

describe("Channel", () => {
  it("succeed", () =>
    Effect.gen(function*() {
      const result = yield* Channel.succeed(1).pipe(Channel.runCollect)
      assert.deepStrictEqual(result, [1])
    }).pipe(Effect.runPromise))
})
