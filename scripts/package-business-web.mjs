import fs from "node:fs";
import { execFileSync } from "node:child_process";
const dir = "business/dist";
if (!fs.existsSync(dir + "/index.html"))
  throw new Error("Exportă Business înainte de împachetare.");
fs.copyFileSync("business/hosting/.htaccess", dir + "/.htaccess");
fs.writeFileSync(
  dir + "/manifest.webmanifest",
  JSON.stringify({
    name: "CeFaci Business",
    short_name: "Business",
    lang: "ro",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#E8EBF2",
    theme_color: "#0E1440",
  }),
);
const sha = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
fs.writeFileSync(
  dir + "/version.json",
  JSON.stringify({ commit: sha, build: new Date().toISOString() }),
);
let html = fs
  .readFileSync(dir + "/index.html", "utf8")
  .replace('<html lang="en">', '<html lang="ro">')
  .replace("<title>CeFaci Business</title>", "<title>CeFaci Business</title>");
if (!html.includes('rel="manifest"')) html = html.replace(
  "</head>",
  '<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#0E1440"><style>@media print{body{background:white}button,input{display:none}} :focus-visible{outline:3px solid #2F5BFF;outline-offset:3px}</style></head>',
);
fs.writeFileSync(dir + "/index.html", html);
// Managed workspaces can export with umask 077; Apache must be able to read the static package.
function publicPermissions(path) {
  fs.chmodSync(path, 0o755);
  for (const item of fs.readdirSync(path, { withFileTypes: true })) {
    const child = path + "/" + item.name;
    if (item.isDirectory()) publicPermissions(child);
    else if (item.isFile()) fs.chmodSync(child, 0o644);
    else throw new Error("Asset neașteptat: " + child);
  }
}
publicPermissions(dir);
fs.mkdirSync("release", { recursive: true });
fs.rmSync("release/CeFaci-Business-web.zip", { force: true });
execFileSync("zip", ["-qr", "../../release/CeFaci-Business-web.zip", "."], {
  cwd: dir,
});
console.log("release/CeFaci-Business-web.zip · " + sha);
