/// <reference types="vite/client" />

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

// The onnxruntime-web build pinned by parakeet.js, reached through the `parakeet-ort-dist` alias in vite.config.ts
declare module 'parakeet-ort-dist/ort.bundle.min.mjs' {
  export const env: { wasm: { wasmPaths?: string | { mjs?: string; wasm?: string } } };
}

/** The app version from package.json, injected by vite.config.ts */
declare const __APP_VERSION__: string;
