import * as Channel from "effect/Channel"
import * as Effect from "effect/Effect"
import * as Arr from "effect/Array"
import * as Chunk from "effect/Chunk"

// const abc = Channel.asyncPush<string>(
//   Effect.fnUntraced(function* (emit) {
//     yield* Effect.addFinalizer(() =>
//       Effect.sync(() => console.log("finalizer")),
//     )
//     emit.single("a")
//     emit.single("b")
//     emit.single("c")
//     emit.end()
//   }),
// )
//
// Effect.gen(function* () {
//   console.log(
//     yield* Channel.runCollect(
//       Channel.mergeAll({ concurrency: 2 })(
//         Channel.fromIterable([abc, abc, abc, abc, abc]),
//       ),
//     ),
//   )
// }).pipe(Effect.runFork)

console.time("smol")
Channel.fromIterableChunk(Arr.range(0, 10_000_000)).pipe(
  Channel.map(Chunk.map((n) => n + 1)),
  Channel.runDrain,
  Effect.runSync,
)
console.timeEnd("smol")
