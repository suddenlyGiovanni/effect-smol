import * as Arr from "effect/Array"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"

const stream = Stream.fromIterable(Arr.range(1, 100_000)).pipe(
  Stream.flatMap((i) => Stream.succeed(i + 1))
)

Effect.runSync(Stream.runCount(stream))

console.time("smol take")
stream.pipe(
  Stream.runCollect,
  Effect.runSync,
  console.log
)
console.timeEnd("smol take")
