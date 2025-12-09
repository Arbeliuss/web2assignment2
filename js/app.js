const DATA_URL = "https://gist.githubusercontent.com/rconnolly/d37a491b50203d66d043c26f33dbd798/raw/37b5b68c527ddbe824eaed12073d266d5455432a/clothing-compact.json";
const STORAGE_KEY = "comp3512-clothing-data";
const CART_KEY = "comp3512-cart";
const TAX_RATE = 0.05;


// global data
let allProducts = [];
let cartItems = [];

// routing + about dialog
document.addEventListener("DOMContentLoaded", function () {
    // 1. cache references to all view <article> elements
    const views = {
        home: document.getElementById("view-home"),
        browse: document.getElementById("view-browse"),
        product: document.getElementById("view-product"),
        cart: document.getElementById("view-cart")
    };

    // 2. simple function to show one view and hide the others
    function showView(name) {
        for (let key in views) {
            if (key === name) {
                views[key].style.display = "block";
            } else {
                views[key].style.display = "none";
            }
        }
    }

    // expose it so openSingleProduct can use it
    window._showView = showView;

    const homeShopBtn = document.getElementById("homeShopBtn");
    if (homeShopBtn) {
        homeShopBtn.addEventListener("click", function () {
            showView("browse");
        });
    }
    const filterToggleBtn = document.getElementById("browse-filter-toggle");
    const browseControls = document.getElementById("browse-controls");

    if (filterToggleBtn && browseControls) {
        filterToggleBtn.addEventListener("click", function () {
            browseControls.classList.toggle("hidden");
        });
    }


    // 3. hook up nav buttons (they have data-view attributes)
    const navButtons = document.querySelectorAll("nav button[data-view]");
    navButtons.forEach(btn => {
        btn.addEventListener("click", function () {
            const viewName = btn.getAttribute("data-view");
            showView(viewName);
        });
    });

    // 4. about dialog logic
    const aboutDialog = document.getElementById("aboutDialog");
    const aboutBtn = document.getElementById("aboutBtn");
    const aboutCloseBtn = document.getElementById("aboutCloseBtn");

    aboutBtn.addEventListener("click", function () {
        aboutDialog.showModal();
    });

    aboutCloseBtn.addEventListener("click", function () {
        aboutDialog.close();
    });

    // 5. load data, then render views
    loadProducts()
        .then(products => {
            allProducts = products;
            console.log("Products loaded:", allProducts.length);

            initFilters(allProducts);
            applyFiltersAndSort();

            cartItems = retrieveCart();
            renderCart();
            updateCartCount();
        })

        .catch(err => {
            console.error("Problem loading products:", err);
        });
    const regionSelect = document.getElementById("shipping-region");
    const methodSelect = document.getElementById("shipping-method");

    if (regionSelect && methodSelect) {
        regionSelect.addEventListener("change", function () {
            const merchTotal = getMerchandiseTotal();
            updateCartSummary(merchTotal);
        });

        methodSelect.addEventListener("change", function () {
            const merchTotal = getMerchandiseTotal();
            updateCartSummary(merchTotal);
        });
    }


    // 6. initial view when page loads
    showView("home");
});

// ---------------------- data loading ----------------------

function loadProducts() {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
        const products = JSON.parse(stored);
        return Promise.resolve(products);
    } else {
        return fetch(DATA_URL)
            .then(resp => {
                if (!resp.ok) {
                    throw new Error("Network response was not ok: " + resp.status);
                }
                return resp.json();
            })
            .then(data => {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                return data;
            });
    }
}

// ---------------------- browse view ----------------------

function renderBrowse(list) {
    const container = document.getElementById("browse-results");
    const countSpan = document.getElementById("browse-count");

    if (countSpan) {
        countSpan.textContent = list.length;
    }

    container.innerHTML = "";

    if (list.length === 0) {
        const msg = document.createElement("p");
        msg.textContent = "No matching products found. Try adjusting your filters.";
        container.appendChild(msg);
        return;
    }

    list.forEach(item => {
        const card = document.createElement("div");
        card.classList.add("product-card");
        card.dataset.id = item.id;

        const img = document.createElement("img");
        img.src = "https://placehold.co/300x300/png?text=Item&font=roboto&rounded=true";
        img.alt = item.name;
        img.classList.add("product-img");

        const title = document.createElement("h3");
        title.textContent = item.name;

        const price = document.createElement("p");
        price.textContent = "$" + item.price.toFixed(2);

        // Add to Cart button
        const addBtn = document.createElement("button");
        addBtn.textContent = "Add to Cart";

        // clicking the card opens single product
        card.addEventListener("click", function () {
            openSingleProduct(item.id);
        });

        // clicking the button adds to cart only (no navigation)
        addBtn.addEventListener("click", function (evt) {
            evt.stopPropagation();   // prevent card click
            addToCart(item, 1);
        });

        card.appendChild(img);
        card.appendChild(title);
        card.appendChild(price);
        card.appendChild(addBtn);

        container.appendChild(card);
    });
}



// ---------------------- single product view ----------------------

function openSingleProduct(id) {
    const product = allProducts.find(p => p.id === id);
    if (!product) return;

    const view = document.getElementById("view-product");

    view.innerHTML = `
    <nav class="breadcrumbs">
      <span class="crumb" data-view="home">Home</span> /
      <span class="crumb" data-view="browse">Browse</span> /
      <span>${product.category}</span> /
      <span>${product.name}</span>
    </nav>

    <h2>${product.name}</h2>

    <div class="product-detail-layout">
      <div class="product-detail-main">
        <p><strong>Price:</strong> $${product.price.toFixed(2)}</p>
        <p><strong>Description:</strong> ${product.description}</p>
        <p><strong>Material:</strong> ${product.material}</p>

        <h3>Available Sizes</h3>
        <p>${product.sizes.join(", ")}</p>

        <h3>Colors</h3>
        <ul>
          ${product.color.map(c => `<li>${c.name} (${c.hex})</li>`).join("")}
        </ul>

        <div class="product-actions">
          <label>
            Quantity:
            <input type="number" id="product-qty" min="1" value="1">
          </label>
          <button id="addToCartBtn" data-id="${product.id}">
            Add to Cart
          </button>
        </div>
      </div>

      <aside class="product-related">
        <h3>Related Products</h3>
        <div id="related-products"></div>
      </aside>
    </div>
`;


    const addBtn = document.getElementById("addToCartBtn");
    addBtn.addEventListener("click", function () {
        const qtyInput = document.getElementById("product-qty");
        const qty = Number(qtyInput.value) || 1;
        addToCart(product, qty);
    });

    const crumbs = view.querySelectorAll(".breadcrumbs .crumb");
    crumbs.forEach(crumb => {
        crumb.addEventListener("click", function () {
            const targetView = crumb.getAttribute("data-view");
            const navViewFn = getShowViewFunction();
            navViewFn(targetView);
        });
    });

    renderRelatedProducts(product);

    const navViewFn = getShowViewFunction();
    navViewFn("product");

}
function renderRelatedProducts(product) {
    const container = document.getElementById("related-products");
    if (!container) return;

    container.innerHTML = "";

    // simple strategy: same category, different id, limit to 4
    const related = allProducts
        .filter(p => p.category === product.category && p.id !== product.id)
        .slice(0, 4);

    if (related.length === 0) {
        const msg = document.createElement("p");
        msg.textContent = "No related products.";
        container.appendChild(msg);
        return;
    }

    related.forEach(item => {
        const card = document.createElement("div");
        card.classList.add("product-card", "related-card");
        card.dataset.id = item.id;

        const title = document.createElement("p");
        title.textContent = item.name;

        const price = document.createElement("p");
        price.textContent = `$${item.price.toFixed(2)}`;

        card.appendChild(title);
        card.appendChild(price);

        card.addEventListener("click", function () {
            openSingleProduct(item.id);
        });

        container.appendChild(card);
    });
}


function getShowViewFunction() {
    return window._showView;
}

// ---------------------- cart helpers ----------------------

function retrieveCart() {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
}

function updateCartStorage() {
    localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
}

function computeShipping(merchTotal, region, method) {
    // free shipping over $500
    if (merchTotal > 500) {
        return 0;
    }

    // enforce assignment constraints:
    // Standard: $10, Canada only
    // Express: 15–40 depending on region
    // Priority: 35–50 depending on region

    if (method === "standard") {
        if (region === "canada") return 10;
        if (region === "usa") return 15;
        if (region === "intl") return 30;
    }

    if (method === "express") {
        if (region === "canada") return 15;
        if (region === "usa") return 25;
        if (region === "intl") return 40;
    }

    if (method === "priority") {
        if (region === "canada") return 35;
        if (region === "usa") return 40;
        if (region === "intl") return 50;
    }

    return 0;
}

function updateCartCount() {
    const headerCountEl = document.getElementById("cart-count");       // Cart (N) in nav
    const mainCountEl   = document.getElementById("cart-count-main");  // "N items" under My Bag

    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    if (headerCountEl) {
        headerCountEl.textContent = totalItems;
    }
    if (mainCountEl) {
        mainCountEl.textContent = totalItems;
    }
}



function getMerchandiseTotal() {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
}


function updateCartSummary(merchTotal) {
    const regionEl = document.getElementById("shipping-region");
    const methodEl = document.getElementById("shipping-method");
    const merchEl = document.getElementById("cart-merch");
    const shipEl = document.getElementById("cart-shipping");
    const taxEl = document.getElementById("cart-tax");
    const grandEl = document.getElementById("cart-grand");

    // protect in case cart view HTML isn't loaded for some reason
    if (!regionEl || !methodEl || !merchEl || !shipEl || !taxEl || !grandEl) {
        return;
    }

    const region = regionEl.value;
    const method = methodEl.value;

    const shipping = computeShipping(merchTotal, region, method);
    const taxableBase = merchTotal + shipping;
    const tax = taxableBase * TAX_RATE;
    const grand = taxableBase + tax;

    merchEl.textContent = `Merchandise Total: $${merchTotal.toFixed(2)}`;
    shipEl.textContent = `Shipping: $${shipping.toFixed(2)}`;
    taxEl.textContent = `Tax (5%): $${tax.toFixed(2)}`;
    grandEl.textContent = `Order Total: $${grand.toFixed(2)}`;
}


function addToCart(product, qty) {
    const existing = cartItems.find(item => item.id === product.id);

    if (existing) {
        existing.quantity += qty;   // FIXED spelling
    } else {
        cartItems.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: qty
        });
    }

    updateCartStorage();
    renderCart();
    updateCartCount();
}

function renderCart() {
    const container = document.getElementById("cart-items");
    if (!container) return;

    container.innerHTML = "";

    if (cartItems.length === 0) {
        const msg = document.createElement("p");
        msg.textContent = "Your cart is empty.";
        msg.classList.add("cart-empty-msg");
        container.appendChild(msg);
        updateCartSummary(0);
        return;
    }

    let total = 0;

    cartItems.forEach(item => {
        const row = document.createElement("div");
        row.classList.add("cart-row");

        // item name
        const nameSpan = document.createElement("span");
        nameSpan.textContent = item.name;

        // qty controls
        const qtySpan = document.createElement("span");
        const qtyControls = document.createElement("div");
        qtyControls.classList.add("cart-qty-controls");

        const minusBtn = document.createElement("button");
        minusBtn.textContent = "-";

        const qtyText = document.createElement("span");
        qtyText.textContent = item.quantity;

        const plusBtn = document.createElement("button");
        plusBtn.textContent = "+";

        qtyControls.appendChild(minusBtn);
        qtyControls.appendChild(qtyText);
        qtyControls.appendChild(plusBtn);
        qtySpan.appendChild(qtyControls);

        // subtotal
        const subSpan = document.createElement("span");
        const sub = item.price * item.quantity;
        subSpan.textContent = `$${sub.toFixed(2)}`;
        total += sub;

        // actions (remove)
        const actionsSpan = document.createElement("span");
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        removeBtn.classList.add("cart-remove-btn");
        actionsSpan.appendChild(removeBtn);

        row.appendChild(nameSpan);
        row.appendChild(qtySpan);
        row.appendChild(subSpan);
        row.appendChild(actionsSpan);

        // event handlers
        minusBtn.addEventListener("click", function () {
            changeCartQuantity(item.id, -1);
        });

        plusBtn.addEventListener("click", function () {
            changeCartQuantity(item.id, +1);
        });

        removeBtn.addEventListener("click", function () {
            removeFromCart(item.id);
        });

        container.appendChild(row);
    });

    updateCartSummary(total);
}

function changeCartQuantity(id, delta) {
    const item = cartItems.find(i => i.id === id);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
        // remove if zero or below
        cartItems = cartItems.filter(i => i.id !== id);
    }

    updateCartStorage();
    renderCart();
    updateCartCount();
}

function removeFromCart(id) {
    cartItems = cartItems.filter(i => i.id !== id);
    updateCartStorage();
    renderCart();
    updateCartCount();
}




function initFilters(products) {
    const categorySelect = document.getElementById("filter-category");
    const sizeSelect = document.getElementById("filter-size");
    const colorSelect = document.getElementById("filter-color");
    const genderSelect = document.getElementById("filter-gender");
    const sortSelect = document.getElementById("sort-by");
    const catNav = document.getElementById("browse-category-nav");

    // unique categories
    const categories = Array.from(new Set(products.map(p => p.category))).sort();

    // build category <select> options
    categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        categorySelect.appendChild(opt);
    });

    // build horizontal category nav
    if (catNav) {
        // clear in case called again
        catNav.innerHTML = "";

        // "All" pill
        const allBtn = document.createElement("button");
        allBtn.classList.add("browse-cat-pill", "active");
        allBtn.dataset.category = "all";
        allBtn.textContent = "All Items";
        catNav.appendChild(allBtn);

        allBtn.addEventListener("click", function () {
            setActiveCategoryPill(allBtn);
            categorySelect.value = "all";
            applyFiltersAndSort();
        });

        // one pill per category
        categories.forEach(cat => {
            const btn = document.createElement("button");
            btn.classList.add("browse-cat-pill");
            btn.dataset.category = cat;
            btn.textContent = cat;

            btn.addEventListener("click", function () {
                setActiveCategoryPill(btn);
                categorySelect.value = cat;
                applyFiltersAndSort();
            });

            catNav.appendChild(btn);
        });
    }

    // sizes
    const sizes = Array.from(
        new Set(products.flatMap(p => p.sizes))
    ).sort();
    sizes.forEach(sz => {
        const opt = document.createElement("option");
        opt.value = sz;
        opt.textContent = sz;
        sizeSelect.appendChild(opt);
    });

    // colors
    const colors = Array.from(
        new Set(products.flatMap(p => p.color.map(c => c.name)))
    ).sort();
    colors.forEach(col => {
        const opt = document.createElement("option");
        opt.value = col;
        opt.textContent = col;
        colorSelect.appendChild(opt);
    });

    // change events → re-compute
    [genderSelect, categorySelect, sizeSelect, colorSelect, sortSelect].forEach(sel => {
        sel.addEventListener("change", applyFiltersAndSort);
    });
}

//helper
function setActiveCategoryPill(activeBtn) {
    const pills = document.querySelectorAll(".browse-cat-pill");
    pills.forEach(btn => {
        btn.classList.toggle("active", btn === activeBtn);
    });
}


function applyFiltersAndSort() {
    const gender = document.getElementById("filter-gender").value;
    const category = document.getElementById("filter-category").value;
    const size = document.getElementById("filter-size").value;
    const color = document.getElementById("filter-color").value;
    const sortBy = document.getElementById("sort-by").value;

    // start from all
    let result = allProducts.slice();

    // filters
    if (gender !== "all") {
        result = result.filter(p => p.gender === gender);
    }

    if (category !== "all") {
        result = result.filter(p => p.category === category);
    }

    if (size !== "all") {
        result = result.filter(p => p.sizes.includes(size));
    }

    if (color !== "all") {
        result = result.filter(p =>
            p.color.some(c => c.name === color)
        );
    }

    // sorting
    result.sort((a, b) => {
        switch (sortBy) {
            case "name-asc":
                return a.name.localeCompare(b.name);
            case "price-asc":
                return a.price - b.price;
            case "price-desc":
                return b.price - a.price;
            case "category-asc":
                return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
            default:
                return 0;
        }
    });

    renderBrowse(result);
    renderActiveFilters(gender, category, size, color);
}

function renderActiveFilters(gender, category, size, color) {
    const container = document.getElementById("browse-active-filters");
    container.innerHTML = "";

    const chips = [];

    if (gender !== "all") chips.push({ type: "gender", label: `Gender: ${gender}` });
    if (category !== "all") chips.push({ type: "category", label: `Category: ${category}` });
    if (size !== "all") chips.push({ type: "size", label: `Size: ${size}` });
    if (color !== "all") chips.push({ type: "color", label: `Color: ${color}` });

    if (chips.length === 0) {
        container.textContent = "No filters applied.";
        return;
    }

    chips.forEach(chip => {
        const span = document.createElement("span");
        span.classList.add("filter-chip");
        span.textContent = chip.label;

        const x = document.createElement("span");
        x.textContent = "×";
        span.appendChild(x);

        span.addEventListener("click", function () {
            clearFilter(chip.type);
        });

        container.appendChild(span);
    });
}

function clearFilter(type) {
    if (type === "gender") document.getElementById("filter-gender").value = "all";
    if (type === "category") document.getElementById("filter-category").value = "all";
    if (type === "size") document.getElementById("filter-size").value = "all";
    if (type === "color") document.getElementById("filter-color").value = "all";

    applyFiltersAndSort();
}
