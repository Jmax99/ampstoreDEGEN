/**
 * AMPALIENMAXXING — Printful Order Integration
 * ─────────────────────────────────────────────
 * This file handles:
 *  1. Loading products from Printful API (via your Vercel serverless proxy)
 *  2. Rendering product cards on the landing page
 *  3. Collecting order info and submitting orders to Printful
 *
 * ⚠️  IMPORTANT SETUP STEPS:
 *  1. Add your Printful API key to Vercel environment variables:
 *       PRINTFUL_API_KEY = your_printful_api_key_here
 *
 *  2. Deploy the /api/ serverless functions (included below as comments)
 *     to your Vercel project. These act as a secure proxy so your API key
 *     is NEVER exposed in the browser.
 *
 *  3. Replace STORE_ID below with your Printful store ID.
 */

// ── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  storeId: "YOUR_PRINTFUL_STORE_ID",   // ← Replace with your Printful Store ID
  currency: "USD",
  shipping: {
    name: "PRINTFUL_SHIPPING",          // Printful shipping method code
  }
};

// ── STATE ────────────────────────────────────────────────────────────────────
let selectedProduct = null;
let selectedVariant = null;
let selectedSize    = null;
let catalog         = [];

// ── DOM REFS ─────────────────────────────────────────────────────────────────
const grid       = document.getElementById("products-grid");
const modal      = document.getElementById("orderModal");
const closeBtn   = document.getElementById("closeModal");
const submitBtn  = document.getElementById("submitOrder");
const statusMsg  = document.getElementById("statusMsg");
const sizePicker = document.getElementById("size-picker");

// ── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  bindModalEvents();
});

// ── LOAD PRODUCTS ─────────────────────────────────────────────────────────────
async function loadProducts() {
  try {
    // Calls your Vercel serverless proxy → /api/products
    const res  = await fetch("/api/products");
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Failed to load products");

    catalog = data.result || [];
    renderProducts(catalog);
  } catch (err) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:3rem;color:#ff2d2d;font-size:0.75rem;letter-spacing:0.1em;">
        ⚠ Could not load products. Check your Printful API key and /api/products route.<br/>
        <small style="opacity:0.5;">${err.message}</small>
      </div>`;
  }
}

// ── RENDER PRODUCTS ───────────────────────────────────────────────────────────
function renderProducts(products) {
  if (!products.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:#555;font-size:0.75rem;">
      No products found in your Printful store yet.
    </div>`;
    return;
  }

  grid.innerHTML = products.map((p, i) => {
    const thumb  = p.thumbnail_url || "";
    const price  = p.variants?.[0]?.retail_price
      ? `$${parseFloat(p.variants[0].retail_price).toFixed(2)}`
      : "—";
    const isNew  = i === 0;

    return `
      <div class="product-card" data-id="${p.id}" onclick="openOrder(${p.id})">
        ${isNew ? '<span class="product-badge">New</span>' : ""}
        <div class="product-thumb">
          ${thumb
            ? `<img src="${escHtml(thumb)}" alt="${escHtml(p.name)}" loading="lazy" />`
            : escHtml(p.name.slice(0, 3).toUpperCase())}
        </div>
        <div class="product-info">
          <p class="product-name">${escHtml(p.name)}</p>
          <p class="product-price">${price}</p>
        </div>
        <button class="add-btn" onclick="event.stopPropagation(); openOrder(${p.id})">
          → Order Now
        </button>
      </div>`;
  }).join("");
}

// ── OPEN ORDER MODAL ──────────────────────────────────────────────────────────
function openOrder(productId) {
  selectedProduct = catalog.find(p => p.id === productId);
  if (!selectedProduct) return;

  selectedVariant = null;
  selectedSize    = null;

  // Populate size picker from variants
  const sizes = [...new Set(
    (selectedProduct.variants || []).map(v => v.size).filter(Boolean)
  )];

  sizePicker.innerHTML = sizes.length
    ? sizes.map(s => `<button class="size-btn" data-size="${escHtml(s)}">${escHtml(s)}</button>`).join("")
    : `<button class="size-btn active" data-size="ONE SIZE">ONE SIZE</button>`;

  // Bind size button clicks
  sizePicker.querySelectorAll(".size-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      sizePicker.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedSize = btn.dataset.size;
      // Find matching variant
      selectedVariant = (selectedProduct.variants || []).find(v => v.size === selectedSize)
        || selectedProduct.variants?.[0] || null;
      updateSummary();
    });
  });

  // Auto-select first size
  const first = sizePicker.querySelector(".size-btn");
  if (first) first.click();

  // Modal title
  document.getElementById("modal-product-name").textContent =
    `${selectedProduct.name} · ${
      selectedProduct.variants?.[0]?.retail_price
        ? `$${parseFloat(selectedProduct.variants[0].retail_price).toFixed(2)}`
        : "—"
    }`;

  clearStatus();
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}

// ── UPDATE SUMMARY ────────────────────────────────────────────────────────────
function updateSummary() {
  if (!selectedProduct) return;
  const price = selectedVariant?.retail_price
    ? `$${parseFloat(selectedVariant.retail_price).toFixed(2)}`
    : "—";
  document.getElementById("sum-product").textContent = selectedProduct.name;
  document.getElementById("sum-size").textContent    = selectedSize || "—";
  document.getElementById("sum-total").textContent   = price;
}

// ── CLOSE MODAL ───────────────────────────────────────────────────────────────
function closeModal() {
  modal.classList.remove("open");
  document.body.style.overflow = "";
}

// ── BIND MODAL EVENTS ─────────────────────────────────────────────────────────
function bindModalEvents() {
  closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
  submitBtn.addEventListener("click", submitOrder);
}

// ── SUBMIT ORDER ──────────────────────────────────────────────────────────────
async function submitOrder() {
  clearStatus();

  // Gather & validate form
  const firstName = val("firstName");
  const lastName  = val("lastName");
  const email     = val("email");
  const address1  = val("address1");
  const address2  = val("address2");
  const city      = val("city");
  const state     = val("state");
  const zip       = val("zip");
  const country   = val("country").toUpperCase();

  if (!firstName || !lastName || !email || !address1 || !city || !zip || !country) {
    showStatus("Please fill in all required fields.", "error"); return;
  }
  if (!email.includes("@")) {
    showStatus("Please enter a valid email address.", "error"); return;
  }
  if (!selectedVariant) {
    showStatus("Please select a size.", "error"); return;
  }

  // Build Printful order payload
  const orderPayload = {
    recipient: {
      name:         `${firstName} ${lastName}`,
      email:        email,
      address1:     address1,
      address2:     address2,
      city:         city,
      state_code:   state,
      zip:          zip,
      country_code: country,
    },
    items: [
      {
        variant_id:   selectedVariant.id,
        quantity:     1,
        retail_price: selectedVariant.retail_price,
      }
    ]
  };

  // Disable button while submitting
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span> Sending Order...';

  try {
    const res  = await fetch("/api/order", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(orderPayload),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Order failed");

    showStatus(
      `✓ Order #${data.result?.id || "submitted"} confirmed! Check your email for updates.`,
      "success"
    );
    submitBtn.disabled = false;
    submitBtn.innerHTML = "Place Order";

    // Reset form after 4s
    setTimeout(() => { closeModal(); resetForm(); }, 4000);

  } catch (err) {
    showStatus(`✗ ${err.message}`, "error");
    submitBtn.disabled = false;
    submitBtn.innerHTML = "Place Order";
  }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function val(id) { return (document.getElementById(id)?.value || "").trim(); }

function showStatus(msg, type) {
  statusMsg.textContent  = msg;
  statusMsg.className    = `status-msg ${type}`;
  statusMsg.style.display = "block";
}

function clearStatus() {
  statusMsg.textContent  = "";
  statusMsg.className    = "status-msg";
  statusMsg.style.display = "none";
}

function resetForm() {
  ["firstName","lastName","email","address1","address2","city","state","zip","country"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}


/* ═══════════════════════════════════════════════════════════════════════════
   VERCEL SERVERLESS API ROUTES
   ───────────────────────────────────────────────────────────────────────────
   Create these two files in your project:

   📁 api/
      products.js    ← fetches your Printful store products
      order.js       ← creates an order in Printful

   ─────────────────────────────────────────────────────────────────────────
   FILE: api/products.js
   ─────────────────────────────────────────────────────────────────────────
   export default async function handler(req, res) {
     try {
       const response = await fetch(
         "https://api.printful.com/store/products",
         {
           headers: {
             Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
             "Content-Type": "application/json",
           },
         }
       );
       const data = await response.json();
       if (!response.ok) throw new Error(data.error?.message || "Printful error");
       res.status(200).json(data);
     } catch (err) {
       res.status(500).json({ error: err.message });
     }
   }

   ─────────────────────────────────────────────────────────────────────────
   FILE: api/order.js
   ─────────────────────────────────────────────────────────────────────────
   export default async function handler(req, res) {
     if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
     try {
       const response = await fetch(
         "https://api.printful.com/orders",
         {
           method: "POST",
           headers: {
             Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
             "Content-Type": "application/json",
           },
           body: JSON.stringify(req.body),
         }
       );
       const data = await response.json();
       if (!response.ok) throw new Error(data.error?.message || "Order failed");
       res.status(200).json(data);
     } catch (err) {
       res.status(500).json({ error: err.message });
     }
   }

   ─────────────────────────────────────────────────────────────────────────
   VERCEL ENV VARIABLES (in vercel.com → Project → Settings → Environment)
   ─────────────────────────────────────────────────────────────────────────
   PRINTFUL_API_KEY = your_printful_api_key_here

   ═══════════════════════════════════════════════════════════════════════════ */
