import { nodeResolve } from "@rollup/plugin-node-resolve"
import terser from "@rollup/plugin-terser"
import esbuild from "rollup-plugin-esbuild"

export default {
  output: {
    format: "cjs"
  },
  plugins: [
    nodeResolve(),
    esbuild(),
    terser({ mangle: true, compress: true })
  ]
}
