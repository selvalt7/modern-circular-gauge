import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default [
  {
    input: ["src/main.ts"],
    output: [
      {
        file: "dist/modern-circular-gauge.js",
        format: "es",
        inlineDynamicImports: true,
      },
    ],
    plugins: [
      typescript({
        declaration: false,
      }),
      nodeResolve(),
      commonjs(),
      babel({
        exclude: "node_modules/**",
        babelHerpers: "bundled",
      }),
    ],
  }
]