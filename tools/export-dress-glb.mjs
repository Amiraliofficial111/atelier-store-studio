import fs from "node:fs";
import path from "node:path";
import { Blob } from "node:buffer";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { buildHangingDress, buildHangingShirt, buildHangingPants, buildHangingBlazer } from "../js/garments.js";

globalThis.Blob = Blob;
globalThis.FileReader = class FileReader {
  result = null;
  onload = null;
  onloadend = null;
  readAsArrayBuffer(blob) {
    Promise.resolve(blob.arrayBuffer()).then((buf) => {
      this.result = buf;
      const ev = { target: this };
      this.onload?.(ev);
      this.onloadend?.(ev);
    });
  }
};

const OUT = path.resolve("models/dresses");
fs.mkdirSync(OUT, { recursive: true });

async function writeGlb(name, object) {
  const exporter = new GLTFExporter();
  const data = await exporter.parseAsync(object, { binary: true });
  const file = path.join(OUT, `${name}.glb`);
  fs.writeFileSync(file, Buffer.from(data));
  console.log("wrote", file, fs.statSync(file).size);
}

await writeGlb("dress-aline", buildHangingDress(0, true));
await writeGlb("dress-midi", buildHangingDress(1, true));
await writeGlb("dress-gown", buildHangingDress(2, true));
await writeGlb("dress-shirtdress", buildHangingDress(3, true));
await writeGlb("shirt", buildHangingShirt(true));
await writeGlb("pants", buildHangingPants(true));
await writeGlb("blazer", buildHangingBlazer(true));
