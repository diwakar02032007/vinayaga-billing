const API_BASE_URL =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1" ||
  location.protocol === "file:"
    ? "http://localhost:5000/api"
    : `${location.origin}/api`;

function getToken() {
  return localStorage.getItem("billing_token");
}

async function apiRequest(path, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.message || "API request failed");
  }

  return data;
}
const STORAGE_KEYS = {
  products: 'gst_billpro_products',
  invoices: 'gst_billpro_invoices',
  settings: 'gst_billpro_settings'
};

const defaultSettings = {
  businessName: 'Sri Vinayaga Traders',
  businessTagline: 'Wholesale & Distribution of Quality Food Products',
  businessGstin: '33CORPP3939N1ZQ',
  businessPhone: '9876543210',
  businessEmail: 'vinayagatraders@gmail.com',
  businessWebsite: 'www.vinayagatraders.com',
  businessAddress: 'Hastampatti Salem - 636007',
  bankName: 'ICICI',
  bankAccount: '2715500356',
  bankIfsc: 'ICIC045F',
  upiId: 'diwakar@upi',
  qrImage: '',
  invoicePrefix: 'GST',
  terms: 'Subject to Salem Jurisdiction.\nGoods once sold will not taken back.\nDelivery Ex-Premises.'
};

const defaultProducts = [
  { id: cryptoId(), name: 'Mixture', hsn: '210690', unit: 'NOS', rate: 100, gst: 5, stock: 100, lowStock: 10 },
  { id: cryptoId(), name: 'Lays', hsn: '210690', unit: 'NOS', rate: 10, gst: 5, stock: 100, lowStock: 10 },
  { id: cryptoId(), name: 'Biscuits', hsn: '190590', unit: 'NOS', rate: 30, gst: 5, stock: 100, lowStock: 10 }
];

let state = {
  products: [],
  invoices: [],
  settings: {},
  cart: []
};

let historyUi = {
  search: "",
  from: "",
  to: "",
  page: 1,
  pageSize: 12
};

const $ = (id) => document.getElementById(id);

function cryptoId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function money(value) {
  return '₹' + Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function num(value) {
  return Number(value || 0);
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function financialYearFromDate(dateString = todayISO()) {
  const d = new Date(dateString + 'T00:00:00');
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

function loadState() {
  state.products = JSON.parse(localStorage.getItem(STORAGE_KEYS.products) || 'null') || defaultProducts;
  state.invoices = JSON.parse(localStorage.getItem(STORAGE_KEYS.invoices) || '[]');
  state.settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || 'null') || defaultSettings;
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(state.products));
  localStorage.setItem(STORAGE_KEYS.invoices, JSON.stringify(state.invoices));
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
}

function showLoginScreen() {
  const loginScreen = document.getElementById("loginScreen");
  if (loginScreen) loginScreen.classList.remove("hidden");
}

function hideLoginScreen() {
  const loginScreen = document.getElementById("loginScreen");
  if (loginScreen) loginScreen.classList.add("hidden");
}

function addLogoutButton() {
  const sidebarLogout = document.getElementById("sidebarLogoutBtn");
  if (sidebarLogout && !sidebarLogout.dataset.bound) {
    sidebarLogout.addEventListener("click", () => {
      localStorage.removeItem("billing_token");
      location.reload();
    });
    sidebarLogout.dataset.bound = "true";
  }
}

async function loginBackend() {
  const existingToken = localStorage.getItem("billing_token");

  if (existingToken) {
    hideLoginScreen();
    addLogoutButton();
    return existingToken;
  }

  showLoginScreen();

  return new Promise((resolve) => {
    const form = document.getElementById("loginForm");
    const errorBox = document.getElementById("loginError");

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value.trim();

        errorBox.textContent = "Logging in...";

        try {
          const result = await apiRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
          });

          localStorage.setItem("billing_token", result.token);

          errorBox.textContent = "";
          hideLoginScreen();
          addLogoutButton();

          resolve(result.token);
        } catch (error) {
          errorBox.textContent = error.message || "Invalid email or password";
          console.error(error);
        }
      }
    );
  });
}

function mapProductFromApi(product) {
  return {
    id: String(product.id),
    name: product.name,
    hsn: product.hsn_sac || "",
    unit: product.unit || "NOS",
    rate: Number(product.selling_price || 0),
    gst: Number(product.gst_rate || 0),
    stock: Number(product.current_stock || 0),
    lowStock: Number(product.min_stock || 0)
  };
}

function mapInvoiceFromApi(invoice) {
  return {
    id: String(invoice.id),
    invoiceNo: invoice.invoice_no,
    invoiceDate: String(invoice.invoice_date).slice(0, 10),
    customer: {
      name: invoice.customer_name || "",
      phone: invoice.customer_phone || ""
    },
    items: [],
    itemCount: Number(invoice.item_count || 0),
    status: invoice.status || "ACTIVE",
    cancelReason: invoice.cancel_reason || "",
    cancelledAt: invoice.cancelled_at || "",
    totals: {
      taxable: Number(invoice.taxable_amount || 0),
      tax: Number(invoice.total_tax || 0),
      rawTotal: Number(invoice.grand_total || 0),
      roundOff: 0,
      grand: Number(invoice.grand_total || 0),
      paid: Number(invoice.paid_amount || 0),
      balance: Number(invoice.balance_amount ??(Number(invoice.grand_total || 0) - Number(invoice.paid_amount || 0))
)
    }
  };
}

async function loadStateFromBackend() {
  const productsResult = await apiRequest("/products");
  const invoicesResult = await apiRequest("/invoices");
  const settingsResult = await apiRequest("/settings");

  state.products = productsResult.data.map(mapProductFromApi);
  state.invoices = invoicesResult.data.map(mapInvoiceFromApi);

  if (settingsResult.data) {
    state.settings = {
      ...defaultSettings,
      businessName: settingsResult.data.business_name || "",
      businessTagline: settingsResult.data.business_tagline || "",
      businessGstin: settingsResult.data.gstin || "",
      businessPhone: settingsResult.data.phone || "",
      businessEmail: settingsResult.data.email || "",
      businessWebsite: settingsResult.data.website || "",
      businessAddress: settingsResult.data.address || "",
      bankName: settingsResult.data.bank_name || "",
      bankAccount: settingsResult.data.account_number || "",
      bankIfsc: settingsResult.data.ifsc || "",
      upiId: settingsResult.data.upi_id || "",
      qrImage: settingsResult.data.qr_image || "",
      invoicePrefix: settingsResult.data.invoice_prefix || "GST",
      terms: settingsResult.data.terms || ""
    };
  } else {
    state.settings = defaultSettings;
  }
}

async function init() {
  try {
    await loginBackend();
    await loadStateFromBackend();

    bindEvents();
    setDates();
    loadSettingsForm();
    newInvoice();
    renderAll();
  } catch (error) {
    alert(error.message);
    console.error(error);
  }
}

function bindEvents() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  const bind = (id, event, handler) => {
    const el = $(id);
    if (el) el.addEventListener(event, handler);
  };

  bind('newInvoiceBtn', 'click', newInvoice);
  bind('productSelect', 'change', fillItemFromProduct);
  bind('manualItemBtn', 'click', clearItemFields);
  bind('addItemBtn', 'click', addItemToCart);
  bind('paidAmount', 'input', renderSummary);
  bind('taxType', 'change', renderSummary);
  bind('saveInvoiceBtn', 'click', () => saveInvoice(true));
  bind('printA4Btn', 'click', () => printCurrent('a4'));
  bind('printThermalBtn', 'click', () => printCurrent('thermal'));

  bind('saveProductBtn', 'click', saveProduct);
  bind('clearProductFormBtn', 'click', clearProductForm);
  bind('clearHistoryBtn', 'click', clearHistory);

  bind('historySearchInput', 'input', () => {
    historyUi.search = $('historySearchInput').value.trim();
    historyUi.page = 1;
    renderHistory();
  });

  bind('historyDateToggle', 'click', () => {
    const panel = $('historyDatePanel');
    if (panel) panel.classList.toggle('hidden');
  });

  bind('historyApplyDateBtn', 'click', () => {
    historyUi.from = $('historyFromDate')?.value || "";
    historyUi.to = $('historyToDate')?.value || "";

    if (historyUi.from && historyUi.to && historyUi.from > historyUi.to) {
      alert('From date should be before To date.');
      return;
    }

    historyUi.page = 1;
    const panel = $('historyDatePanel');
    if (panel) panel.classList.add('hidden');
    renderHistory();
  });

  bind('historyClearDateBtn', 'click', () => {
    historyUi.from = "";
    historyUi.to = "";
    historyUi.page = 1;
    if ($('historyFromDate')) $('historyFromDate').value = "";
    if ($('historyToDate')) $('historyToDate').value = "";
    const panel = $('historyDatePanel');
    if (panel) panel.classList.add('hidden');
    renderHistory();
  });

  bind('historyPageSize', 'change', () => {
    historyUi.pageSize = Number($('historyPageSize').value || 12);
    historyUi.page = 1;
    renderHistory();
  });
  bind('saveSettingsBtn', 'click', saveSettings);
  bind('resetDemoBtn', 'click', resetDemoData);
  bind('qrUpload', 'change', handleQrUpload);

  bind('supportPreviewA4Btn', 'click', () => openPrintPreview('a4'));
  bind('supportPrintA4Btn', 'click', () => printSampleInvoice('a4'));
  bind('supportPreviewThermalBtn', 'click', () => openPrintPreview('thermal'));
  bind('supportPrintThermalBtn', 'click', () => printSampleInvoice('thermal'));

  bindPremiumUiControls();
  addLogoutButton();
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
  document.querySelectorAll('.tab-section').forEach(sec => sec.classList.toggle('active', sec.id === tabId));
}

function setDates() {
  $('invoiceDate').value = todayISO();
  $('challanDate').value = todayISO();
}

function renderAll() {
  renderProductOptions();
  renderCart();
  renderStockTable();
  renderHistory();
  renderStats();
  renderSummary();
  updateProfileChips();
}

function nextInvoiceNo() {
  const fy = financialYearFromDate($('invoiceDate')?.value || todayISO());
  const next = state.invoices.length + 1;
  return `GST-${fy}-${String(next).padStart(4, '0')}`;
}

function newInvoice() {
  state.cart = [];
  $('invoiceNo').value = nextInvoiceNo();
  $('customerName').value = '';
  $('customerPhone').value = '';
  $('customerEmail').value = '';
  $('customerGstin').value = '';
  $('customerAddress').value = '';
  $('placeOfSupply').value = 'Tamil Nadu (33)';
  $('taxType').value = 'CGST_SGST';
  $('challanNo').value = '';
  $('ewayBill').value = '';
  $('transport').value = '';
  $('paymentMode').value = 'Cash';
  $('paidAmount').value = 0;
  $('invoiceNotes').value = 'Subject to Salem Jurisdiction.\nGoods once sold will not taken back.\nDelivery Ex-Premises.';
  setDates();
  clearItemFields();
  renderCart();
  renderSummary();
}

function renderProductOptions() {
  const select = $('productSelect');
  select.innerHTML = '<option value="">Select product from stock</option>' +
    state.products.map(p => `<option value="${p.id}">${escapeHtml(p.name)} - Stock: ${p.stock}</option>`).join('');
}

function fillItemFromProduct() {
  const product = state.products.find(p => p.id === $('productSelect').value);
  if (!product) return;
  $('itemName').value = product.name;
  $('itemHsn').value = product.hsn;
  $('itemUnit').value = product.unit;
  $('itemRate').value = product.rate;
  $('itemGst').value = product.gst;
  $('itemQty').value = 1;
}

function clearItemFields() {
  $('productSelect').value = '';
  $('itemName').value = '';
  $('itemHsn').value = '';
  $('itemUnit').value = 'NOS';
  $('itemQty').value = 1;
  $('itemRate').value = '';
  $('itemGst').value = 5;
}

function addItemToCart() {
  const name = $('itemName').value.trim();
  const qty = num($('itemQty').value);
  const rate = num($('itemRate').value);
  const gst = num($('itemGst').value);
  const selectedProductId = $('productSelect').value;

  if (!name || qty <= 0 || rate < 0) {
    alert('Please enter valid item name, quantity and rate.');
    return;
  }

  const product = state.products.find(p => p.id === selectedProductId);
  if (product && product.stock < qty) {
    const proceed = confirm(`${product.name} has only ${product.stock} ${product.unit} in stock. Add anyway?`);
    if (!proceed) return;
  }

  const taxable = qty * rate;
  const taxAmount = taxable * gst / 100;
  const total = taxable + taxAmount;

  state.cart.push({
    id: cryptoId(),
    productId: selectedProductId || null,
    name,
    hsn: $('itemHsn').value.trim(),
    unit: $('itemUnit').value.trim() || 'NOS',
    qty,
    rate,
    gst,
    taxable,
    taxAmount,
    total
  });

  clearItemFields();
  renderCart();
  renderSummary();
}

function removeCartItem(id) {
  state.cart = state.cart.filter(item => item.id !== id);
  renderCart();
  renderSummary();
}

function renderCart() {
  const body = $('cartBody');
  if (!state.cart.length) {
    body.innerHTML = $('emptyRowTemplate').innerHTML;
    return;
  }

  body.innerHTML = state.cart.map((item, index) => `
    <tr>
      <td class="cart-sno">${index + 1}</td>
      <td class="cart-product"><strong>${escapeHtml(item.name)}</strong></td>
      <td class="cart-hsn">${escapeHtml(item.hsn)}</td>
      <td class="cart-unit">${escapeHtml(item.unit)}</td>
      <td class="cart-qty">${item.qty}</td>
      <td class="num cart-money cart-rate">${money(item.rate)}</td>
      <td class="num cart-money cart-taxable">${money(item.taxable)}</td>
      <td class="cart-gst"><span>${item.gst}%</span><small>${money(item.taxAmount)}</small></td>
      <td class="num cart-money cart-total"><strong>${money(item.total)}</strong></td>
      <td class="cart-action"><button class="icon-btn delete" onclick="removeCartItem('${item.id}')">Remove</button></td>
    </tr>
  `).join('');
}

function totalsFromCart() {
  const taxable = state.cart.reduce((sum, item) => sum + item.taxable, 0);
  const tax = state.cart.reduce((sum, item) => sum + item.taxAmount, 0);
  const rawTotal = taxable + tax;
  const grand = Math.round(rawTotal);
  const roundOff = grand - rawTotal;
  const paid = num($('paidAmount')?.value || 0);
  const balance = grand - paid;
  return { taxable, tax, rawTotal, roundOff, grand, paid, balance };
}

function renderSummary() {
  const totals = totalsFromCart();
  const set = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  set('summaryTaxable', money(totals.taxable));
  set('summaryTax', money(totals.tax));
  set('summaryRoundOff', money(totals.roundOff));
  set('summaryGrand', money(totals.grand));
  set('summaryPaid', money(totals.paid));
  set('summaryBalance', money(totals.balance));
}

function getInvoiceFromForm() {
  const totals = totalsFromCart();
  return {
    id: cryptoId(),
    invoiceNo: $('invoiceNo').value,
    invoiceDate: $('invoiceDate').value,
    challanNo: $('challanNo').value.trim(),
    challanDate: $('challanDate').value,
    ewayBill: $('ewayBill').value.trim(),
    transport: $('transport').value.trim(),
    taxType: 'CGST_SGST',
    paymentMode: $('paymentMode').value,
    notes: $('invoiceNotes').value.trim(),
    customer: {
      name: $('customerName').value.trim(),
      phone: $('customerPhone').value.trim(),
      email: $('customerEmail').value.trim(),
      gstin: $('customerGstin').value.trim(),
      address: $('customerAddress').value.trim(),
      placeOfSupply: $('placeOfSupply').value.trim() || 'Tamil Nadu (33)' || 'Tamil Nadu (33)'
    },
    items: JSON.parse(JSON.stringify(state.cart)),
    totals,
    createdAt: new Date().toISOString()
  };
}

function validateInvoice(invoice) {
  if (!invoice.customer.name) return 'Please enter customer name.';
  if (!invoice.items.length) return 'Please add at least one item.';
  return '';
}

async function saveInvoice(showAlert = false) {
  const invoice = getInvoiceFromForm();
  const error = validateInvoice(invoice);

  if (error) {
    alert(error);
    return null;
  }

  const stateCodeMatch = invoice.customer.placeOfSupply.match(/\((\d+)\)/);
  const stateCode = stateCodeMatch ? stateCodeMatch[1] : '33';

  const payload = {
    invoice_date: invoice.invoiceDate,
    customer: {
      name: invoice.customer.name,
      phone: invoice.customer.phone,
      email: invoice.customer.email,
      address: invoice.customer.address,
      gstin: invoice.customer.gstin,
      state_name: invoice.customer.placeOfSupply || 'Tamil Nadu (33)',
      state_code: stateCode || '33' || '33'
    },
    payment_method: invoice.paymentMode,
    payment_status:
  invoice.totals.balance <= 0
    ? "Paid"
    : invoice.totals.paid > 0
      ? "Partial"
      : "Unpaid",
paid_amount: Number(invoice.totals.paid || 0),
    challan_no: invoice.challanNo,
    eway_bill_no: invoice.ewayBill,
    transport_name: invoice.transport,
    notes: invoice.notes,
    round_to_nearest_rupee: true,
    items: invoice.items.map(item => ({
      product_id: item.productId ? Number(item.productId) : null,
      product_name: item.name,
      hsn_sac: item.hsn,
      unit: item.unit,
      qty: Number(item.qty),
      rate: Number(item.rate),
      gst_rate: Number(item.gst),
      discount: 0
    }))
  };

  try {
    const result = await apiRequest("/invoices", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    await loadStateFromBackend();
    renderAll();

    if (showAlert) {
      alert(`Invoice saved successfully.\nInvoice No: ${result.data.invoice_no}\nStock updated automatically.`);
    }

    newInvoice();
    return result.data;
  } catch (error) {
    alert(error.message);
    console.error(error);
    return null;
  }
}


function installDynamicPrintPageStyle(mode) {
  const old = document.getElementById('dynamicPrintPageStyle');
  if (old) old.remove();

  const style = document.createElement('style');
  style.id = 'dynamicPrintPageStyle';

  if (mode === 'thermal') {
    style.textContent = `
      @page { size: 80mm 260mm; margin: 0; }
    `;
  } else {
    style.textContent = `
      @page { size: A4 portrait; margin: 0; }
    `;
  }

  document.head.appendChild(style);
}

function clearDynamicPrintPageStyle() {
  const style = document.getElementById('dynamicPrintPageStyle');
  if (style) style.remove();
}

function enablePrintMode(mode) {
  document.body.classList.remove('print-a4', 'print-thermal');
  document.body.classList.add(mode === 'a4' ? 'print-a4' : 'print-thermal');
  installDynamicPrintPageStyle(mode);
}

function disablePrintMode() {
  document.body.classList.remove('print-a4', 'print-thermal');
  clearDynamicPrintPageStyle();
}

function printCurrent(mode, existingInvoice = null) {
  const invoice = existingInvoice || getInvoiceFromForm();
  const error = validateInvoice(invoice);
  if (error) {
    alert(error);
    return;
  }

  // FINAL FIX: Print in a clean isolated window.
  // This avoids old dashboard CSS / previous print CSS conflicts.
  openStandalonePrint(mode, invoice);
}

async function saveProduct() {
  const id = $("stockProductId").value;

  const payload = {
    name: $("stockName").value.trim(),
    hsn_sac: $("stockHsn").value.trim(),
    unit: $("stockUnit").value.trim() || "NOS",
    selling_price: num($("stockRate").value),
    gst_rate: num($("stockGst").value),
    current_stock: num($("stockQty").value),
    min_stock: num($("stockLow").value)
  };

  if (!payload.name) {
    alert("Please enter product name.");
    return;
  }

  try {
    if (id) {
      const oldProduct = state.products.find(p => String(p.id) === String(id));
      const oldStock = Number(oldProduct?.stock || 0);
      const newStock = Number(payload.current_stock || 0);
      const stockDifference = newStock - oldStock;

      await apiRequest(`/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      if (stockDifference !== 0) {
        await apiRequest(`/products/${id}/stock`, {
          method: "POST",
          body: JSON.stringify({
            type: "ADJUSTMENT",
            qty: stockDifference,
            note: "Stock updated from frontend"
          })
        });
      }
    } else {
      await apiRequest("/products", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    await loadStateFromBackend();
    clearProductForm();
    renderAll();
    alert("Product saved in backend.");
  } catch (error) {
    alert(error.message);
    console.error(error);
  }
}


function editProduct(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  $('stockProductId').value = product.id;
  $('stockName').value = product.name;
  $('stockHsn').value = product.hsn;
  $('stockUnit').value = product.unit;
  $('stockRate').value = product.rate;
  $('stockGst').value = product.gst;
  $('stockQty').value = product.stock;
  $('stockLow').value = product.lowStock;
  switchTab('stock');
}

async function deleteProduct(id) {
  const product = state.products.find(p => String(p.id) === String(id));
  if (!product) return;

  if (!confirm(`Delete ${product.name}?`)) return;

  try {
    await apiRequest(`/products/${id}`, {
      method: "DELETE"
    });

    await loadStateFromBackend();
    renderAll();
    alert("Product deleted from backend.");
  } catch (error) {
    alert(error.message);
    console.error(error);
  }
}

function clearProductForm() {
  $('stockProductId').value = '';
  $('stockName').value = '';
  $('stockHsn').value = '';
  $('stockUnit').value = 'NOS';
  $('stockRate').value = '';
  $('stockGst').value = 5;
  $('stockQty').value = 1;
  $('stockLow').value = 5;
}

function renderStockTable() {
  const body = $('stockBody');
  const billingBody = $('billingStockBody');
  const products = state.products || [];

  const productInitials = (name) => String(name || 'PR').split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
  const statusHtml = (p) => {
    if (Number(p.stock || 0) <= 0) return '<span class="badge out">Out of Stock</span>';
    if (Number(p.stock || 0) <= Number(p.lowStock || 0)) return '<span class="badge low">Low Stock</span>';
    return '<span class="badge">In Stock</span>';
  };

  if (!products.length) {
    if (body) body.innerHTML = '<tr><td colspan="9" class="empty">No products added.</td></tr>';
    if (billingBody) billingBody.innerHTML = '<tr><td colspan="8" class="empty">No products added.</td></tr>';
    return;
  }

  if (body) {
    body.innerHTML = products.map(p => `
      <tr>
        <td>
          <div class="product-cell">
            <span class="product-thumb">${productInitials(p.name)}</span>
            <span><strong>${escapeHtml(p.name)}</strong><small>SKU: ${escapeHtml(String(p.hsn || '').slice(0, 3) + String(p.id || '').slice(0, 4))}</small></span>
          </div>
        </td>
        <td>${escapeHtml(p.hsn)}</td>
        <td>${escapeHtml(p.unit)}</td>
        <td class="num">${plainMoney(p.rate)}</td>
        <td>${p.gst}%</td>
        <td><strong>${p.stock}</strong><small style="display:block;color:#64718a">${escapeHtml(p.unit)}</small></td>
        <td>${p.lowStock}</td>
        <td>${statusHtml(p)}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" onclick="editProduct('${p.id}')">✎ Edit</button>
            <button class="icon-btn delete" onclick="deleteProduct('${p.id}')">⌫ Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  if (billingBody) {
    billingBody.innerHTML = products.slice(0, 3).map(p => `
      <tr>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td>${escapeHtml(p.hsn)}</td>
        <td>${escapeHtml(p.unit)}</td>
        <td class="num">${money(p.rate)}</td>
        <td>${p.gst}%</td>
        <td><strong>${p.stock}</strong></td>
        <td>${statusHtml(p)}</td>
        <td><button class="icon-btn" onclick="editProduct('${p.id}')">✎</button></td>
      </tr>
    `).join('');
  }

  const showing = $('stockShowingText');
  if (showing) showing.textContent = `Showing 1 to ${Math.min(products.length, 5)} of ${products.length} products`;
}

function invoiceStatus(inv) {
  if (inv.status === "CANCELLED") return "cancelled";
  if (Number(inv.totals.balance || 0) <= 0) return "paid";
  if (Number(inv.totals.paid || 0) > 0) return "partial";
  return "unpaid";
}

function invoiceStatusBadge(inv) {
  const status = invoiceStatus(inv);
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return `<span class="status-badge status-${status}">${label}</span>`;
}

function historyRowHtml(inv, mini = false) {
  const isCancelled = inv.status === "CANCELLED";
  const paid = isCancelled ? 0 : Number(inv.totals.paid || 0);
  const balance = isCancelled ? 0 : Number(inv.totals.balance || 0);
  return `
    <tr class="${isCancelled ? "cancelled-row" : ""}">
      <td><strong style="color:#086bff">${escapeHtml(inv.invoiceNo)}</strong></td>
      <td>${formatDate(inv.invoiceDate)}</td>
      <td>${escapeHtml(inv.customer.name)}</td>
      <td>${inv.itemCount ?? inv.items.length}</td>
      <td class="num">${money(inv.totals.grand)}</td>
      <td class="num" style="color:#11964b">${money(paid)}</td>
      <td class="num" style="color:${balance > 0 ? '#ff3030' : '#0f2346'}">${money(balance)}</td>
      <td>${invoiceStatusBadge(inv)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" onclick="printInvoiceById('${inv.id}', 'a4')">▣ A4</button>
          <button class="icon-btn" onclick="printInvoiceById('${inv.id}', 'thermal')">▣ Thermal</button>
          ${mini ? `<button class="icon-btn row-more-btn" data-invoice-id="${inv.id}" title="More actions">⋮</button>` : (isCancelled ? `<button class="icon-btn" disabled>Cancel</button>` : `<button class="icon-btn delete" onclick="cancelInvoiceById('${inv.id}')">⊗ Cancel</button>`)}
        </div>
      </td>
    </tr>
  `;
}

function normalizeInvoiceDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function filteredHistoryInvoices() {
  const search = String(historyUi.search || "").toLowerCase().trim();
  const from = historyUi.from || "";
  const to = historyUi.to || "";

  return state.invoices
    .filter((inv) => {
      const invDate = normalizeInvoiceDate(inv.invoiceDate);

      if (from && invDate < from) return false;
      if (to && invDate > to) return false;

      if (search) {
        const text = [
          inv.invoiceNo,
          inv.customer?.name,
          inv.customer?.phone,
          inv.customer?.email,
          inv.customer?.gstin,
          inv.status,
          inv.totals?.grand
        ].join(' ').toLowerCase();

        if (!text.includes(search)) return false;
      }

      return true;
    })
    .slice()
    .sort((a, b) => {
      const dateCompare = normalizeInvoiceDate(b.invoiceDate).localeCompare(normalizeInvoiceDate(a.invoiceDate));
      if (dateCompare !== 0) return dateCompare;
      return String(b.invoiceNo || "").localeCompare(String(a.invoiceNo || ""));
    });
}

function updateHistoryDateLabel() {
  const label = $('historyDateLabel');
  if (!label) return;

  if (!historyUi.from && !historyUi.to) {
    label.textContent = 'All dates';
    return;
  }

  const fromText = historyUi.from ? formatDate(historyUi.from) : 'Start';
  const toText = historyUi.to ? formatDate(historyUi.to) : 'Today';
  label.textContent = `${fromText} → ${toText}`;
}

function goHistoryPage(page) {
  historyUi.page = Number(page || 1);
  renderHistory();
}

function renderHistoryPagination(totalItems) {
  const pagination = $('historyPagination');
  if (!pagination) return;

  const pageSize = Number(historyUi.pageSize || 12);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (historyUi.page > totalPages) historyUi.page = totalPages;
  if (historyUi.page < 1) historyUi.page = 1;

  const current = historyUi.page;
  const pages = [];
  const start = Math.max(1, current - 2);
  const end = Math.min(totalPages, current + 2);

  pages.push(`<button type="button" ${current === 1 ? 'disabled' : ''} onclick="goHistoryPage(1)">«</button>`);
  pages.push(`<button type="button" ${current === 1 ? 'disabled' : ''} onclick="goHistoryPage(${current - 1})">‹</button>`);

  if (start > 1) {
    pages.push(`<button type="button" onclick="goHistoryPage(1)">1</button>`);
    if (start > 2) pages.push(`<span>...</span>`);
  }

  for (let page = start; page <= end; page++) {
    pages.push(`<button type="button" class="${page === current ? 'active' : ''}" onclick="goHistoryPage(${page})">${page}</button>`);
  }

  if (end < totalPages) {
    if (end < totalPages - 1) pages.push(`<span>...</span>`);
    pages.push(`<button type="button" onclick="goHistoryPage(${totalPages})">${totalPages}</button>`);
  }

  pages.push(`<button type="button" ${current === totalPages ? 'disabled' : ''} onclick="goHistoryPage(${current + 1})">›</button>`);
  pages.push(`<button type="button" ${current === totalPages ? 'disabled' : ''} onclick="goHistoryPage(${totalPages})">»</button>`);

  pagination.innerHTML = pages.join('');
}

function renderHistory() {
  const body = $("historyBody");
  const miniBody = $("billingHistoryBody");
  const filtered = filteredHistoryInvoices();
  const totalFiltered = filtered.length;
  const pageSize = Number(historyUi.pageSize || 12);
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  if (historyUi.page > totalPages) historyUi.page = totalPages;
  if (historyUi.page < 1) historyUi.page = 1;

  const startIndex = (historyUi.page - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  updateHistoryDateLabel();
  renderHistoryPagination(totalFiltered);

  if (!state.invoices.length) {
    if (body) body.innerHTML = '<tr><td colspan="9" class="empty">No saved invoices.</td></tr>';
    if (miniBody) miniBody.innerHTML = '<tr><td colspan="9" class="empty">No saved invoices.</td></tr>';

    const text = $("historyShowingText");
    if (text) text.textContent = 'No invoices saved yet';
    return;
  }

  if (!pageItems.length) {
    if (body) body.innerHTML = '<tr><td colspan="9" class="empty">No invoices found for this search/date range.</td></tr>';
  } else if (body) {
    body.innerHTML = pageItems.map(inv => historyRowHtml(inv, false)).join("");
  }

  if (miniBody) miniBody.innerHTML = state.invoices.slice(0, 3).map(inv => historyRowHtml(inv, true)).join("");

  const text = $("historyShowingText");
  if (text) {
    if (!totalFiltered) {
      text.textContent = `Showing 0 of ${state.invoices.length} invoices`;
    } else {
      const fromNo = startIndex + 1;
      const toNo = Math.min(startIndex + pageItems.length, totalFiltered);
      text.textContent = `Showing ${fromNo} to ${toNo} of ${totalFiltered} invoices`;
    }
  }
}

async function cancelInvoiceById(id) {
  const invoice = state.invoices.find(inv => String(inv.id) === String(id));
  if (!invoice) return;

  if (invoice.status === "CANCELLED") {
    alert("This invoice is already cancelled.");
    return;
  }

  const reason = prompt(
    `Enter reason to cancel invoice ${invoice.invoiceNo}`,
    "Wrong bill / customer returned"
  );

  if (reason === null) return;

  if (!confirm(`Cancel invoice ${invoice.invoiceNo}?\nStock will be restored automatically.`)) {
    return;
  }

  try {
    const result = await apiRequest(`/invoices/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({
        reason: reason.trim() || "Cancelled by admin"
      })
    });

    await loadStateFromBackend();
    renderAll();

    alert(result.message || "Invoice cancelled and stock restored.");
  } catch (error) {
    alert(error.message);
    console.error(error);
  }
}


function parseJsonMaybe(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function mapFullInvoiceFromApi(data) {
  const customer = parseJsonMaybe(data.customer_snapshot);

  const items = (data.items || []).map(item => ({
    id: String(item.id),
    productId: item.product_id ? String(item.product_id) : null,
    name: item.product_name || "",
    hsn: item.hsn_sac || "",
    unit: item.unit || "NOS",
    qty: Number(item.qty || 0),
    rate: Number(item.rate || 0),
    gst: Number(item.gst_rate || 0),
    taxable: Number(item.taxable_value || 0),
    taxAmount:
      Number(item.cgst || 0) +
      Number(item.sgst || 0) +
      Number(item.igst || 0),
    total: Number(item.total || 0)
  }));

  const taxable = Number(data.taxable_amount || 0);
  const tax = Number(data.total_tax || 0);
  const grand = Number(data.grand_total || 0);
  const paid = Number(data.paid_amount || 0);
  const balance = Number(data.balance_amount ?? (grand - paid));

  return {
    id: String(data.id),
    invoiceNo: data.invoice_no,
    invoiceDate: String(data.invoice_date).slice(0, 10),
    challanNo: data.challan_no || "",
    challanDate: String(data.invoice_date).slice(0, 10),
    ewayBill: data.eway_bill_no || "",
    transport: data.transport_name || "",
    taxType: 'CGST_SGST',
    paymentMode: data.payment_method || "Cash",
    notes: data.notes || state.settings.terms || "",
    customer: {
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      gstin: customer.gstin || "",
      address: customer.address || "",
      placeOfSupply: customer.state_name
        ? `${customer.state_name}${customer.state_code ? " (" + customer.state_code + ")" : ""}`
        : ""
    },
    items,
    totals: {
      taxable,
      tax,
      rawTotal: taxable + tax,
      roundOff: Number(data.round_off || 0),
      grand,
      paid,
      balance
    }
  };
}

async function printInvoiceById(id, mode) {
  try {
    const result = await apiRequest(`/invoices/${id}`);
    const invoice = mapFullInvoiceFromApi(result.data);
    printCurrent(mode, invoice);
  } catch (error) {
    alert(error.message);
    console.error(error);
  }
}

async function clearHistory() {
  const confirmText = prompt(
    "This will permanently clear invoice history from backend database and restore stock.\nType CLEAR to continue:"
  );

  if (confirmText !== "CLEAR") {
    return;
  }

  try {
    const result = await apiRequest("/invoices/clear/all", {
      method: "DELETE"
    });

    await loadStateFromBackend();
    renderAll();

    alert(result.message || "Invoice history cleared.");
  } catch (error) {
    alert(error.message);
    console.error(error);
  }
}

function renderStats() {
  const today = todayISO();
  const todaySales = state.invoices
    .filter(inv => inv.invoiceDate === today)
    .reduce((sum, inv) => sum + Number(inv.totals.grand || 0), 0);

  const lowCount = state.products.filter(p => Number(p.stock || 0) <= Number(p.lowStock || 0)).length;
  const outCount = state.products.filter(p => Number(p.stock || 0) <= 0).length;
  const stockValue = state.products.reduce((sum, p) => sum + (Number(p.rate || 0) * Number(p.stock || 0)), 0);
  const paidInvoices = state.invoices.filter(inv => inv.status !== "CANCELLED" && Number(inv.totals.balance || 0) <= 0).length;
  const cancelledInvoices = state.invoices.filter(inv => inv.status === "CANCELLED").length;
  const pendingBalance = state.invoices.filter(inv => inv.status !== "CANCELLED").reduce((sum, inv) => sum + Number(inv.totals.balance || 0), 0);

  const set = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  set('todaySales', money(todaySales));
  set('totalProducts', state.products.length);
  set('lowStockCount', lowCount);
  set('totalInvoices', state.invoices.length);
  set('stockTotalProducts', state.products.length);
  set('stockValue', money(stockValue));
  set('stockLowCount', lowCount);
  set('stockOutCount', outCount);
  set('historyTotalInvoices', state.invoices.length);
  set('historyPaidInvoices', paidInvoices);
  set('historyPendingBalance', money(pendingBalance));
  set('historyCancelledBills', cancelledInvoices);
}
function getBusinessPlaceFromAddress(address) {
  let text = String(address || '').trim();

  if (!text) return 'Business';

  text = text.replace(/\b\d{6}\b/g, '');
  text = text.replace(/\s*[-,]+\s*$/g, '').trim();
  text = text.replace(/\s+/g, ' ');

  const words = text
    .split(' ')
    .map(w => w.trim())
    .filter(w => w && w !== '-' && w !== ',');

  if (words.length >= 2) return words[words.length - 1];
  return words[0] || 'Business';
}

function getBusinessInitials(name) {
  const text = String(name || "Business").trim();
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  return text.slice(0, 2).toUpperCase();
}

function updateProfileChips() {
  const businessName = state?.settings?.businessName || "Business";
  const place = getBusinessPlaceFromAddress(state?.settings?.businessAddress || "");

  document.querySelectorAll(".profile-chip").forEach((chip) => {
    const avatar = chip.querySelector("span");
    const label = chip.querySelector("b");

    if (avatar) avatar.textContent = getBusinessInitials(businessName);

    if (label) {
      label.innerHTML = `${place}`;
    }

    const menuStrong = chip.querySelector(".profile-menu strong");
    const menuSmall = chip.querySelector(".profile-menu small");

    if (menuStrong) menuStrong.textContent = businessName;
    if (menuSmall) menuSmall.textContent = `${place} workspace`;
  });
}
function loadSettingsForm() {
  Object.entries(state.settings).forEach(([key, value]) => {
    const input = $(key);
    if (input && input.type !== 'file') input.value = value;
  });
}

async function saveSettings() {
  const payload = {
    business_name: $("businessName").value.trim(),
    business_tagline: $("businessTagline").value.trim(),
    gstin: $("businessGstin").value.trim(),
    phone: $("businessPhone").value.trim(),
    email: $("businessEmail").value.trim(),
    website: $("businessWebsite").value.trim(),
    address: $("businessAddress").value.trim(),
    bank_name: $("bankName").value.trim(),
    account_number: $("bankAccount").value.trim(),
    ifsc: $("bankIfsc").value.trim(),
    upi_id: $("upiId").value.trim(),
    qr_image: state.settings.qrImage || "",
    state_name: "Tamil Nadu",
    state_code: "33",
    invoice_prefix: state.settings.invoicePrefix || "GST",
    financial_year: financialYearFromDate(),
    terms: state.settings.terms || "Thank you for shopping with us!"
  };

  if (!payload.business_name) {
    alert("Business name is required.");
    return;
  }

  try {
    const result = await apiRequest("/settings", {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    state.settings = {
      ...state.settings,
      businessName: result.data.business_name || "",
      businessTagline: result.data.business_tagline || "",
      businessGstin: result.data.gstin || "",
      businessPhone: result.data.phone || "",
      businessEmail: result.data.email || "",
      businessWebsite: result.data.website || "",
      businessAddress: result.data.address || "",
      bankName: result.data.bank_name || "",
      bankAccount: result.data.account_number || "",
      bankIfsc: result.data.ifc || result.data.ifsc || "",
      upiId: result.data.upi_id || "",
      qrImage: result.data.qr_image || ""
    };

    loadSettingsForm();
    updateProfileChips();
    alert("Business settings saved in backend.");
  } catch (error) {
    alert(error.message);
    console.error(error);
  }
}

function handleQrUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    state.settings.qrImage = reader.result;
    alert("QR image loaded. Click Save Settings to store it in backend.");
  };

  reader.readAsDataURL(file);
}   

function resetDemoData() {
  if (!confirm('Reset products, settings and invoices to demo data?')) return;
  localStorage.removeItem(STORAGE_KEYS.products);
  localStorage.removeItem(STORAGE_KEYS.invoices);
  localStorage.removeItem(STORAGE_KEYS.settings);
  loadState();
  loadSettingsForm();
  newInvoice();
  renderAll();
}

function renderPrintTemplates(invoice) {
  $('a4Invoice').innerHTML = buildA4Invoice(invoice);
  $('thermalInvoice').innerHTML = buildThermalInvoice(invoice);
}

function buildA4Invoice(invoice) {
  const s = state.settings || {};
  const customer = invoice.customer || {};
  const businessName = s.businessName || 'Sri Vinayaga Traders';
  const tagline = s.businessTagline || 'Manufacturing & Supply of Precision Tools & Room Components';
  const businessAddress = s.businessAddress || 'No. 12/3, SIDCO Industrial Estate, Coimbatore Main Road, Kurichi, Coimbatore - 641 021, Tamil Nadu, India.';
  const businessPhone = s.businessPhone || '+91 98422 45000';
  const businessEmail = s.businessEmail || 'sales@vinayagatraders.in';
  const businessWebsite = s.businessWebsite || 'www.vinayagatraders.in';
  const gstin = s.businessGstin || '33AACFV1234F1Z6';
  const pan = (gstin && gstin.length >= 12) ? gstin.substring(2, 12) : 'AACFV1234F';
  const taxType = 'CGST_SGST';
  const gstHalf = Number(invoice.totals.tax || 0) / 2;
  const tax = Number(invoice.totals.tax || 0);
  const taxable = Number(invoice.totals.taxable || 0);
  const rawTotal = Number(invoice.totals.rawTotal || taxable);
  const grand = Number(invoice.totals.grand || 0);
  const paid = Number(invoice.totals.paid || 0);
  const balance = Number(invoice.totals.balance || 0);
  const discountTotal = Math.max(0, rawTotal - taxable);
  const words = `${numberToWordsIndian(grand)} rupees only`.replace(/\b\w/g, c => c.toUpperCase());
  const invoiceDate = formatDate(invoice.invoiceDate || new Date());
  const dueDate = formatDate(invoice.dueDate || invoice.invoiceDate || new Date());
  const challanNo = invoice.challanNo || '-';
  const challanDate = formatDate(invoice.challanDate || invoice.invoiceDate || new Date());
  const ewayBill = invoice.ewayBill || '-';
  const transport = invoice.transport || '-';
  const transportId = invoice.transportId || '-';
  const placeOfSupply = customer.placeOfSupply || 'Tamil Nadu (33)';
  const termsSource = invoice.notes || s.terms || 'Goods once sold will not be taken back or exchanged.\nInterest @ 18% p.a. will be charged on overdue payments.\nAll disputes are subject to Coimbatore Jurisdiction only.\nPayment to be made by NEFT / UPI only.\nResponsibility ceases once goods leave our premises.';
  const termsHtml = termsSource.split('\n').filter(Boolean).slice(0, 5).map((line, i) => `<li>${escapeHtml(line.replace(/^\d+\.\s*/, ''))}</li>`).join('');

  const rows = invoice.items.slice(0, 20).map((item, index) => {
    const qty = Number(item.qty || 0);
    const unit = item.unit || 'Nos';
    const rate = Number(item.rate || 0);
    const gst = Number(item.gst || 0);
    const itemTaxable = Number(item.taxable || (qty * rate));
    const itemTax = Number(item.total || 0) - itemTaxable;
    const cgst = taxType === 'CGST_SGST' ? `${plainMoney(gst / 2).replace('.00', '')}%` : '-';
    const sgst = taxType === 'CGST_SGST' ? `${plainMoney(gst / 2).replace('.00', '')}%` : '-';
    const igst = taxType === 'IGST' ? `${plainMoney(gst).replace('.00', '')}%` : '-';
    return `
      <tr>
        <td class="c">${index + 1}</td>
        <td class="desc">${escapeHtml(item.name || '')}</td>
        <td class="c">${escapeHtml(item.hsn || '-')}</td>
        <td class="c">B${String(index + 1).padStart(3, '0')}</td>
        <td class="c">${plainMoney(qty).replace('.00', '')}</td>
        <td class="c">${escapeHtml(unit)}</td>
        <td class="r">${plainMoney(rate)}</td>
        <td class="r">0.00</td>
        <td class="r">${plainMoney(itemTaxable)}</td>
        <td class="c">${cgst}</td>
        <td class="c">${sgst}</td>
        <td class="c">${igst}</td>
        <td class="r strong">${plainMoney(itemTaxable + itemTax)}</td>
      </tr>`;
  });

  while (rows.length < 8) {
    rows.push(`<tr class="empty"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`);
  }

  const totalQty = invoice.items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const cgstAmount = taxType === 'CGST_SGST' ? gstHalf : 0;
  const sgstAmount = taxType === 'CGST_SGST' ? gstHalf : 0;
  const igstAmount = taxType === 'IGST' ? tax : 0;

  return `
    <div class="vt-a4">
      <header class="vt-a4-header">
        <div class="svt-a4-logo" style="width:25mm;height:25mm;border:1.3px solid #0b3f78;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#0b3f78;font-size:17pt;font-weight:950;letter-spacing:-1px;margin:0 auto;background:#fff;box-sizing:border-box;">SVT</div>
        <div class="vt-company">
          <h1>${escapeHtml(businessName)}</h1>
          <h2>${escapeHtml(tagline)}</h2>
          <p>📍 ${escapeHtml(businessAddress)}</p>
          <p>☎ ${escapeHtml(businessPhone)} <b>|</b> ✉ ${escapeHtml(businessEmail)} <b>|</b> 🌐 ${escapeHtml(businessWebsite)}</p>
          <div><b>GSTIN:</b> ${escapeHtml(gstin)} <b class="sep">|</b> <b>PAN:</b> ${escapeHtml(pan)}</div>
        </div>
        <div class="vt-invoice-meta">
          <div><b>Invoice No.</b><span>${escapeHtml(invoice.invoiceNo || '-')}</span></div>
          <div><b>Invoice Date</b><span>${invoiceDate}</span></div>
          <div><b>Due Date</b><span>${dueDate}</span></div>
          <div><b>State Code</b><span>33 (Tamil Nadu)</span></div>
          <div><b>Place of Supply</b><span>${escapeHtml(placeOfSupply)}</span></div>
          <hr>
          <div><b>Challan No.</b><span>${escapeHtml(challanNo)}</span></div>
          <div><b>Challan Date</b><span>${challanDate}</span></div>
          <div><b>E-Way Bill No.</b><span>${escapeHtml(ewayBill)}</span></div>
          <div><b>Transporter</b><span>${escapeHtml(transport)}</span></div>
          <div><b>Transport ID</b><span>${escapeHtml(transportId)}</span></div>
        </div>
      </header>

      <div class="vt-title"><span></span><b>GST TAX INVOICE</b><span></span></div>

      <section class="vt-two-panels">
        <div class="vt-panel">
          <h3>● BILL TO / BUYER</h3>
          <strong>${escapeHtml(customer.name || 'Walk-in Customer')}</strong>
          <p>${escapeHtml(customer.address || 'Customer address')}</p>
          <div class="vt-kv"><b>GSTIN</b><span>${escapeHtml(customer.gstin || '-')}</span></div>
          <div class="vt-kv"><b>State / Supply</b><span>${escapeHtml(placeOfSupply)}</span></div>
          <div class="vt-kv"><b>Contact No.</b><span>${escapeHtml(customer.phone || '-')}</span></div>
        </div>
        <div class="vt-panel">
          <h3>▣ TRANSPORT DETAILS</h3>
          <div class="vt-kv"><b>Dispatch From</b><span>${escapeHtml(businessAddress.split(',').slice(-2).join(',').trim() || 'Tamil Nadu')}</span></div>
          <div class="vt-kv"><b>Destination</b><span>${escapeHtml(placeOfSupply)}</span></div>
          <div class="vt-kv"><b>Transport Mode</b><span>${escapeHtml(transport || 'By Road')}</span></div>
          <div class="vt-kv"><b>Freight Terms</b><span>To Pay</span></div>
          <div class="vt-kv"><b>Delivery Note No.</b><span>${escapeHtml(challanNo)}</span></div>
        </div>
      </section>

      <table class="vt-items">
        <colgroup>
          <col class="sno"><col class="pdesc"><col class="hsn"><col class="batch"><col class="qty"><col class="unit"><col class="rate"><col class="discount"><col class="taxable"><col class="tax"><col class="tax"><col class="tax"><col class="line">
        </colgroup>
        <thead>
          <tr>
            <th>S.No</th><th>Product Description</th><th>HSN/SAC</th><th>Batch</th><th>Qty</th><th>Unit</th><th>Rate (₹)</th><th>Discount (₹)</th><th>Taxable Amount (₹)</th><th>CGST%</th><th>SGST%</th><th>IGST%</th><th>Line Total (₹)</th>
          </tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
        <tfoot><tr><td colspan="4"></td><td class="c strong">${plainMoney(totalQty).replace('.00','')}</td><td colspan="8"></td></tr></tfoot>
      </table>

      <section class="vt-lower-grid">
        <div class="vt-left-block">
          <div class="vt-words"><h4>AMOUNT IN WORDS</h4><p>${escapeHtml(words)}</p></div>
          <div class="vt-bankpay">
            <div class="vt-bank">
              <h4>▦ BANK DETAILS</h4>
              <div class="vt-kv"><b>Bank Name</b><span>${escapeHtml(s.bankName || 'HDFC Bank Limited')}</span></div>
              <div class="vt-kv"><b>A/C Name</b><span>${escapeHtml(businessName)}</span></div>
              <div class="vt-kv"><b>A/C Number</b><span>${escapeHtml(s.bankAccount || '-')}</span></div>
              <div class="vt-kv"><b>IFSC Code</b><span>${escapeHtml(s.bankIfsc || '-')}</span></div>
              <div class="vt-kv"><b>UPI ID</b><span>${escapeHtml(s.upiId || '-')}</span></div>
            </div>
            <div class="vt-upi"><h4>SCAN & PAY (UPI)</h4>${qrHtml('vt-qr')}<small>UPI ID: ${escapeHtml(s.upiId || '-')}</small></div>
          </div>
        </div>
        <div class="vt-totals">
          <div><span>Sub Total</span><b>${plainMoney(rawTotal)}</b></div>
          <div><span>Total Discount</span><b>${plainMoney(discountTotal)}</b></div>
          <div class="green"><span>Taxable Amount</span><b>${plainMoney(taxable)}</b></div>
          <div><span>CGST</span><b>${plainMoney(cgstAmount)}</b></div>
          <div><span>SGST</span><b>${plainMoney(sgstAmount)}</b></div>
          <div><span>IGST</span><b>${plainMoney(igstAmount)}</b></div>
          <div><span>Round Off</span><b>${plainMoney(Number(invoice.totals.roundOff || 0))}</b></div>
          <div class="grand"><span>GRAND TOTAL (₹)</span><b>${plainMoney(grand)}</b></div>
          <div><span>Paid Amount</span><b>${plainMoney(paid)}</b></div>
          <div class="balance"><span>BALANCE DUE (₹)</span><b>${plainMoney(balance)}</b></div>
        </div>
      </section>

      <section class="vt-bottom-panels">
        <div class="vt-terms"><h4>▣ TERMS & CONDITIONS</h4><ol>${termsHtml}</ol></div>
        <div class="vt-sign"><h4>✒ FOR ${escapeHtml(businessName).toUpperCase()}</h4><div></div><b>AUTHORIZED SIGNATORY</b></div>
      </section>

      <footer class="vt-footer"><span>☎ ${escapeHtml(businessPhone)}</span><span>✉ ${escapeHtml(businessEmail)}</span><span>🌐 ${escapeHtml(businessWebsite)}</span></footer>
    </div>`;
}

function buildThermalInvoice(invoice) {
  const s = state.settings || {};
  const customer = invoice.customer || {};
  const businessName = s.businessName || 'Sri Vinayaga Traders';
  const businessAddress = s.businessAddress || 'No. 12/3, SIDCO Industrial Estate, Coimbatore - 641 021, Tamil Nadu, India.';
  const businessPhone = s.businessPhone || '+91 98422 45000';
  const gstin = s.businessGstin || '33AACFV1234F1Z6';
  const taxType = 'CGST_SGST';
  const tax = Number(invoice.totals.tax || 0);
  const gstHalf = tax / 2;
  const rows = invoice.items.slice(0, 10).map((item, index) => `
    <tr>
      <td class="no">${index + 1}</td>
      <td>${escapeHtml(item.name)}</td>
      <td class="c">${plainMoney(item.qty).replace('.00','')} ${escapeHtml(item.unit || '')}</td>
      <td class="r">${plainMoney(item.rate)}</td>
      <td class="r">${plainMoney(item.total)}</td>
    </tr>`).join('');

  return `
    <div class="vt-thermal">
      <div class="svt-t-logo" style="width:12mm;height:12mm;border:1px solid #0b3f78;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#0b3f78;font-size:8pt;font-weight:950;margin:0 auto 0.8mm;background:#fff;box-sizing:border-box;line-height:1;">SVT</div>
      <h1>${escapeHtml(businessName)}</h1>
      <h2>${escapeHtml(s.businessTagline || 'Manufacturing & Supply of Precision Tools & Room Components')}</h2>
      <p class="addr">📍 ${escapeHtml(businessAddress)}</p>
      <p>☎ ${escapeHtml(businessPhone)}</p>
      <p><b>GSTIN:</b> ${escapeHtml(gstin)}</p>
      <div class="dash"></div>
      <h3>TAX INVOICE</h3>
      <div class="meta">
        <b>Invoice No.</b><span>${escapeHtml(invoice.invoiceNo || '-')}</span>
        <b>Date</b><span>${formatDate(invoice.invoiceDate || new Date())}</span>
        <b>Time</b><span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <b>Cashier</b><span>Admin</span>
        <b>Customer</b><span>${escapeHtml(customer.name || 'Walk-in Customer')}</span>
        <b>Mobile</b><span>${escapeHtml(customer.phone || '-')}</span>
        <b>GSTIN</b><span>${escapeHtml(customer.gstin || 'URP')}</span>
        <b>Pay Mode</b><span>${escapeHtml(invoice.paymentMode || 'UPI')}</span>
      </div>
      <div class="dash"></div>
      <table class="vt-t-items"><thead><tr><th>#</th><th>Item Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="dash"></div>
      <div class="vt-t-sum">
        <div><span>SUB TOTAL</span><b>${plainMoney(invoice.totals.rawTotal)}</b></div>
        <div><span>DISCOUNT</span><b>0.00</b></div>
        <div class="green"><span>TAXABLE AMOUNT</span><b>${plainMoney(invoice.totals.taxable)}</b></div>
        <div><span>CGST</span><b>${taxType === 'IGST' ? '0.00' : plainMoney(gstHalf)}</b></div>
        <div><span>SGST</span><b>${taxType === 'IGST' ? '0.00' : plainMoney(gstHalf)}</b></div>
        <div><span>IGST</span><b>${taxType === 'IGST' ? plainMoney(tax) : '0.00'}</b></div>
        <div class="grand"><span>GRAND TOTAL (₹)</span><b>${plainMoney(invoice.totals.grand)}</b></div>
        <div><span>PAID AMOUNT</span><b>${plainMoney(invoice.totals.paid)}</b></div>
        <div class="green"><span>BALANCE DUE (₹)</span><b>${plainMoney(invoice.totals.balance)}</b></div>
      </div>
      <div class="dash"></div>
      <section class="vt-t-pay"><div><b>SCAN & PAY (UPI)</b>${qrHtml('vt-t-qr')}<small>${escapeHtml(s.upiId || '-')}</small></div><p>You can pay using any UPI App</p></section>
      <section class="vt-t-terms"><b>TERMS & RETURNS</b><br>• Goods once sold will not be taken back.<br>• All disputes are subject to local jurisdiction.<br>• Responsibility ceases once goods leave our premises.</section>
      <div class="dash"></div>
      <div class="vt-t-thanks">THANK YOU FOR YOUR BUSINESS!</div>
    </div>`;
}

function qrHtml(className) {
  const qrSrc = String(state?.settings?.qrImage || '').trim();

  if (!qrSrc || qrSrc === 'null' || qrSrc === 'undefined') {
    return `<div class="${className} qr-empty">UPLOAD<br>UPI QR</div>`;
  }

  return `<div class="${className}"><img src="${qrSrc}" alt="UPI QR"></div>`;
}

function plainMoney(value) {
  return Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function numberToWordsIndian(numValue) {
  const n = Math.round(numValue || 0);
  if (n === 0) return 'zero';

  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  const belowHundred = (num) => {
    if (num < 20) return ones[num];
    return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  };

  const belowThousand = (num) => {
    let text = '';
    if (num >= 100) {
      text += ones[Math.floor(num / 100)] + ' hundred';
      num %= 100;
      if (num) text += ' and ';
    }
    if (num) text += belowHundred(num);
    return text;
  };

  let number = n;
  const crore = Math.floor(number / 10000000); number %= 10000000;
  const lakh = Math.floor(number / 100000); number %= 100000;
  const thousand = Math.floor(number / 1000); number %= 1000;
  const parts = [];
  if (crore) parts.push(belowThousand(crore) + ' crore');
  if (lakh) parts.push(belowThousand(lakh) + ' lakh');
  if (thousand) parts.push(belowThousand(thousand) + ' thousand');
  if (number) parts.push(belowThousand(number));
  return parts.join(' ');
}

window.removeCartItem = removeCartItem;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.printInvoiceById = printInvoiceById;



/* =====================================================
   Premium UI V2.1 helper controls
   Makes concept/demo controls interactive without backend changes.
===================================================== */
function bindPremiumUiControls() {
  if (window.__premiumUiControlsBound) return;
  window.__premiumUiControlsBound = true;

  bindLoginHelpers();
  bindProfileMenus();
  bindSmartSearchControls();
  bindPaginationControls();
  bindStockFilterControls();
  bindQuickPrintTools();
  bindStatCardShortcuts();
  bindInvoiceMoreMenu();
}

function showToast(message) {
  let toast = document.getElementById('premiumToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'premiumToast';
    toast.className = 'premium-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window.__premiumToastTimer);
  window.__premiumToastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function bindLoginHelpers() {
  const forgot = document.querySelector('.login-row a');
  if (forgot && !forgot.dataset.bound) {
    forgot.addEventListener('click', (event) => {
      event.preventDefault();
      alert('Default admin login:\nEmail: admin@billing.local\nPassword: admin123\n\nFor production, password reset can be connected after deployment.');
    });
    forgot.dataset.bound = 'true';
  }

  const passwordEye = document.querySelector('.login-form .input-icon em');
  const passwordInput = document.getElementById('loginPassword');
  if (passwordEye && passwordInput && !passwordEye.dataset.bound) {
    passwordEye.style.cursor = 'pointer';
    passwordEye.title = 'Show / hide password';
    passwordEye.addEventListener('click', () => {
      passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordEye.textContent = passwordInput.type === 'password' ? '◉' : '◎';
    });
    passwordEye.dataset.bound = 'true';
  }
}

function bindProfileMenus() {
  document.querySelectorAll('.profile-chip').forEach((chip) => {
    if (chip.dataset.bound) return;
    chip.dataset.bound = 'true';
    chip.tabIndex = 0;
    chip.setAttribute('role', 'button');
    chip.title = 'Account menu';

    const menu = document.createElement('div');
    menu.className = 'profile-menu';
    menu.innerHTML = `
      <strong>Salem</strong>
      <small>Admin workspace</small>
      <button type="button" data-profile-action="settings">Business Settings</button>
      <button type="button" data-profile-action="print">Print Support</button>
      <button type="button" data-profile-action="logout">Logout</button>
    `;
    chip.appendChild(menu);

    chip.addEventListener('click', (event) => {
      if (event.target.closest('[data-profile-action]')) return;
      event.stopPropagation();
      document.querySelectorAll('.profile-chip.open').forEach((openChip) => {
        if (openChip !== chip) openChip.classList.remove('open');
      });
      chip.classList.toggle('open');
    });
  });

  document.addEventListener('click', (event) => {
    const profileAction = event.target.closest('[data-profile-action]');
    if (profileAction) {
      event.stopPropagation();
      const action = profileAction.dataset.profileAction;
      document.querySelectorAll('.profile-chip.open').forEach(chip => chip.classList.remove('open'));
      if (action === 'settings') switchTab('settings');
      if (action === 'print') switchTab('printSupport');
      if (action === 'logout') {
        localStorage.removeItem('billing_token');
        location.reload();
      }
      return;
    }
    document.querySelectorAll('.profile-chip.open').forEach(chip => chip.classList.remove('open'));
  });
}

function bindSmartSearchControls() {
  document.querySelectorAll('.search-box input').forEach((input) => {
    if (input.dataset.bound) return;
    input.dataset.bound = 'true';
    input.addEventListener('input', () => applySmartSearch(input));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        input.value = '';
        applySmartSearch(input);
      }
    });
  });
}

function applySmartSearch(input) {
  const value = input.value.trim().toLowerCase();
  const section = input.closest('.tab-section') || document.querySelector('.tab-section.active');
  if (!section) return;

  if (section.id === 'billing') {
    filterTableRows(document.getElementById('billingStockBody'), value);
    filterTableRows(document.getElementById('billingHistoryBody'), value);
    filterTableRows(document.getElementById('cartBody'), value);
  } else if (section.id === 'stock') {
    filterTableRows(document.getElementById('stockBody'), value);
  } else if (section.id === 'history') {
    filterTableRows(document.getElementById('historyBody'), value);
  } else if (section.id === 'settings') {
    highlightMatchingLabels(section, value);
  } else if (section.id === 'printSupport') {
    filterPrintSupportCards(value);
  }
}

function filterTableRows(tbody, value) {
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(row => {
    const isEmpty = row.classList.contains('empty') || row.querySelector('.empty');
    if (isEmpty) return;
    row.hidden = value ? !row.textContent.toLowerCase().includes(value) : false;
  });
}

function highlightMatchingLabels(section, value) {
  section.querySelectorAll('label').forEach(label => {
    const matched = value && label.textContent.toLowerCase().includes(value);
    label.classList.toggle('search-hit', Boolean(matched));
  });
}

function filterPrintSupportCards(value) {
  const printSection = document.getElementById('printSupport');
  if (!printSection) return;
  printSection.querySelectorAll('.print-grid > .card').forEach(card => {
    card.hidden = value ? !card.textContent.toLowerCase().includes(value) : false;
  });
}

function bindPaginationControls() {
  document.querySelectorAll('.pagination').forEach((pager) => {
    if (pager.dataset.bound) return;
    pager.dataset.bound = 'true';
    pager.addEventListener('click', (event) => {
      const btn = event.target.closest('button');
      if (!btn) return;
      const label = btn.textContent.trim();
      if (/^\d+$/.test(label)) {
        pager.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showToast(`Page ${label} selected. Full backend pagination can be connected during deployment.`);
      } else {
        showToast('Pagination control ready. Backend page loading can be connected later.');
      }
    });
  });

  document.querySelectorAll('#history .table-footer > .outline-action').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => showToast('Rows-per-page selector ready. Showing current loaded invoices.'));
  });
}

function bindStockFilterControls() {
  const filterButtons = Array.from(document.querySelectorAll('#stock button')).filter(btn => btn.textContent.toLowerCase().includes('filter'));
  filterButtons.forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = 'true';
    btn.dataset.filterMode = 'all';
    btn.addEventListener('click', () => {
      const next = btn.dataset.filterMode === 'all' ? 'in' : btn.dataset.filterMode === 'in' ? 'low' : btn.dataset.filterMode === 'low' ? 'out' : 'all';
      btn.dataset.filterMode = next;
      applyStockStatusFilter(next);
      const label = next === 'all' ? 'All stock' : next === 'in' ? 'In stock only' : next === 'low' ? 'Low stock only' : 'Out of stock only';
      btn.innerHTML = `⌁ ${label}`;
      showToast(`Filter: ${label}`);
    });
  });
}

function applyStockStatusFilter(mode) {
  const tbody = document.getElementById('stockBody');
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(row => {
    const text = row.textContent.toLowerCase();
    if (mode === 'all') row.hidden = false;
    if (mode === 'in') row.hidden = !text.includes('in stock');
    if (mode === 'low') row.hidden = !text.includes('low stock');
    if (mode === 'out') row.hidden = !text.includes('out of stock');
  });
}

function bindQuickPrintTools() {
  const printSection = document.getElementById('printSupport');
  if (!printSection) return;

  printSection.querySelectorAll('.tool-list > div').forEach((tool, index) => {
    if (tool.dataset.bound) return;
    tool.dataset.bound = 'true';
    tool.tabIndex = 0;
    tool.setAttribute('role', 'button');
    tool.addEventListener('click', () => {
      if (index === 0) {
        document.querySelector('.printer-setup-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('Printer setup guide opened.');
      } else if (index === 1) {
        downloadPrintSetupTips();
      } else if (index === 2) {
        alert('Print Settings:\n\nA4 Invoice:\n• Paper: A4\n• Scale: 100%\n• Headers/Footers: Off\n• Background Graphics: On\n\nThermal:\n• Paper: 80mm\n• Scale: 100%\n• Margins: None/Default');
      } else {
        printSampleInvoice('a4');
      }
    });
  });

  printSection.querySelectorAll('.issues-list button').forEach((btn, index) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => {
      const fixes = [
        'Extra blank page fix:\nUse A4 paper, scale 100%, turn off headers/footers, and do not enable Fit to page.',
        'Logo/QR not printing fix:\nEnable Background graphics / Print backgrounds in browser print settings.',
        'Thermal width fix:\nSelect 80mm paper and keep content width around 72mm.',
        'Content cut fix:\nUse 100% scale, reduce margins, and print a test page first.'
      ];
      alert(fixes[index] || 'Check browser print settings and try again.');
    });
  });
}

function downloadPrintSetupTips() {
  const content = `GST BillPro Print Setup Tips\n\nA4 Invoice\n- Paper size: A4\n- Scale: 100%\n- Headers and footers: Off\n- Background graphics: On\n- Margins: Default or None\n\nThermal Bill\n- Paper size: 80mm\n- Scale: 100%\n- Content width: 72mm\n- Use test print before client delivery\n`;
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'GST-BillPro-Print-Setup-Tips.txt';
  link.click();
  URL.revokeObjectURL(url);
  showToast('Print setup tips downloaded.');
}

function bindStatCardShortcuts() {
  const shortcutMap = [
    ['totalProducts', () => switchTab('stock')],
    ['lowStockCount', () => { switchTab('stock'); setTimeout(() => applyStockStatusFilter('low'), 50); }],
    ['totalInvoices', () => switchTab('history')],
    ['stockTotalProducts', () => showToast('All products are already shown below.')],
    ['stockValue', () => showToast('Stock value = rate × current stock.')],
    ['stockLowCount', () => applyStockStatusFilter('low')],
    ['stockOutCount', () => applyStockStatusFilter('out')],
    ['historyTotalInvoices', () => showToast('All loaded invoices are shown below.')],
    ['historyPaidInvoices', () => filterHistoryByStatus('paid')],
    ['historyPendingBalance', () => filterHistoryByBalance()],
    ['historyCancelledBills', () => filterHistoryByStatus('cancelled')]
  ];

  shortcutMap.forEach(([id, handler]) => {
    const el = document.getElementById(id)?.closest('.stat-card');
    if (el && !el.dataset.bound) {
      el.dataset.bound = 'true';
      el.classList.add('clickable-card');
      el.addEventListener('click', handler);
    }
  });
}

function filterHistoryByStatus(status) {
  const tbody = document.getElementById('historyBody');
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(row => {
    row.hidden = !row.textContent.toLowerCase().includes(status);
  });
  showToast(`History filtered: ${status}`);
}

function filterHistoryByBalance() {
  const tbody = document.getElementById('historyBody');
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(row => {
    const text = row.textContent.toLowerCase();
    row.hidden = text.includes('₹0.00') && text.includes('paid');
  });
  showToast('History filtered: pending balance');
}

function bindInvoiceMoreMenu() {
  document.addEventListener('click', (event) => {
    const moreBtn = event.target.closest('.row-more-btn');
    const existing = document.getElementById('invoiceMoreMenu');
    if (existing && !moreBtn && !event.target.closest('#invoiceMoreMenu')) existing.remove();
    if (!moreBtn) return;

    event.stopPropagation();
    if (existing) existing.remove();

    const id = moreBtn.dataset.invoiceId;
    const menu = document.createElement('div');
    menu.id = 'invoiceMoreMenu';
    menu.className = 'invoice-more-menu';
    menu.innerHTML = `
      <button type="button" data-action="view">View Details</button>
      <button type="button" data-action="a4">Print A4</button>
      <button type="button" data-action="thermal">Print Thermal</button>
      <button type="button" data-action="cancel">Cancel Invoice</button>
    `;
    document.body.appendChild(menu);
    const rect = moreBtn.getBoundingClientRect();
    menu.style.left = Math.max(12, rect.right - 170) + 'px';
    menu.style.top = (rect.bottom + 8) + 'px';

    menu.addEventListener('click', (menuEvent) => {
      const actionBtn = menuEvent.target.closest('button[data-action]');
      if (!actionBtn) return;
      const action = actionBtn.dataset.action;
      menu.remove();
      if (action === 'view') return viewInvoiceById(id);
      if (action === 'a4') return printInvoiceById(id, 'a4');
      if (action === 'thermal') return printInvoiceById(id, 'thermal');
      if (action === 'cancel') return cancelInvoiceById(id);
    });
  });
}

function viewInvoiceById(id) {
  const inv = state.invoices.find(invoice => String(invoice.id) === String(id));
  if (!inv) {
    alert('Invoice not found.');
    return;
  }
  alert(`Invoice: ${inv.invoiceNo}\nCustomer: ${inv.customer?.name || '-'}\nTotal: ${money(inv.totals?.grand || 0)}\nPaid: ${money(inv.totals?.paid || 0)}\nBalance: ${money(inv.totals?.balance || 0)}\nStatus: ${invoiceStatus(inv)}`);
}

function createSampleInvoice() {
  const items = [
    { id: 'sample-1', productId: null, name: 'Lays Classic Salted (52g)', hsn: '2005', unit: 'Pkt', qty: 40, rate: 20, gst: 18 },
    { id: 'sample-2', productId: null, name: 'Britannia Marie Gold (150g)', hsn: '1905', unit: 'Pkt', qty: 60, rate: 30, gst: 18 },
    { id: 'sample-3', productId: null, name: 'Tata Tea Premium (250g)', hsn: '0902', unit: 'Pkt', qty: 20, rate: 130, gst: 18 },
    { id: 'sample-4', productId: null, name: 'Coca Cola PET Bottle (2.25 Ltr)', hsn: '2202', unit: 'Btl', qty: 24, rate: 82.2, gst: 18 },
    { id: 'sample-5', productId: null, name: 'Freedom Refined Sunflower Oil 1L', hsn: '1512', unit: 'Pch', qty: 30, rate: 112, gst: 18 },
    { id: 'sample-6', productId: null, name: 'Surf Excel Matic Top Load (1 kg)', hsn: '3402', unit: 'Box', qty: 18, rate: 210, gst: 18 }
  ].map(item => {
    const taxable = item.qty * item.rate;
    const taxAmount = taxable * item.gst / 100;
    return { ...item, taxable, taxAmount, total: taxable + taxAmount };
  });

  const taxable = items.reduce((sum, item) => sum + item.taxable, 0);
  const tax = items.reduce((sum, item) => sum + item.taxAmount, 0);
  const rawTotal = taxable + tax;
  const grand = Math.round(rawTotal);
  const paid = Math.min(10000, grand);
  return {
    id: 'sample-preview',
    invoiceNo: 'GST-2026-27-0001',
    invoiceDate: todayISO(),
    challanDate: todayISO(),
    ewayBill: '5217 6543 2109',
    transport: 'Local Delivery',
    paymentMode: 'UPI',
    taxType: 'CGST_SGST',
    customer: {
      name: 'RAHUL ENTERPRISES',
      phone: '+91 98844 56789',
      email: 'buyer@example.com',
      gstin: '33AAKFS1234P1ZV',
      address: '12, MG Road, Salem - 636001, Tamil Nadu.',
      placeOfSupply: 'Tamil Nadu (33)'
    },
    items,
    totals: {
      taxable,
      tax,
      rawTotal,
      roundOff: grand - rawTotal,
      grand,
      paid,
      balance: grand - paid
    }
  };
}

function getPreviewInvoice() {
  const current = getInvoiceFromForm();
  const error = validateInvoice(current);
  return error ? createSampleInvoice() : current;
}

function openPrintPreview(mode) {
  const invoice = getPreviewInvoice();
  const html = mode === 'a4' ? buildA4Invoice(invoice) : buildThermalInvoice(invoice);
  let modal = document.getElementById('printPreviewModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'printPreviewModal';
    modal.className = 'print-preview-modal';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="preview-toolbar">
      <strong>${mode === 'a4' ? 'A4 GST Invoice Preview' : 'Thermal Bill Preview'}</strong>
      <div>
        <button type="button" id="previewPrintBtn">Print</button>
        <button type="button" id="previewCloseBtn">Close</button>
      </div>
    </div>
    <div class="preview-stage ${mode === 'thermal' ? 'thermal-stage' : ''}">${html}</div>
  `;
  modal.classList.add('show');
  document.getElementById('previewCloseBtn').onclick = () => modal.classList.remove('show');
  document.getElementById('previewPrintBtn').onclick = () => printSampleInvoice(mode, invoice);
}

function printSampleInvoice(mode, invoice = null) {
  openStandalonePrint(mode, invoice || getPreviewInvoice());
}


/* =====================================================
   FINAL ISOLATED PRINT ENGINE - V3.2
   A4 and Thermal are printed in a fresh window with
   inline CSS only. This prevents all old CSS conflicts.
===================================================== */
function openStandalonePrint(mode, invoice) {
  const html = mode === 'thermal' ? buildThermalInvoice(invoice) : buildA4Invoice(invoice);
  const css = mode === 'thermal' ? getStandaloneThermalCss() : getStandaloneA4Css();
  const title = mode === 'thermal' ? `${state.settings?.businessName || 'Sri Vinayaga Traders'} Thermal Bill` : `${state.settings?.businessName || 'Sri Vinayaga Traders'} A4 Invoice`;

  const printWindow = window.open('', '_blank', 'width=1000,height=800');
  if (!printWindow) {
    alert('Popup blocked. Please allow popups for this site and try again.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${css}</style>
</head>
<body>
  ${html}
  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 250);
    };
  <\/script>
</body>
</html>`);
  printWindow.document.close();
}

function getStandaloneA4Css() {
  return `
    @page {
      size: A4 portrait;
      margin: 7mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #07152e;
      font-family: Arial, Helvetica, sans-serif;
    }

    body {
      width: 196mm;
      min-height: 283mm;
      margin: 0 auto;
    }

    .vt-a4 {
      width: 196mm;
      height: 283mm;
      padding: 3.2mm;
      margin: 0 auto;
      background: #ffffff;
      border: 1.2px solid #0b3f78;
      overflow: hidden;
      display: grid;
      grid-template-rows: 34mm 10mm 34mm 94mm 49mm 34mm 8mm 4mm;
      gap: 1.6mm;
    }

    .vt-a4-header {
      display: grid;
      grid-template-columns: 30mm 1fr 57mm;
      gap: 3mm;
      align-items: center;
      border-bottom: 1px solid #0b3f78;
      padding-bottom: 1.5mm;
      overflow: hidden;
    }

    .vt-logo {
      width: 25mm;
      height: 25mm;
      border: 1.3px solid #0b3f78;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      color: #0b3f78;
      font-size: 19pt;
      font-weight: 900;
      margin: 0 auto;
    }
      .vt-logo-img {
  width: 25mm;
  height: 25mm;
  object-fit: contain;
  display: block;
  margin: 0 auto;
}

    .vt-logo span {
      position: relative;
      z-index: 2;
      letter-spacing: -1px;
    }

    .vt-logo::after {
      content: '';
      position: absolute;
      left: 4mm;
      bottom: 6mm;
      width: 17mm;
      height: 2.3mm;
      background: #15803d;
      transform: skewX(-24deg);
      border-radius: 2mm;
    }

    .vt-company {
      min-width: 0;
      overflow: hidden;
    }

    .vt-company h1 {
      margin: 0 0 1mm;
      font-size: 18.5pt;
      line-height: 1;
      color: #15803d;
      font-weight: 900;
      letter-spacing: -0.4px;
      white-space: nowrap;
    }

    .vt-company h1 span { color: #0b3f78; }

    .vt-company h2 {
      margin: 0 0 1mm;
      font-size: 7.7pt;
      line-height: 1.1;
      color: #0b3f78;
      font-weight: 800;
    }

    .vt-company p,
    .vt-company div {
      margin: 0.45mm 0;
      font-size: 6.4pt;
      line-height: 1.22;
      color: #111827;
    }

    .vt-company b { color: #0b3f78; }
    .vt-company .sep { margin: 0 2mm; }

    .vt-invoice-meta {
  height: 100%;
  border: 1px solid #0b3f78;
  border-radius: 1mm;
  padding: 3mm;
  font-size: 6.4pt;
  line-height: 1.18;
  overflow: hidden;
  background: #ffffff;
}
    .vt-invoice-meta div {
  display: grid;
  grid-template-columns: 22mm 1fr;
  gap: 1mm;
  margin-bottom: 0.65mm;
}s

    .vt-invoice-meta b { color: #0b3f78; }
    .vt-invoice-meta span { font-weight: 700; color: #111827; }
    .vt-invoice-meta hr {
  border: 0;
  border-top: 1px solid #8eb0d5;
  margin: 1mm 0;
}

    .vt-title {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4mm;
      height: 10mm;
      color: #0b3f78;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 16pt;
      font-weight: 900;
      letter-spacing: .4px;
    }

    .vt-title span {
      width: 28mm;
      border-top: 1.2px solid #15803d;
      position: relative;
    }

    .vt-title span::after {
      content: '';
      width: 2mm;
      height: 2mm;
      border-radius: 50%;
      background: #15803d;
      position: absolute;
      top: -1.15mm;
      right: -1mm;
    }

    .vt-two-panels {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2mm;
      height: 34mm;
    }

    .vt-panel {
      border: 1px solid #8eb0d5;
      border-radius: 1.2mm;
      padding: 2mm;
      overflow: hidden;
      font-size: 6.8pt;
      line-height: 1.28;
    }

    .vt-panel h3 {
      display: inline-block;
      background: #0b3f78;
      color: #fff;
      height: 5.2mm;
      line-height: 5.2mm;
      font-size: 7pt;
      padding: 0 2.2mm;
      margin: -0.8mm 0 1.5mm;
      border-radius: 0.5mm;
    }

    .vt-panel strong {
      display: block;
      color: #111827;
      font-size: 8pt;
      margin-bottom: 1mm;
    }

    .vt-panel p { margin: 0 0 1mm; }
    .vt-kv { display: grid; grid-template-columns: 22mm 1fr; gap: 1mm; margin: 0.55mm 0; }
    .vt-kv b { color: #111827; }

    .vt-items {
      width: 100%;
      height: 94mm;
      table-layout: fixed;
      border-collapse: collapse;
      font-size: 6.35pt;
      line-height: 1.12;
    }

    .vt-items col.sno { width: 6mm; }
    .vt-items col.pdesc { width: 35mm; }
    .vt-items col.hsn { width: 14mm; }
    .vt-items col.batch { width: 11mm; }
    .vt-items col.qty { width: 8mm; }
    .vt-items col.unit { width: 8mm; }
    .vt-items col.rate { width: 11mm; }
    .vt-items col.discount { width: 13mm; }
    .vt-items col.taxable { width: 16mm; }
    .vt-items col.tax { width: 8mm; }
    .vt-items col.line { width: 15mm; }

    .vt-items th {
      height: 8mm;
      padding: 0.8mm 0.45mm;
      background: #0b3f78;
      color: #ffffff;
      border: 0.65px solid #8eb0d5;
      text-align: center;
      font-size: 5.7pt;
      font-weight: 900;
      vertical-align: middle;
    }

    .vt-items td {
      height: 7.35mm;
      padding: 0.7mm 0.45mm;
      border: 0.65px solid #8eb0d5;
      color: #111827;
      overflow: hidden;
      vertical-align: middle;
    }

    .vt-items .desc { text-align: left; font-weight: 800; }
    .vt-items .c { text-align: center; }
    .vt-items .r { text-align: right; }
    .vt-items .strong { font-weight: 900; }
    .vt-items tfoot td { height: 6.5mm; font-weight: 900; color: #0b3f78; }

    .vt-lower-grid {
      height: 49mm;
      display: grid;
      grid-template-columns: 1.18fr 1fr;
      gap: 2mm;
      overflow: hidden;
    }

    .vt-left-block {
      height: 49mm;
      border: 1px solid #8eb0d5;
      overflow: hidden;
    }

    .vt-words {
      height: 13mm;
      padding: 2mm;
      border-bottom: 1px solid #8eb0d5;
    }

    .vt-words h4, .vt-bank h4, .vt-upi h4, .vt-terms h4, .vt-sign h4 {
      margin: 0 0 1mm;
      font-size: 7.2pt;
      color: #15803d;
      line-height: 1.15;
    }

    .vt-words p { margin: 0; font-size: 7pt; font-weight: 700; }

    .vt-bankpay {
      height: 36mm;
      padding: 2mm 1.4mm 2mm 2mm;
      display: grid;
      grid-template-columns: 1fr 34mm;
      gap: 2.4mm;
      align-items: start;
    }

    .vt-bank,
    .vt-upi {
      font-size: 6.4pt;
      line-height: 1.2;
      overflow: hidden;
    }

    .vt-bank .vt-kv {
      grid-template-columns: 19mm 1fr;
      margin-bottom: 0.55mm;
    }

    .vt-upi {
      width: 32mm;
      min-height: 31mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      text-align: center;
      transform: translateX(1.6mm);
    }

    .vt-upi h4 {
      width: 100%;
      margin: 0 0 1mm;
      font-size: 6.7pt;
      line-height: 1.05;
      white-space: nowrap;
    }

    .vt-qr {
      width: 22mm;
      height: 22mm;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
      padding: 1mm;
      background: #ffffff;
      border: 0.45px solid #8eb0d5;
      overflow: hidden;
    }

    .vt-qr img {
      width: 20mm;
      height: 20mm;
      max-width: 20mm;
      max-height: 20mm;
      object-fit: contain;
      object-position: center;
      display: block;
      margin: 0;
      padding: 0;
      border: 0;
    }

    .vt-qr.qr-empty {
      color: #0b3f78;
      font-weight: 900;
      font-size: 5.3pt;
      line-height: 1.15;
      text-align: center;
    }

    .vt-upi small {
      display: block;
      width: 100%;
      margin-top: 0.65mm;
      text-align: center;
      font-size: 4.8pt;
      line-height: 1.05;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: clip;
    }

    .vt-totals {
      height: 49mm;
      border: 1px solid #8eb0d5;
      overflow: hidden;
    }

    .vt-totals div {
      min-height: 4.65mm;
      display: grid;
      grid-template-columns: 1fr 33mm;
      align-items: center;
      padding: 0 2mm;
      border-bottom: 1px solid #8eb0d5;
      font-size: 7pt;
    }

    .vt-totals b { text-align: right; }
    .vt-totals .green { color: #15803d; font-weight: 900; }
    .vt-totals .grand { background: #0b3f78; color: #fff; min-height: 7mm; font-weight: 900; font-size: 8.5pt; }
    .vt-totals .grand b { font-size: 11pt; }
    .vt-totals .balance { color: #15803d; font-weight: 900; }
    .vt-totals .balance b { font-size: 10pt; }

    .vt-bottom-panels {
      height: 34mm;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2mm;
      overflow: hidden;
    }

    .vt-terms, .vt-sign {
      height: 34mm;
      border: 1px solid #8eb0d5;
      border-radius: 1.2mm;
      padding: 2mm;
      overflow: hidden;
    }

    .vt-terms ol { margin: 0 0 0 4mm; padding: 0; font-size: 6.6pt; line-height: 1.32; }
    .vt-sign { text-align: center; color: #0b3f78; }
    .vt-sign h4 { color: #0b3f78; text-align: left; font-size: 8pt; }
    .vt-sign div { height: 15mm; margin: 4mm 18mm 2mm; border-bottom: 1px dashed #0b3f78; }
    .vt-sign b { font-size: 7pt; }

    .vt-footer {
      height: 8mm;
      background: #0b3f78;
      color: #fff;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      align-items: center;
      text-align: center;
      font-size: 7.8pt;
      font-weight: 800;
    }

    .vt-note {
      height: 4mm;
      line-height: 4mm;
      text-align: center;
      font-size: 7pt;
      color: #0b3f78;
    }
  `;
}

function getStandaloneThermalCss() {
  return `
    @page { size: 80mm 260mm; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { margin: 0; padding: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; color: #111; }
    body { width: 80mm; margin: 0 auto; }

    .vt-thermal {
      width: 80mm;
      min-height: 150mm;
      padding: 3mm 4mm;
      background: #fff;
      color: #111;
      overflow: hidden;
    }

    .vt-t-logo {
    .vt-t-logo-img {
  width: 12mm !important;
  height: 12mm !important;
  max-width: 12mm !important;
  max-height: 12mm !important;
  object-fit: contain !important;
  display: block !important;
  margin: 0 auto 0.8mm !important;
}
      width: 21mm; height: 21mm; margin: 0 auto 1mm; border: 1px solid #0b3f78; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; position: relative; color: #0b3f78; font-size: 17pt; font-weight: 900;
    }
    .vt-t-logo::after { content: ''; position: absolute; left: 4mm; bottom: 5mm; width: 14mm; height: 2mm; background: #15803d; transform: skewX(-24deg); border-radius: 2mm; }
    .vt-t-logo span { position: relative; z-index: 2; }

    .vt-thermal h1 { margin: 0; text-align: center; font-size: 18pt; line-height: 0.95; color: #0b3f78; font-weight: 900; }
    .vt-thermal h1 em { color: #15803d; font-style: normal; }
    .vt-thermal h2 { margin: 1mm 0 2mm; text-align: center; font-size: 8.2pt; line-height: 1.15; color: #0b3f78; }
    .vt-thermal p { margin: 0.8mm 0; text-align: center; font-size: 7.5pt; line-height: 1.25; }
    .vt-thermal .addr { text-align: left; padding-left: 3mm; }
    .dash { border-top: 1px dashed #0b3f78; margin: 2mm 0; }
    .vt-thermal h3 { margin: 0 0 1.5mm; text-align: center; font-family: Georgia, 'Times New Roman', serif; font-size: 15pt; color: #0b3f78; }

    .meta { display: grid; grid-template-columns: 20mm 1fr 16mm 1fr; gap: 1mm; font-size: 7.5pt; line-height: 1.25; }
    .meta b { color: #111; }

    .vt-t-items { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 7.3pt; }
    .vt-t-items th { background: #0b3f78; color: #fff; padding: 1.2mm 0.6mm; text-transform: uppercase; }
    .vt-t-items td { padding: 1mm 0.6mm; border-bottom: 1px solid #d6e0ec; vertical-align: top; }
    .vt-t-items th:nth-child(1), .vt-t-items td.no { width: 5mm; text-align: center; }
    .vt-t-items th:nth-child(3), .vt-t-items td.c { width: 13mm; text-align: center; }
    .vt-t-items th:nth-child(4), .vt-t-items td.r { width: 12mm; text-align: right; }
    .vt-t-items th:nth-child(5), .vt-t-items td.r:last-child { width: 15mm; text-align: right; }

    .vt-t-sum { font-size: 8.2pt; }
    .vt-t-sum div { display: grid; grid-template-columns: 1fr 24mm; align-items: center; margin: 1mm 0; }
    .vt-t-sum b { text-align: right; }
    .vt-t-sum .green { color: #15803d; font-weight: 900; }
    .vt-t-sum .grand { background: #0b3f78; color: #fff; padding: 1.2mm 1.5mm; font-size: 10pt; font-weight: 900; margin: 2mm 0; }
    .vt-t-sum .grand b { font-size: 15pt; }

    .vt-t-pay {
      border: 1px solid #0b3f78;
      border-radius: 1.5mm;
      padding: 2mm;
      margin-top: 2mm;
      display: grid;
      grid-template-columns: 31mm 1fr;
      gap: 2mm;
      align-items: center;
    }
    .vt-t-pay b { display: block; margin-bottom: 1mm; font-size: 8pt; text-align: center; color: #0b3f78; }
    .vt-t-pay small { display: block; font-size: 5.6pt; text-align: center; }
    .vt-t-pay p {
      border-left: 1px solid #0b3f78;
      padding-left: 2mm;
      text-align: center;
      color: #0b3f78;
      font-weight: 900;
      font-size: 8.5pt;
    }
    .vt-t-qr { width: 27mm; height: 27mm; display: block; margin: 0 auto; }
    .vt-t-qr img { width: 100%; height: 100%; object-fit: contain; }

    .vt-t-terms { margin-top: 2mm; border-top: 1px solid #8eb0d5; padding-top: 2mm; font-size: 6.8pt; line-height: 1.3; }
    .vt-t-terms b { color: #0b3f78; font-size: 9pt; display: block; margin-bottom: 1mm; }
    .vt-t-thanks { margin-top: 2mm; padding-top: 2mm; border-top: 1px dashed #0b3f78; text-align: center; font-weight: 900; color: #0b3f78; font-size: 9pt; }
    .vt-t-note { margin-top: 1.5mm; background: #0b3f78; color: #fff; text-align: center; padding: 1.2mm; font-size: 7pt; border-radius: 1mm; }
  `;
}

document.addEventListener('DOMContentLoaded', init);
