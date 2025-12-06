declare module 'gif-encoder-2' {
  class GifEncoder {
    constructor(width: number, height: number, algorithm?: string, useOptimizer?: boolean);
    setDelay(delay: number): void;
    setRepeat(repeat: number): void;
    setQuality(quality: number): void;
    setTransparent(color: number): void;
    start(): void;
    addFrame(ctx: CanvasRenderingContext2D | Buffer | Uint8Array): void;
    finish(): void;
    out: {
      getData(): Buffer;
    };
  }
  export default GifEncoder;
}

