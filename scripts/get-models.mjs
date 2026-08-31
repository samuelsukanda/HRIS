// Unduh model face-api ke public/models — jalankan: node scripts/get-models.mjs
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";

const BASE = "https://raw.githubusercontent.com/vladmandic/face-api/master/model";
const MODELS = ["tiny_face_detector_model", "face_landmark_68_model", "face_recognition_model"];
const OUT = join(process.cwd(), "public", "models");

await mkdir(OUT, { recursive: true });

for (const name of MODELS) {
  const manifestRes = await fetch(`${BASE}/${name}-weights_manifest.json`);
  if (!manifestRes.ok) throw new Error(`Gagal ambil manifest ${name}: ${manifestRes.status}`);
  const manifest = await manifestRes.json();
  await writeFile(join(OUT, `${name}-weights_manifest.json`), JSON.stringify(manifest));
  const paths = [...new Set(manifest.flatMap((m) => m.paths ?? []))];
  for (const p of paths) {
    const bin = Buffer.from(await (await fetch(`${BASE}/${p}`)).arrayBuffer());
    await writeFile(join(OUT, p), bin);
    console.log(`${p}: ${(bin.length / 1024 / 1024).toFixed(2)} MB`);
  }
}
console.log("Model selesai diunduh ke public/models");
