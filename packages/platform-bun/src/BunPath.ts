/**
 * @since 1.0.0
 */
import * as NodePath from "@effect/platform-node-shared/NodePath"
import type { Layer } from "effect/Layer"
import type { Path } from "effect/Path"

/**
 * @since 1.0.0
 * @category layer
 */
export const layer: Layer<Path> = NodePath.layer

/**
 * @since 1.0.0
 * @category layer
 */
export const layerPosix: Layer<Path> = NodePath.layerPosix

/**
 * @since 1.0.0
 * @category layer
 */
export const layerWin32: Layer<Path> = NodePath.layerWin32
