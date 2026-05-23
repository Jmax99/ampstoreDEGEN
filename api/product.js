/**
 * AMPALIENMAXXING — Printful Products API Route
 * ───────────────────────────────────────────────
 * Vercel Serverless Function: /api/products
 *
 * Acts as a secure proxy between the browser and Printful API.
 * Your PRINTFUL_API_KEY is never exposed to the client.
 *
 * Usage:  GET /api/products
 * Returns: Array of store products from Printful
 */

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const apiKey = process.env.PRINTFUL_API_KEY;

  if (!apiKey) {
    console.error("[AMPALIENMAXXING] PRINTFUL_API_KEY is not set in environment variables.");
    return res.status(500).json({
      error: "Server misconfiguration: Printful API key is missing.",
    });
  }

  try {
    // Fetch all products in your Printful store
    const response = await fetch("https://api.printful.com/store/products", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || "Printful API error";
      console.error("[AMPALIENMAXXING] Printful products error:", errMsg);
      return res.status(response.status).json({ error: errMsg });
    }

    // For each product summary, optionally fetch full variant details
    // Printful's /store/products returns lightweight items; we enrich them here.
    const products = data.result || [];

    const enriched = await Promise.all(
      products.map(async (product) => {
        try {
          const detailRes = await fetch(
            `https://api.printful.com/store/products/${product.id}`,
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
            }
          );
          const detailData = await detailRes.json();

          if (!detailRes.ok) return product; // fallback to summary if detail fails

          const syncProduct = detailData.result?.sync_product || {};
          const syncVariants = detailData.result?.sync_variants || [];

          return {
            id:            syncProduct.id,
            name:          syncProduct.name,
            thumbnail_url: syncProduct.thumbnail_url,
            variants: syncVariants.map((v) => ({
              id:           v.id,
              name:         v.name,
              size:         v.size,
              color:        v.color,
              retail_price: v.retail_price,
              currency:     v.currency,
              is_enabled:   v.is_enabled,
              availability_status: v.availability_status,
            })),
          };
        } catch {
          return product; // fallback to summary on any error
        }
      })
    );

    // Set cache headers — cache for 5 minutes to avoid hammering Printful
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

    return res.status(200).json({ result: enriched });

  } catch (err) {
    console.error("[AMPALIENMAXXING] Unexpected error in /api/products:", err);
    return res.status(500).json({ error: "Internal server error: " + err.message });
  }
}
