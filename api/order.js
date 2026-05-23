export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body;

  // SINGLE VARIANT ONLY (your new Printful product)
  const variant_id = "6a11d63347c9c2";

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
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
