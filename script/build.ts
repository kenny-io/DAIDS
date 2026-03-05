import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, writeFile, cp, mkdir } from "fs/promises";
import { Resvg } from "@resvg/resvg-js";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "@supabase/supabase-js",
  "axios",
  "cheerio",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "p-limit",
  "passport",
  "passport-local",
  "pdfkit",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("generating og-preview.png...");
  try {
    const svgContent = await readFile("client/public/og-preview.svg", "utf-8");
    const resvg = new Resvg(svgContent, { fitTo: { mode: "width", value: 1200 } });
    const pngBuffer = resvg.render().asPng();
    await writeFile("client/public/og-preview.png", pngBuffer);
    console.log(`og-preview.png generated (${pngBuffer.length} bytes)`);
  } catch (err) {
    console.warn("og-preview.png generation failed:", err);
  }

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // pdfkit reads font .afm files via __dirname at runtime; copy them so they
  // resolve correctly relative to dist/index.cjs
  console.log("copying pdfkit font data...");
  await mkdir("dist/data", { recursive: true });
  await cp("node_modules/pdfkit/js/data", "dist/data", { recursive: true });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
