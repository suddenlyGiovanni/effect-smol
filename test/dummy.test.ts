import * as Channel from "effect/Channel"
import * as Effect from "effect/Effect"
import { assert, describe, it } from "vitest"

describe("Channel", () => {
  it("succeed", () =>
    Effect.gen(function*() {
      const result = yield* Channel.succeed(1).pipe(Channel.runCollect)
      assert.deepStrictEqual(result, [1])
    }).pipe(Effect.runPromise))
})
