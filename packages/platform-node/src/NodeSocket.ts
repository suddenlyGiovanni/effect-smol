/**
 * @since 1.0.0
 */
import { NodeWS as WS } from "@effect/platform-node-shared/NodeSocket"
import * as Layer from "effect/services/Layer"
import * as Socket from "effect/unstable/socket/Socket"

/**
 * @since 1.0.0
 */
export * from "@effect/platform-node-shared/NodeSocket"

/**
 * @since 1.0.0
 * @category layers
 */
export const layerWebSocket = (url: string, options?: {
  readonly closeCodeIsError?: (code: number) => boolean
}): Layer.Layer<Socket.Socket> =>
  Layer.effect(Socket.Socket, Socket.makeWebSocket(url, options)).pipe(
    Layer.provide(layerWebSocketConstructor)
  )

/**
 * @since 1.0.0
 * @category layers
 */
export const layerWebSocketConstructor: Layer.Layer<Socket.WebSocketConstructor> = Layer.sync(
  Socket.WebSocketConstructor,
  () => {
    if ("WebSocket" in globalThis) {
      return (url, protocols) => new globalThis.WebSocket(url, protocols)
    }
    return (url, protocols) => new WS.WebSocket(url, protocols) as unknown as globalThis.WebSocket
  }
)
