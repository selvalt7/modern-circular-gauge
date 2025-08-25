import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";

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
      json(),
      commonjs(),
      babel({
        exclude: /node_modules\/(?!lit)(?!@lit)/,
        babelHelpers: "bundled",
        compact: true,
        extensions: [".js", ".ts"],
        presets: [
          [
            "@babel/env",
            {
              "modules": false,
            },
          ],
        ],
        comments: false,
      }),
    ],
  }
]