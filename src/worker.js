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
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) return new Response("<!doctype html><html lang=\"id\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"theme-color\" content=\"#111827\"><title>Upload Gambar</title><style>*{box-sizing:border-box}body{margin:0;background:#f3f4f6;color:#111827;font:16px/1.5 system-ui,sans-serif}main{max-width:560px;margin:36px auto;padding:16px}.panel{background:white;border:1px solid #e5e7eb;border-radius:18px;padding:24px;box-shadow:0 8px 30px #1118270a}h1{font-size:25px;margin:0 0 8px}p{color:#6b7280;margin:0 0 22px}.pick{display:block;border:2px dashed #cbd5e1;border-radius:14px;padding:28px 18px;text-align:center;cursor:pointer;background:#f8fafc}input[type=file]{display:none}img{display:none;width:100%;max-height:340px;object-fit:contain;margin-top:18px;border-radius:12px;background:#f3f4f6}input[type=text]{width:100%;padding:13px;border:1px solid #d1d5db;border-radius:10px;font:inherit;margin-top:16px}button{width:100%;border:0;border-radius:10px;padding:14px;font:600 16px system-ui;cursor:pointer;margin-top:16px;background:#111827;color:white}button:disabled{opacity:.5;cursor:not-allowed}.result{display:none;margin-top:18px;padding:14px;border-radius:10px;background:#ecfdf5;overflow-wrap:anywhere}.result a{color:#047857}#status{margin-top:14px;font-size:14px;color:#4b5563;white-space:pre-wrap}.hint{font-size:13px;margin-top:12px}@media(max-width:600px){main{margin:12px auto}.panel{padding:20px}}</style></head><body><main><section class=\"panel\"><h1>Upload gambar</h1><p>Pilih foto, lihat pratinjau, lalu unggah.</p><label class=\"pick\" for=\"file\">📷<br><strong>Pilih gambar dari perangkat</strong><br><small>JPG, PNG, atau WebP · Maksimal 8 MB</small></label><input id=\"file\" type=\"file\" accept=\"image/jpeg,image/png,image/webp\"><img id=\"preview\" alt=\"Pratinjau gambar\"><input id=\"filename\" type=\"text\" maxlength=\"80\" placeholder=\"Nama file (opsional), contoh: murai-batu\"><button id=\"upload\" disabled>Unggah gambar</button><div id=\"status\" role=\"status\"></div><div class=\"result\" id=\"result\"><strong>Gambar berhasil diunggah.</strong><br><a id=\"url\" target=\"_blank\" rel=\"noopener\">Buka gambar</a><button id=\"copy\" type=\"button\">Salin URL gambar</button></div><p class=\"hint\">Saran: gunakan nama file yang singkat dan sesuai isi gambar.</p></section></main><script>const fi=document.querySelector('#file'),pv=document.querySelector('#preview'),up=document.querySelector('#upload'),st=document.querySelector('#status'),fn=document.querySelector('#filename'),rs=document.querySelector('#result'),ur=document.querySelector('#url');let selected=null;fi.addEventListener('change',()=>{selected=fi.files?.[0]||null;rs.style.display='none';st.textContent='';if(!selected){up.disabled=true;pv.style.display='none';return}if(!selected.type.startsWith('image/')){st.textContent='File harus berupa gambar.';selected=null;up.disabled=true;return}if(selected.size>8*1024*1024){st.textContent='Ukuran gambar maksimal 8 MB.';selected=null;up.disabled=true;pv.style.display='none';return}pv.src=URL.createObjectURL(selected);pv.style.display='block';up.disabled=false;if(!fn.value)fn.value=selected.name.replace(/\\.[^.]+$/,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()});up.addEventListener('click',async()=>{if(!selected)return;up.disabled=true;st.textContent='Mengunggah gambar…';try{const fd=new FormData();fd.append('file',selected);fd.append('filename',fn.value);const res=await fetch('/api/upload',{method:'POST',body:fd});const data=await res.json();if(!res.ok)throw new Error(data.error||'Upload gagal.');ur.href=data.url;ur.textContent=data.url;rs.style.display='block';st.textContent='Selesai. Salin URL untuk digunakan di artikel.'}catch(e){st.textContent=e.message||'Terjadi kesalahan.'}finally{up.disabled=false}});document.querySelector('#copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(ur.href);st.textContent='URL berhasil disalin.'}catch{st.textContent='Salin URL dari tautan di atas.'}});</script></body></html>", { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    return new Response("Not found", { status: 404 });
  }
};