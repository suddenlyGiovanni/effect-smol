import { Exit, Queue } from "effect"
import * as Channel from "effect/Channel"
import * as Effect from "effect/Effect"

const abc = Channel.async<string>(
  Effect.fnUntraced(function*(mb) {
    yield* Effect.addFinalizer(() => Effect.sync(() => console.log("finalizer")))
    Queue.unsafeOffer(mb, "a")
    Queue.unsafeOffer(mb, "b")
    Queue.unsafeOffer(mb, "c")
    Queue.unsafeDone(mb, Exit.void)
  })
)

Effect.gen(function*() {
  console.log(
    yield* Channel.runCollect(
      Channel.mergeAll({ concurrency: 2 })(
        Channel.fromIterable([abc, abc, abc, abc, abc])
      )
    )
  )
}).pipe(Effect.runFork)
