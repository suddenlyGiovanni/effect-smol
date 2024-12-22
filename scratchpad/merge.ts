import * as Arr from "effect/Array"
import * as Channel from "effect/Channel"
import * as Effect from "effect/Effect"

const a = Channel.fromIterable(Arr.makeBy(10_000, (_) => "a"))
const b = Channel.fromIterable(Arr.makeBy(10_500, (_) => "b"))

const ab = Channel.mergeAll(Channel.fromIterable([a, b]), { concurrency: "unbounded" })

console.time("smol merge")
ab.pipe(
  Channel.runCount,
  Effect.runSync,
  console.log
)
console.timeEnd("smol merge")
