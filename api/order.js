export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body;

  // SIZE → VARIANT MAP (IMPORTANT: likely root issue if wrong IDs)
  const variants = {
    XS: "6a11c0f7696d44",
    S:  "6a11c0f7696de5",
    M:  "6a11c0f7696e72",
    L:  "6a11c0f7696ef7",
    XL: "6a11c0f7696f73",
    "2XL": "6a11c0f7697006"
  };

  const variant_id = variants[body.size];

  // SAFETY CHECK (prevents undefined variant errors)
  if (!variant_id) {
    return res.status(400).json({
      success: false,
      error: "Invalid size selected or missing variant_id"
    });
  }

  const payload = {
    recipient: {
      name: body.name,
      address1: body.address,
      city: body.city,
      zip: body.zip,
      country_code: body.country,
      email: body.email
    },
    items: [
      {
        variant_id: variant_id,
        quantity: 1
      }
    ]
  };

  try {
    const response = await fetch("https://api.printful.com/orders", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.PRINTFUL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    console.log("PRINTFUL RAW RESPONSE:", text);

    // 🚨 IMPORTANT: show real error from Printful
    if (!response.ok) {
      return res.status(500).json({
        success: false,
        printful_error: text
      });
    }

    return res.status(200).json({
      success: true,
      printful: JSON.parse(text)
    });

  } catch (err) {
    console.log("SERVER ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
