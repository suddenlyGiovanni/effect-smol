import * as Arr from "effect/Array"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"

console.time("Chunk")
Stream.fromIterable(Arr.range(1, 10_000)).pipe(
  Stream.mapEffect((i) => Effect.succeed(i + 1), { concurrency: "unbounded", unordered: true }),
  Stream.mapEffect((i) => Effect.succeed(i + 1), { concurrency: "unbounded", unordered: true }),
  Stream.mapEffect((i) => Effect.succeed(i + 1), { concurrency: "unbounded", unordered: true }),
  Stream.runCount,
  Effect.runSync,
  console.log
)
console.timeEnd("Chunk")
