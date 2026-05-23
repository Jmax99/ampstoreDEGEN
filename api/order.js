export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body;

  // SIZE → VARIANT MAP (your current IDs)
  const variants = {
    XS: "6a11c0f7696d44",
    S:  "6a11c0f7696de5",
    M:  "6a11c0f7696e72",
    L:  "6a11c0f7696ef7",
    XL: "6a11c0f7696f73",
    "2XL": "6a11c0f7697006"
  };

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
        variant_id: variants[body.size],
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

    if (!response.ok) {
      console.log("PRINTFUL FAILED ❌");

      return res.status(500).json({
        success: false,
        error: text
      });
    }

    console.log("PRINTFUL SUCCESS ✔");

    return res.status(200).json({
      success: true,
      printful: JSON.parse(text)
    });

  } catch (err) {
    console.log("SERVER ERROR ❌", err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
