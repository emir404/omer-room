import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // R3F scene code mutates three.js objects (materials, transforms, the canvas cursor) by
    // design; React Compiler's immutability rule doesn't model that. DOM components keep it.
    files: ["src/components/room/**/*.{ts,tsx}"],
    rules: { "react-hooks/immutability": "off" },
  },
  {
    ignores: [".next/**", "node_modules/**", "public/**", "art/**", "playwright-report/**", "test-results/**", "next-env.d.ts"],
  },
];

export default config;
