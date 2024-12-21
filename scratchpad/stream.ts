import * as Arr from "effect/Array"
import * as Effect from "effect/Effect"
import * as Sink from "effect/Sink"
import * as Stream from "effect/Stream"

console.time("Chunk")
Stream.fromIterable(Arr.range(1, 100_000)).pipe(
  Stream.mapEffect((i) => Effect.succeed(i + 1)),
  Stream.mapEffect((i) => Effect.succeed(i + 1)),
  Stream.mapEffect((i) => Effect.succeed(i + 1)),
  Stream.run(Sink.forEach((chunk) => Effect.sync(() => console.log(chunk)))),
  Effect.runSync
)
console.timeEnd("Chunk")
