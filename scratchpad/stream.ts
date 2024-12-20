import * as Arr from "effect/Array"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"

console.time("Chunk")
Stream.fromIterable(Arr.range(1, 100_000)).pipe(
  Stream.mapEffect((i) => Effect.succeed(i + 1)),
  Stream.mapEffect((i) => Effect.succeed(i + 1)),
  Stream.mapEffect((i) => Effect.succeed(i + 1)),
  Stream.runDrain,
  Effect.runSync
)
console.timeEnd("Chunk")
