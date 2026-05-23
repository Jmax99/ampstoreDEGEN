/**
 * AMPALIENMAXXING — Printful Order API Route
 * ────────────────────────────────────────────
 * Vercel Serverless Function: /api/order
 *
 * Receives order data from the frontend and securely
 * submits it to Printful. Your API key never touches the browser.
 *
 * Usage:  POST /api/order
 * Body:   { recipient: {...}, items: [...] }
 * Returns: Printful order confirmation object
 */

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const apiKey = process.env.PRINTFUL_API_KEY;

  if (!apiKey) {
    console.error("[AMPALIENMAXXING] PRINTFUL_API_KEY is not set in environment variables.");
    return res.status(500).json({
      error: "Server misconfiguration: Printful API key is missing.",
    });
  }

  // ── Parse & validate request body ────────────────────────────────────────
  const { recipient, items } = req.body || {};

  if (!recipient || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: "Invalid order payload. Must include recipient and items array.",
    });
  }

  // Validate required recipient fields
  const requiredFields = ["name", "address1", "city", "zip", "country_code"];
  for (const field of requiredFields) {
    if (!recipient[field] || String(recipient[field]).trim() === "") {
      return res.status(400).json({
        error: `Missing required recipient field: ${field}`,
      });
    }
  }

  // Validate each item
  for (const item of items) {
    if (!item.variant_id || !item.quantity) {
      return res.status(400).json({
        error: "Each item must have a variant_id and quantity.",
      });
    }
  }

  // ── Build Printful order payload ──────────────────────────────────────────
  const printfulOrder = {
    recipient: {
      name:         String(recipient.name).trim(),
      email:        recipient.email ? String(recipient.email).trim() : undefined,
      address1:     String(recipient.address1).trim(),
      address2:     recipient.address2 ? String(recipient.address2).trim() : undefined,
      city:         String(recipient.city).trim(),
      state_code:   recipient.state_code ? String(recipient.state_code).trim() : undefined,
      zip:          String(recipient.zip).trim(),
      country_code: String(recipient.country_code).trim().toUpperCase(),
    },
    items: items.map(item => ({
      variant_id:   item.variant_id,
      quantity:     Number(item.quantity) || 1,
      retail_price: item.retail_price ? String(item.retail_price) : undefined,
      name:         item.name ? String(item.name) : undefined,
    })),
    // Set to false to create a DRAFT order (won't charge/ship)
    // Set to true  to create a LIVE order  (charges and ships immediately)
    confirm: true,
  };

  // ── Submit to Printful ────────────────────────────────────────────────────
  try {
    const response = await fetch("https://api.printful.com/orders", {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(printfulOrder),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || data?.result || "Printful API error";
      console.error("[AMPALIENMAXXING] Printful order error:", errMsg, data);
      return res.status(response.status).json({ error: errMsg });
    }

    console.log(
      `[AMPALIENMAXXING] Order created: #${data.result?.id} for ${recipient.name}`
    );

    return res.status(200).json({ result: data.result });

  } catch (err) {
    console.error("[AMPALIENMAXXING] Unexpected error in /api/order:", err);
    return res.status(500).json({ error: "Internal server error: " + err.message });
  }
}
