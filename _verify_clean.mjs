import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const raw = fs.readFileSync("./.env", "utf8");
const env = Object.fromEntries(raw.split(/\r?\n/).filter(l => l.includes("=") && !l.startsWith("#")).map(l => {
  const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
}));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);

const { data: biz } = await db.from("businesses").select("id, name");
const bid = biz[0].id;
console.log(`Business: ${biz[0].name} (id=${bid})\n`);

const isTestLike = (s) => {
  if (!s) return false;
  const up = String(s).toUpperCase();
  return up.startsWith("ZZ") || up.includes(" TEST") || up.startsWith("TEST") || up.includes("TEST ");
};

let anyFound = false;

// Clients
const { data: custs } = await db.from("customers").select("id, name, phone, code, created_at").eq("business_id", bid);
const suspectCusts = custs.filter(c => isTestLike(c.name));
console.log(`=== CLIENTS (${custs.length} au total) ===`);
if (suspectCusts.length) { anyFound = true; suspectCusts.forEach(c => console.log(`  ⚠️ ${c.code} · ${c.name} · ${c.phone} · créé ${c.created_at}`)); }
else console.log("  ✅ aucun nom suspect (ZZ.../Test...)");

// Visites
const { data: visits } = await db.from("visits").select("id, service_name, customer_id, amount, date").eq("business_id", bid);
const suspectVisits = visits.filter(v => isTestLike(v.service_name));
console.log(`\n=== VISITES (${visits.length} au total) ===`);
if (suspectVisits.length) { anyFound = true; suspectVisits.forEach(v => console.log(`  ⚠️ #${v.id} ${v.service_name} · ${v.amount} FCFA · ${v.date}`)); }
else console.log("  ✅ aucune prestation suspecte");

// Transactions
const { data: tx } = await db.from("transactions").select("id, category, description, amount, type, created_at").eq("business_id", bid);
const suspectTx = tx.filter(t => isTestLike(t.description) || isTestLike(t.category));
console.log(`\n=== TRANSACTIONS / COMPTA (${tx.length} au total) ===`);
if (suspectTx.length) { anyFound = true; suspectTx.forEach(t => console.log(`  ⚠️ #${t.id} ${t.type} ${t.amount} FCFA · "${t.description}"`)); }
else console.log("  ✅ aucune écriture suspecte");

// Services
const { data: svcs } = await db.from("services").select("id, name, price").eq("business_id", bid);
const suspectSvcs = svcs.filter(s => isTestLike(s.name));
console.log(`\n=== PRESTATIONS (${svcs.length} au total) ===`);
if (suspectSvcs.length) { anyFound = true; suspectSvcs.forEach(s => console.log(`  ⚠️ #${s.id} ${s.name} · ${s.price / 100} FCFA`)); }
else console.log("  ✅ aucune prestation suspecte");

// Employés
const { data: emps } = await db.from("employees").select("id, name").eq("business_id", bid);
const suspectEmps = emps.filter(e => isTestLike(e.name));
console.log(`\n=== EMPLOYÉS (${emps.length} au total) ===`);
if (suspectEmps.length) { anyFound = true; suspectEmps.forEach(e => console.log(`  ⚠️ #${e.id} ${e.name}`)); }
else console.log("  ✅ aucun employé suspect");

// Produits / inventaire
const { data: prods } = await db.from("products").select("id, name, stock_uses").eq("business_id", bid);
const suspectProds = (prods || []).filter(p => isTestLike(p.name));
console.log(`\n=== PRODUITS / INVENTAIRE (${(prods || []).length} au total) ===`);
if (suspectProds.length) { anyFound = true; suspectProds.forEach(p => console.log(`  ⚠️ #${p.id} ${p.name} · stock=${p.stock_uses}`)); }
else console.log("  ✅ aucun produit suspect");

// Catégories
const { data: cats } = await db.from("categories").select("id, name").eq("business_id", bid);
const suspectCats = cats.filter(c => isTestLike(c.name));
console.log(`\n=== CATÉGORIES (${cats.length} au total) ===`);
if (suspectCats.length) { anyFound = true; suspectCats.forEach(c => console.log(`  ⚠️ #${c.id} ${c.name}`)); }
else console.log("  ✅ aucune catégorie suspecte");

// Récompenses / niveaux
const { data: rewards } = await db.from("rewards").select("id, label").eq("business_id", bid);
const suspectRewards = (rewards || []).filter(r => isTestLike(r.label));
console.log(`\n=== RÉCOMPENSES (${(rewards || []).length} au total) ===`);
if (suspectRewards.length) { anyFound = true; suspectRewards.forEach(r => console.log(`  ⚠️ #${r.id} ${r.label}`)); }
else console.log("  ✅ aucune récompense suspecte");

const { data: tiers } = await db.from("tiers").select("id, name").eq("business_id", bid);
const suspectTiers = (tiers || []).filter(t => isTestLike(t.name));
console.log(`\n=== NIVEAUX (${(tiers || []).length} au total) ===`);
if (suspectTiers.length) { anyFound = true; suspectTiers.forEach(t => console.log(`  ⚠️ #${t.id} ${t.name}`)); }
else console.log("  ✅ aucun niveau suspect");

// Members (staff logins)
const { data: mems } = await db.from("members").select("id, email, name").eq("business_id", bid);
const suspectMems = (mems || []).filter(m => isTestLike(m.email) || isTestLike(m.name));
console.log(`\n=== PERSONNEL / MEMBRES (${(mems || []).length} au total) ===`);
mems.forEach(m => console.log(`  · ${m.name || "(sans nom)"} · ${m.email}`));
if (suspectMems.length) { anyFound = true; console.log("  ⚠️ voir ci-dessus, certains semblent suspects"); }

console.log(`\n${"=".repeat(50)}`);
console.log(anyFound ? "❌ DES RÉSIDUS DE TEST ONT ÉTÉ TROUVÉS (détail ci-dessus)" : "✅ AUCUNE DONNÉE DE TEST RÉSIDUELLE — la base est propre");
