declare module 'opus-recorder' {
  export default class Recorder {
    constructor(options?: Record<string, unknown>);
    start(): Promise<void>;
    stop(): Promise<void>;
    pause(): void;
    resume(): void;
    ondataavailable: (data: Uint8Array) => void;
  }
}
