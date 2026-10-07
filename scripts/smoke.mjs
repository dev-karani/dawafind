// End-to-end smoke test against a running dev server seeded with `npm run db:seed`.
//   BASE_URL=http://localhost:3000 node scripts/smoke.mjs
const BASE = process.env.BASE_URL || "http://localhost:3000";
const PW = "Password123";
let passed = 0;
let failed = 0;

class Client {
  jar = new Map();
  async req(method, path, body, opts = {}) {
    const headers = { Origin: opts.origin ?? BASE };
    if (opts.noOrigin) delete headers.Origin;
    if (this.jar.size) headers.Cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const [k, ...v] = pair.split("=");
      if (/expires=Thu, 01 Jan 1970/i.test(c) || v.join("=") === "") this.jar.delete(k);
      else this.jar.set(k, v.join("="));
    }
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers };
  }
  get = (p) => this.req("GET", p);
  post = (p, b, o) => this.req("POST", p, b, o);
  patch = (p, b) => this.req("PATCH", p, b);
  del = (p, b) => this.req("DELETE", p, b);
  async login(email, password = PW) {
    const r = await this.post("/api/auth/login", { email, password });
    if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status} ${JSON.stringify(r.data)}`);
    return this;
  }
}

function check(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}
const section = (s) => console.log(`\n${s}`);

// A real 1×1 PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

async function main() {
  const anon = new Client();

  section("Search & comparison");
  const meds = await anon.get("/api/search?q=amoxicillin");
  check("amoxicillin returns 3 distinct products", meds.data.medicines?.length === 3, JSON.stringify(meds.data).slice(0, 200));
  const labels = meds.data.medicines.map((m) => `${m.strength} ${m.dosageForm}`);
  check("strengths/forms are not merged", new Set(labels).size === 3, labels.join("|"));
  const amox500 = meds.data.medicines.find((m) => m.strength === "500mg");
  const cmp = await anon.get(`/api/search?medicineId=${amox500.id}&area=westlands&sort=distance`);
  const names = cmp.data.offers.map((o) => o.pharmacy.name);
  check("offers returned", cmp.data.offers.length >= 4, names.join(","));
  check("sorted by distance (ABC first from Westlands)", names[0] === "ABC Pharmacy", names.join(","));
  const abc = cmp.data.offers.find((o) => o.pharmacy.name === "ABC Pharmacy");
  check("pickup total = price + service fee", abc.pickup.total === abc.unitPrice + cmp.data.serviceFee, JSON.stringify(abc.pickup));
  check("delivery total adds delivery fee", abc.deliveryCost.total === abc.pickup.total + 100);
  const east = cmp.data.offers.find((o) => o.pharmacy.name === "Eastleigh Chemists");
  check("2-day-old stock is STALE and not presented as available", east.stockFreshness.level === "STALE" && east.presentedAsAvailable === false);
  check("fresh stock is HIGH confidence", abc.stockFreshness.level === "HIGH");
  check("out-of-stock pharmacy listed separately", cmp.data.unavailable.some((o) => o.pharmacy.name === "Karen Care Pharmacy"));
  check("no unverified pharmacy appears anywhere", ![...cmp.data.offers, ...cmp.data.unavailable].some((o) => o.pharmacy.name === "Newlife Chemist"));
  const pubList = await anon.get("/api/pharmacies");
  check("public pharmacy list hides pending pharmacies", !pubList.data.pharmacies.some((p) => p.name === "Newlife Chemist"));
  const byTotal = await anon.get(`/api/search?medicineId=${amox500.id}&area=westlands&sort=total`);
  const totals = byTotal.data.offers.map((o) => o.pickup.total);
  check("sort by lowest total works", totals.every((t, i) => i === 0 || totals[i - 1] <= t), totals.join(","));
  const near = await anon.get(`/api/search?medicineId=${amox500.id}&area=westlands&radius=10`);
  check("radius filter excludes far pharmacies", !near.data.offers.some((o) => o.pharmacy.name === "Nyali Pharmacy"));

  section("Security: unauthenticated / CSRF / roles");
  check("reserve requires login (401)", (await anon.post("/api/reservations", {})).status === 401);
  check("cross-origin POST blocked (403)", (await anon.post("/api/auth/login", { email: "a@b.co", password: "x" }, { origin: "https://evil.example" })).status === 403);
  check("POST without Origin blocked (403)", (await anon.post("/api/auth/login", { email: "a@b.co", password: "x" }, { noOrigin: true })).status === 403);
  check("admin API protected (401)", (await anon.get("/api/admin/dashboard")).status === 401);
  check("pharmacy analytics protected (401)", (await anon.get("/api/pharmacy/analytics")).status === 401);

  section("Patient registration & login");
  const email = `smoke+${Date.now()}@dawafind.test`;
  const patient = new Client();
  const reg = await patient.post("/api/auth/register", { type: "patient", fullName: "Smoke Tester", email, password: "Sm0keTest99" });
  check("patient registers and is signed in", reg.status === 200 && reg.data.redirect === "/dashboard", JSON.stringify(reg.data));
  check("weak password rejected", (await new Client().post("/api/auth/register", { type: "patient", fullName: "X Y", email: `w${Date.now()}@x.co`, password: "short" })).status === 400);
  check("duplicate email rejected", (await new Client().post("/api/auth/register", { type: "patient", fullName: "X Y", email, password: "Sm0keTest99" })).status === 409);
  const bad = await new Client().post("/api/auth/login", { email, password: "wrongpass1" });
  check("wrong password → 401 generic", bad.status === 401 && /Incorrect email or password/.test(bad.data.error));

  section("Patient cannot act as pharmacy/admin");
  check("patient cannot read admin dashboard (403)", (await patient.get("/api/admin/dashboard")).status === 403);
  const xyzInv = (await anon.get(`/api/pharmacies/${cmp.data.offers.find((o) => o.pharmacy.name === "XYZ Pharmacy").pharmacy.id}/inventory`)).data;
  check("public inventory hides quantity & minimum price", !("minimumPrice" in xyzInv.inventory[0]) && !("quantity" in xyzInv.inventory[0]));
  check("patient cannot PATCH inventory (403)", (await patient.patch(`/api/inventory/${cmp.data.offers[0].inventoryId}`, { price: 1 })).status === 403);

  section("Stock confirmation & reservation workflow");
  const xyz = cmp.data.offers.find((o) => o.pharmacy.name === "XYZ Pharmacy").pharmacy;
  const conf = await patient.post("/api/stock-confirmations", { pharmacyId: xyz.id, medicineId: amox500.id, quantity: 1 });
  check("stock confirmation requested", conf.status === 200 && conf.data.confirmation.status === "PENDING", JSON.stringify(conf.data));
  const res = await patient.post("/api/reservations", { pharmacyId: xyz.id, medicineId: amox500.id, quantity: 2 });
  check("reservation created PENDING with snapshot price", res.status === 200 && res.data.reservation.status === "PENDING" && res.data.reservation.unitPrice === 420 && res.data.reservation.totalPrice === 420 * 2 + 20, JSON.stringify(res.data));
  check("duplicate active reservation rejected (409)", (await patient.post("/api/reservations", { pharmacyId: xyz.id, medicineId: amox500.id, quantity: 1 })).status === 409);
  check("cannot reserve out-of-stock (400)", (await patient.post("/api/reservations", { pharmacyId: cmp.data.unavailable[0].pharmacy.id, medicineId: amox500.id, quantity: 1 })).status === 400);
  check("cannot over-reserve beyond stock (400)", (await patient.post("/api/reservations", { pharmacyId: cmp.data.offers.find((o) => o.pharmacy.name === "Health Pharmacy").pharmacy.id, medicineId: amox500.id, quantity: 50 })).status === 400);

  const xyzAdmin = await new Client().login("xyz@dawafind.test");
  const abcAdmin = await new Client().login("abc@dawafind.test");
  const list = await xyzAdmin.get("/api/reservations");
  const mine = list.data.reservations.find((r) => r.id === res.data.reservation.id);
  check("pharmacy sees the reservation request", !!mine);
  check("other pharmacy cannot see it", !(await abcAdmin.get("/api/reservations")).data.reservations.some((r) => r.id === res.data.reservation.id));
  check("other pharmacy cannot modify it (404)", (await abcAdmin.patch(`/api/reservations/${res.data.reservation.id}`, { action: "confirm" })).status === 404);
  const confirmed = await xyzAdmin.patch(`/api/reservations/${res.data.reservation.id}`, { action: "confirm", holdHours: 2 });
  check("pharmacy confirms reservation", confirmed.data.reservation?.status === "CONFIRMED", JSON.stringify(confirmed.data));
  const cr = (await xyzAdmin.get("/api/stock-confirmations")).data.confirmations.find((c) => c.id === conf.data.confirmation.id);
  const cresp = await xyzAdmin.patch(`/api/stock-confirmations/${cr.id}`, { action: "confirm" });
  check("pharmacy confirms stock", cresp.data.confirmation?.status === "CONFIRMED" && cresp.data.confirmation.confirmedPrice === 420, JSON.stringify(cresp.data));
  const notes = (await patient.get("/api/notifications")).data;
  check("patient notified of reservation + stock confirmation", notes.notifications.some((n) => n.type === "RESERVATION_CONFIRMED") && notes.notifications.some((n) => n.type === "STOCK_CONFIRMED"));
  const cmp2 = await anon.get(`/api/search?medicineId=${amox500.id}&area=westlands`);
  const xyzOffer = cmp2.data.offers.find((o) => o.pharmacy.name === "XYZ Pharmacy");
  check("confirmed reservation holds stock", xyzOffer.availableQuantity === 25 - 2, String(xyzOffer.availableQuantity));
  const collected = await xyzAdmin.patch(`/api/reservations/${res.data.reservation.id}`, { action: "collect" });
  check("collection recorded", collected.data.reservation?.status === "COLLECTED");
  const orders = (await patient.get("/api/orders")).data.orders;
  check("collection created a completed order with fee breakdown", orders.some((o) => o.status === "COMPLETED" && o.serviceFee === 20 && o.total === 860), JSON.stringify(orders).slice(0, 200));
  const inv = (await xyzAdmin.get(`/api/pharmacies/${xyz.id}/inventory`)).data.inventory.find((i) => i.medicine.id === amox500.id);
  check("stock decremented after collection", inv.quantity === 23, String(inv.quantity));

  section("Pharmacy price protection");
  const myInv = (await abcAdmin.get(`/api/pharmacies/${cmp.data.offers.find((o) => o.pharmacy.name === "ABC Pharmacy").pharmacy.id}/inventory`)).data.inventory;
  const item = myInv.find((i) => i.medicine.id === amox500.id);
  const belowMin = await abcAdmin.patch(`/api/inventory/${item.id}`, { promoPrice: item.minimumPrice - 1, promotionsEnabled: true });
  check("promo below minimum price rejected (400)", belowMin.status === 400 && /below your minimum/.test(belowMin.data.error), JSON.stringify(belowMin.data));
  const okPromo = await abcAdmin.patch(`/api/inventory/${item.id}`, { promoPrice: item.minimumPrice + 10, promotionsEnabled: true });
  check("promo at/above minimum accepted", okPromo.status === 200);
  const after = (await anon.get(`/api/search?medicineId=${amox500.id}`)).data.offers.find((o) => o.pharmacy.name === "ABC Pharmacy");
  check("patients see the approved DawaFind price", after.onPromotion && after.unitPrice === item.minimumPrice + 10);
  check("minimum > price rejected", (await abcAdmin.patch(`/api/inventory/${item.id}`, { minimumPrice: 9999 })).status === 400);
  await abcAdmin.patch(`/api/inventory/${item.id}`, { promotionsEnabled: false, promoPrice: null });

  section("Availability alerts");
  const amlo10 = (await anon.get("/api/search?q=amlodipine 10mg")).data.medicines[0];
  const alert = await patient.post("/api/availability-alerts", { medicineId: amlo10.id, area: "kilimani" });
  check("alert created", alert.status === 200);
  const xyzInvAll = (await xyzAdmin.get(`/api/pharmacies/${xyz.id}/inventory`)).data.inventory;
  const amloItem = xyzInvAll.find((i) => i.medicine.id === amlo10.id);
  check("amlodipine 10mg is out of stock at XYZ in seed", amloItem.stockStatus === "OUT_OF_STOCK");
  await xyzAdmin.patch(`/api/inventory/${amloItem.id}`, { quantity: 30 });
  const n2 = (await patient.get("/api/notifications")).data;
  check("patient notified when OUT_OF_STOCK → IN_STOCK", n2.notifications.some((n) => n.type === "STOCK_AVAILABLE"));

  section("Delivery order workflow");
  const abcPh = cmp.data.offers.find((o) => o.pharmacy.name === "ABC Pharmacy").pharmacy;
  const para = (await anon.get("/api/search?q=paracetamol")).data.medicines[0];
  const noAddr = await patient.post("/api/orders", { pharmacyId: abcPh.id, medicineId: para.id, quantity: 1 });
  check("delivery order needs an address (400)", noAddr.status === 400);
  const ord = await patient.post("/api/orders", { pharmacyId: abcPh.id, medicineId: para.id, quantity: 2, deliveryAddress: "Apt 4, Woodvale Grove" });
  check("delivery order created, total = items + delivery + fee", ord.status === 200 && ord.data.order.deliveryFee === 100 && ord.data.order.serviceFee === 20, JSON.stringify(ord.data));
  const oid = ord.data.order.id;
  check("cannot dispatch before accept/prepare (400)", (await abcAdmin.patch(`/api/orders/${oid}`, { action: "dispatch" })).status === 400);
  for (const a of ["accept", "prepare", "dispatch", "complete"]) {
    const r = await abcAdmin.patch(`/api/orders/${oid}`, { action: a });
    check(`order → ${a}`, r.status === 200, JSON.stringify(r.data));
  }
  check("another pharmacy cannot touch the order (404)", (await xyzAdmin.patch(`/api/orders/${oid}`, { action: "cancel" })).status === 404);

  section("Prescriptions: privacy");
  const other = await new Client().login("patient2@dawafind.test");
  const fd = (file, name, extra = {}) => {
    const f = new FormData();
    f.set("file", new Blob([file]), name);
    for (const [k, v] of Object.entries(extra)) f.set(k, v);
    return f;
  };
  check("upload without consent rejected (400)", (await patient.post("/api/prescriptions", fd(PNG, "rx.png"))).status === 400);
  check("fake image (exe) rejected (400)", (await patient.post("/api/prescriptions", fd(Buffer.from("MZ\x90\x00 not an image"), "rx.png", { consent: "on" }))).status === 400);
  check("PDF with JavaScript rejected (400)", (await patient.post("/api/prescriptions", fd(Buffer.from("%PDF-1.4 /JavaScript (app.alert(1))"), "rx.pdf", { consent: "on" }))).status === 400);
  check("oversize rejected (400)", (await patient.post("/api/prescriptions", fd(Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]), "rx.png", { consent: "on" }))).status === 400);
  const up = await patient.post("/api/prescriptions", fd(PNG, "rx.png", { consent: "on" }));
  check("valid prescription accepted", up.status === 200, JSON.stringify(up.data));
  const rxId = up.data.prescription.id;
  const own = await patient.get(`/api/prescriptions/${rxId}/file`);
  check("owner can read file", own.status === 200 && Buffer.compare(own.data, PNG) === 0);
  check("file response is private/no-store", /no-store/.test(own.headers.get("cache-control") || ""));
  check("other patient cannot read it (404)", (await other.get(`/api/prescriptions/${rxId}/file`)).status === 404);
  check("unshared: pharmacy cannot read it (404)", (await abcAdmin.get(`/api/prescriptions/${rxId}/file`)).status === 404);
  const adminC = await new Client().login("admin@dawafind.test");
  check("platform admin cannot read prescription files", [403, 404].includes((await adminC.get(`/api/prescriptions/${rxId}/file`)).status));
  check("anonymous cannot read it (401)", (await anon.get(`/api/prescriptions/${rxId}/file`)).status === 401);
  check("other patient cannot share/delete it (404)", (await other.del(`/api/prescriptions/${rxId}`)).status === 404);
  const share = await patient.patch(`/api/prescriptions/${rxId}`, { action: "share", pharmacyId: abcPh.id });
  check("patient shares with a verified pharmacy", share.status === 200, JSON.stringify(share.data));
  const staff = await new Client().login("abc.staff@dawafind.test");
  check("the chosen pharmacy's staff can read it", (await staff.get(`/api/prescriptions/${rxId}/file`)).status === 200);
  check("a different pharmacy cannot (404)", (await xyzAdmin.get(`/api/prescriptions/${rxId}/file`)).status === 404);
  check("pharmacy: start review", (await staff.patch(`/api/prescriptions/${rxId}`, { action: "start_review" })).status === 200);
  check("pharmacy cannot skip to completed (400)", (await staff.patch(`/api/prescriptions/${rxId}`, { action: "complete" })).status === 400);
  check("pharmacy: verify", (await staff.patch(`/api/prescriptions/${rxId}`, { action: "verify" })).status === 200);
  const logs = (await adminC.get("/api/admin/audit-logs?action=prescription.")).data.logs;
  check("prescription access is audit-logged", logs.some((l) => l.action === "prescription.access") && logs.some((l) => l.action === "prescription.upload"));
  check("audit log never stores file contents", !JSON.stringify(logs).includes("iVBOR"));
  check("owner can securely delete", (await patient.del(`/api/prescriptions/${rxId}`)).status === 200);
  check("deleted file is gone (404)", (await patient.get(`/api/prescriptions/${rxId}/file`)).status === 404);

  section("Pharmacy registration & admin verification");
  const phEmail = `pharm+${Date.now()}@dawafind.test`;
  const ph = new Client();
  const phReg = await ph.post("/api/auth/register", {
    type: "pharmacy", fullName: "New Owner", email: phEmail, phone: "+254 700 555 000", password: "Sm0keTest99",
    pharmacy: { name: "Smoke Test Chemist", address: "Test Rd", area: "Westlands", town: "Nairobi", latitude: -1.27, longitude: 36.81, phone: "+254 700 555 001", email: phEmail, licenseReference: "PPB/TEST/1", responsiblePharmacist: "Dr Test" },
  });
  check("pharmacy registers (PENDING)", phReg.status === 200 && phReg.data.redirect === "/pharmacy", JSON.stringify(phReg.data));
  const newPh = (await adminC.get("/api/admin/pharmacies?status=PENDING")).data.pharmacies.find((p) => p.name === "Smoke Test Chemist");
  check("admin sees pending application", !!newPh);
  check("unverified pharmacy has no public page", (await anon.get(`/api/pharmacies/${newPh.id}`)).status === 404);
  const medsAll = (await anon.get("/api/medicines")).data.medicines;
  const blocked = await ph.post(`/api/pharmacies/${newPh.id}/inventory`, { medicineId: medsAll[0].id, quantity: 5, price: 100, minimumPrice: 80 });
  check("unverified pharmacy cannot list inventory (403)", blocked.status === 403, JSON.stringify(blocked.data));
  check("reject requires a reason (400)", (await adminC.patch(`/api/admin/pharmacies/${newPh.id}/verify`, { action: "reject" })).status === 400);
  check("admin verifies", (await adminC.patch(`/api/admin/pharmacies/${newPh.id}/verify`, { action: "verify" })).status === 200);
  check("verified pharmacy is public", (await anon.get(`/api/pharmacies/${newPh.id}`)).data.pharmacy?.verified === true);
  const add = await ph.post(`/api/pharmacies/${newPh.id}/inventory`, { medicineId: medsAll[0].id, quantity: 5, price: 100, minimumPrice: 80 });
  check("verified pharmacy lists inventory", add.status === 200, JSON.stringify(add.data));
  check("pharmacy cannot list in another pharmacy (403)", (await ph.post(`/api/pharmacies/${abcPh.id}/inventory`, { medicineId: medsAll[1].id, quantity: 5, price: 100, minimumPrice: 80 })).status === 403);
  check("pharmacy cannot create arbitrary medicines (403)", (await ph.post("/api/admin/medicines", { genericName: "Fake", strength: "1mg", dosageForm: "Tabs", packSize: "1" })).status === 403);
  check("pharmacy staff cannot change settings (403)", (await staff.patch("/api/pharmacy/settings", { phone: "+254 700 000 123" })).status === 403);

  section("Admin");
  const dash = await adminC.get("/api/admin/dashboard");
  check("admin dashboard", dash.status === 200 && dash.data.overview.verified >= 7);
  const users = await adminC.get("/api/admin/users");
  check("user list never exposes password hashes", !JSON.stringify(users.data).includes("passwordHash") && !JSON.stringify(users.data).includes("$2"));
  check("admin reports", (await adminC.get("/api/admin/reports")).status === 200);
  check("admin transactions", (await adminC.get("/api/admin/transactions")).status === 200);
  const victim = users.data.users.find((u) => u.email === email);
  check("admin suspends a user", (await adminC.patch(`/api/admin/users/${victim.id}`, { action: "suspend" })).status === 200);
  check("suspended user is signed out immediately (401)", (await patient.get("/api/notifications")).status === 401);
  check("suspended user cannot sign in (403)", (await new Client().post("/api/auth/login", { email, password: "Sm0keTest99" })).status === 403);
  check("admin reactivates", (await adminC.patch(`/api/admin/users/${victim.id}`, { action: "reactivate" })).status === 200);
  check("admin cannot suspend admins (400)", (await adminC.patch(`/api/admin/users/${(await adminC.get("/api/admin/users?role=PLATFORM_ADMIN")).data.users[0].id}`, { action: "suspend" })).status === 400);

  section("Pharmacy analytics");
  const an = await abcAdmin.get("/api/pharmacy/analytics");
  check("pharmacy analytics", an.status === 200 && an.data.analytics.searches > 0 && an.data.analytics.completedOrders >= 6, JSON.stringify(an.data).slice(0, 300));

  section("Pages render");
  for (const p of ["/", "/search?q=amoxicillin", `/search?medicineId=${amox500.id}&area=westlands`, "/login", "/register", "/register/pharmacy", "/privacy", `/pharmacies/${abcPh.id}`]) {
    const r = await anon.get(p);
    check(`GET ${p.slice(0, 50)} → 200`, r.status === 200, String(r.status));
  }
  const dashClient = await new Client().login("patient@dawafind.test");
  for (const p of ["/dashboard", "/dashboard/reservations", "/dashboard/orders", "/dashboard/saved", "/dashboard/alerts", "/dashboard/prescriptions", "/dashboard/notifications", "/dashboard/settings"]) {
    check(`patient ${p} → 200`, (await dashClient.get(p)).status === 200);
  }
  for (const p of ["/pharmacy", "/pharmacy/inventory", "/pharmacy/reservations", "/pharmacy/orders", "/pharmacy/prescriptions", "/pharmacy/analytics", "/pharmacy/settings", "/pharmacy/notifications"]) {
    check(`pharmacy ${p} → 200`, (await abcAdmin.get(p)).status === 200);
  }
  for (const p of ["/admin", "/admin/pharmacies", "/admin/users", "/admin/medicines", "/admin/transactions", "/admin/reports", "/admin/audit", "/admin/settings", "/admin/notifications"]) {
    check(`admin ${p} → 200`, (await adminC.get(p)).status === 200);
  }
  check("patient is redirected away from /admin", (await dashClient.get("/admin")).status === 307);
  check("anonymous redirected to login from /dashboard", (await anon.get("/dashboard")).status === 307);
  check("staff cannot open /pharmacy/settings (redirect)", (await staff.get("/pharmacy/settings")).status === 307);

  section("Rate limiting");
  const rl = new Client();
  let last = 0;
  for (let i = 0; i < 10; i++) last = (await rl.post("/api/auth/login", { email: "ratelimit@dawafind.test", password: "nope12345" })).status;
  check("repeated failed logins are throttled (429)", last === 429, String(last));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
