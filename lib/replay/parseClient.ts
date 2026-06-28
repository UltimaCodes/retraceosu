import type { ParsedSummary, ParseResponse } from "./types";

// runs the decode off the main thread so the UI never blocks on big replays
export function parseReplay(
  osuText: string,
  osrBuffer: ArrayBuffer,
): Promise<ParsedSummary> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./parse.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<ParseResponse>) => {
      worker.terminate();
      if (e.data.ok) resolve(e.data.summary);
      else reject(new Error(e.data.error));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "worker failed"));
    };
    worker.postMessage({ osuText, osrBuffer }, [osrBuffer]);
  });
}
