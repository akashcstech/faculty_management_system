// Builds public/main.txt: the folder structure of the project followed by every
// source file in the format FILE NAME / COPYPASTE / code / CODE -END.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "main.txt");
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".output", ".nitro", ".tanstack", ".lovable", ".wrangler", ".vinxi", ".workspace", "ui"]);
const SKIP_FILES = new Set(["bun.lock", "bun.lockb", "package-lock.json", "main.txt", "routeTree.gen.ts"]);
const TEXT_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".css", ".md", ".txt", ".html", ".toml", ".yml", ".yaml", ""]);

function walk(dir, prefix, tree, files) {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => !(e.isDirectory() ? SKIP_DIRS.has(e.name) : SKIP_FILES.has(e.name)))
    .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));
  entries.forEach((e, i) => {
    const last = i === entries.length - 1;
    tree.push(`${prefix}${last ? "└── " : "├── "}${e.name}${e.isDirectory() ? "/" : ""}`);
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, prefix + (last ? "    " : "│   "), tree, files);
    else if (TEXT_EXT.has(path.extname(e.name))) files.push(full);
  });
}

export function buildMainTxt() {
  const tree = ["root/"];
  const files = [];
  walk(ROOT, "", tree, files);
  let out = "PROJECT STRUCTURE\n\n" + tree.join("\n") + "\n\n\n";
  for (const f of files) {
    const rel = path.relative(ROOT, f).split(path.sep).join("/");
    out += `FILE NAME: ${rel}\n\nCOPYPASTE\n\n${fs.readFileSync(f, "utf8").replace(/\s+$/, "")}\n\nCODE -END\n\n\n`;
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  if (!fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== out) fs.writeFileSync(OUT, out);
}

if (process.argv[1] && process.argv[1].endsWith("main-txt.mjs")) {
  buildMainTxt();
  console.log("main.txt written to", OUT);
}