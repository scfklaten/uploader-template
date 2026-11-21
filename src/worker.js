const MAX_BYTES = 8 * 1024 * 1024;
const MIME_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
function slug(value) {
  return String(value || "gambar")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 70) || "gambar";
}
function toBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/upload" && request.method === "POST") {
      if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
        return json({ error: "Uploader belum dikonfigurasi oleh administrator." }, 503);
      }
      let form;
      try { form = await request.formData(); }
      catch { return json({ error: "Form upload tidak valid." }, 400); }

      const file = form.get("file");
      if (!(file instanceof File)) return json({ error: "Pilih gambar terlebih dahulu." }, 400);
      const ext = MIME_EXT[file.type];
      if (!ext) return json({ error: "Format yang didukung: JPG, PNG, dan WebP." }, 415);
      if (file.size <= 0 || file.size > MAX_BYTES) return json({ error: "Ukuran gambar maksimal 8 MB." }, 413);

      const base = slug(form.get("filename") || file.name.replace(/\.[^.]+$/, ""));
      const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
      const path = `${env.IMAGE_DIR || "public/images"}/${base}-${stamp}.${ext}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const content = toBase64(bytes);
      const branch = env.GITHUB_BRANCH || "main";
      const apiUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;

      let gh;
      try {
        gh = await fetch(apiUrl, {
          method: "PUT",
          headers: {
            "authorization": `Bearer ${env.GITHUB_TOKEN}`,
            "accept": "application/vnd.github+json",
            "content-type": "application/json",
            "x-github-api-version": "2022-11-28",
            "user-agent": "webstatus-image-uploader"
          },
          body: JSON.stringify({
            message: `Upload image: ${base}`,
            content,
            branch
          })
        });
      } catch {
        return json({ error: "Tidak dapat menghubungi GitHub. Coba lagi." }, 502);
      }
      const ghData = await gh.json().catch(() => ({}));
      if (!gh.ok) {
        return json({ error: ghData.message || "GitHub menolak upload. Periksa konfigurasi repository." }, 502);
      }

      const raw = `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${branch}/${path}`;
      return json({ ok: true, path, url: raw });
    }

    if (url.pathname.startsWith("/api/")) return json({ error: "Endpoint tidak ditemukan." }, 404);
    return env.ASSETS.fetch(request);
  }
};