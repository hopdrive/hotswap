// Type declarations for virtual:hotswap-releases provided by hotswapMDXPlugin.
// Add this to your tsconfig.json `include` or reference it with a triple-slash directive.

declare module 'virtual:hotswap-releases' {
  import type { CompiledRelease } from '@hopdrive/hotswap';
  export const releases: CompiledRelease[];
}
