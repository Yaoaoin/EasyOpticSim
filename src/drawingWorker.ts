import { createDrawingPdf } from "./drawingPdf";
import type { DrawingSnapshot } from "./drawing";
self.onmessage = async (
  event: MessageEvent<{ snapshot: DrawingSnapshot; font: Uint8Array }>,
) => {
  try {
    const bytes = await createDrawingPdf(event.data.snapshot, event.data.font);
    self.postMessage({ bytes }, { transfer: [bytes.buffer as ArrayBuffer] });
  } catch (e) {
    self.postMessage({ error: e instanceof Error ? e.message : String(e) });
  }
};
