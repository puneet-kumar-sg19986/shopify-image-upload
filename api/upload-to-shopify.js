import formidable from "formidable";
import fs from "fs";
import fetch from "node-fetch";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only POST allowed
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  // Parse incoming form-data
  const form = new formidable.IncomingForm();
  form.keepExtensions = true;

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Form parse error:", err);
      return res.status(500).json({ error: "Form parse error" });
    }

    try {
      // Collect uploaded files
      const fileEntries = [];
      for (const key of Object.keys(files)) {
        const val = files[key];
        if (Array.isArray(val)) fileEntries.push(...val);
        else fileEntries.push(val);
      }

      // Environment variables
      const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
      const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

      if (!SHOPIFY_STORE || !ACCESS_TOKEN) {
        return res
          .status(500)
          .json({ error: "Missing SHOPIFY_STORE or SHOPIFY_ACCESS_TOKEN" });
      }

      const uploadedUrls = [];

      // Upload every file to Shopify
      for (const f of fileEntries) {
        const fileBuffer = fs.readFileSync(f.filepath);
        const base64 = fileBuffer.toString("base64");

        const uploadRes = await fetch(
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

        const data = await uploadRes.json();

        if (!uploadRes.ok) {
          console.error("Shopify API error:", data);
          return res.status(502).json({
            error: "Shopify API error",
            details: data
          });
        }

        uploadedUrls.push(data.file.public_url);
      }

      // Success
      return res.json({
        success: true,
        urls: uploadedUrls
      });
    } catch (error) {
      console.error("Server error:", error);
      return res.status(500).json({
        error: "Upload failed",
        details: error.message
      });
    }
  });
}