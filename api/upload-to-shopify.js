import formidable from "formidable";
import fs from "fs";
import fetch from "node-fetch";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const form = new formidable.IncomingForm();
  form.keepExtensions = true;

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("form parse error", err);
      return res.status(500).json({ error: "Form parse error" });
    }

    try {
      const fileEntries = [];
      for (const key of Object.keys(files)) {
        const val = files[key];
        if (Array.isArray(val)) fileEntries.push(...val);
        else fileEntries.push(val);
      }

      const SHOPIFY_STORE = process.env.SHOPIFY_STORE; // e.g. your-store.myshopify.com
      const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

      if (!SHOPIFY_STORE || !ACCESS_TOKEN) {
        return res.status(500).json({ error: "Missing environment variables" });
      }

      const uploadedUrls = [];

      for (const f of fileEntries) {
        const data = fs.readFileSync(f.filepath);
        const base64 = data.toString("base64");

        const shopifyRes = await fetch(
          `https://${SHOPIFY_STORE}/admin/api/2024-10/files.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": ACCESS_TOKEN
            },
            body: JSON.stringify({
              file: {
                attachment: base64,
                filename: f.originalFilename
              }
            })
          }
        );

        if (!shopifyRes.ok) {
          const text = await shopifyRes.text();
          console.error("Shopify API error:", shopifyRes.status, text);
          return res.status(502).json({ error: "Shopify API error", details: text });
        }

        const json = await shopifyRes.json();
        if (json && json.file && json.file.public_url) {
          uploadedUrls.push(json.file.public_url);
        } else {
          uploadedUrls.push(json);
        }
      }

      return res.json({ success: true, urls: uploadedUrls });

    } catch (e) {
      console.error("upload error", e);
      return res.status(500).json({ error: "Upload failed", details: e.message });
    }
  });
}