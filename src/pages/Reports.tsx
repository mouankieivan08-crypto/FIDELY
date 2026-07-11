import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { Download, FileText, TrendingUp, Users, Lock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "../contexts/AuthContext";
import { getBusiness, getAppointments, getServices, getCustomers, getTransactions } from "../services/db";

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const FULL_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");

export default function Reports() {
  const { user } = useAuth();
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(MONTH_LABELS.map(name => ({ name, ca: 0 })));
  const [store, setStore] = useState<{ appointments: any[]; services: any[]; customers: any[]; transactions: any[] }>(
    { appointments: [], services: [], customers: [], transactions: [] }
  );

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const rest = await getBusiness(user.id);
        setBusiness(rest);
        if (!rest) return;
        const [appointments, services, customers, transactions] = await Promise.all([
          getAppointments(rest.id), getServices(rest.id), getCustomers(rest.id), getTransactions(rest.id).catch(() => []),
        ]);
        setStore({ appointments, services, customers, transactions });
        const priceByService = new Map<number, number>(services.map((s: any) => [s.id, s.price]));
        const currentYear = new Date().getFullYear();
        const revenueByMonth = new Array(12).fill(0);
        appointments
          .filter((a: any) => a.status === 'completed' && new Date(a.startTime).getFullYear() === currentYear)
          .forEach((a: any) => { revenueByMonth[new Date(a.startTime).getMonth()] += (priceByService.get(a.serviceId) || 0) / 100; });
        setData(MONTH_LABELS.map((name, i) => ({ name, ca: revenueByMonth[i] })));
      } catch (error) {
        console.error("Error loading reports data:", error);
      } finally { setLoading(false); }
    })();
  }, [user]);

  const buildReport = (title: string) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthLabel = `${FULL_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    const { appointments, services, customers, transactions } = store;
    const priceByService = new Map<number, number>(services.map((s: any) => [s.id, s.price]));

    const inMonth = (d: string) => new Date(d) >= monthStart;
    const txMonth = transactions.filter((t: any) => inMonth(t.date));
    const credits = txMonth.filter((t: any) => t.type === "credit").reduce((s: number, t: any) => s + t.amount, 0);
    const debits = txMonth.filter((t: any) => t.type === "debit").reduce((s: number, t: any) => s + t.amount, 0);
    const aptMonth = appointments.filter((a: any) => inMonth(a.startTime));
    const aptDone = aptMonth.filter((a: any) => a.status === "completed");
    const caPrestations = aptDone.reduce((s: number, a: any) => s + (priceByService.get(a.serviceId) || 0) / 100, 0);
    const newClients = customers.filter((c: any) => c.createdAt && inMonth(c.createdAt)).length;
    const totalPoints = customers.reduce((s: number, c: any) => s + (c.points || 0), 0);
    const totalVisits = customers.reduce((s: number, c: any) => s + (c.visits || 0), 0);

    // Top prestations (par nombre de RDV terminés ce mois)
    const svcCount: Record<string, number> = {};
    aptDone.forEach((a: any) => {
      const name = services.find((s: any) => s.id === a.serviceId)?.name || "Autre";
      svcCount[name] = (svcCount[name] || 0) + 1;
    });
    const topServices = Object.entries(svcCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const row = (label: string, value: string) =>
      `<tr><td style="padding:8px 0;color:#555">${label}</td><td style="padding:8px 0;text-align:right;font-weight:700">${value}</td></tr>`;

    return `<!doctype html><html><head><meta charset="utf-8"><title>${title} — ${business?.name || "Fidely"}</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:720px;margin:32px auto;padding:0 24px}
h1{font-size:22px;margin:0} .sub{color:#888;font-size:13px;margin-top:4px}
.brand{color:#4f46e5;font-weight:800;letter-spacing:2px;text-transform:uppercase;font-size:13px}
.card{border:1px solid #eee;border-radius:12px;padding:16px 20px;margin-top:16px}
.card h2{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#666;margin:0 0 8px}
table{width:100%;border-collapse:collapse;font-size:14px}
.big{font-size:26px;font-weight:800}
.net{color:${credits - debits >= 0 ? "#16a34a" : "#dc2626"}}
.foot{margin-top:28px;color:#aaa;font-size:12px;text-align:center}
@media print{.noprint{display:none}}
</style></head><body>
<div class="brand">${business?.name || "Fidely"}</div>
<h1>${title}</h1>
<div class="sub">Période : ${monthLabel} · Généré le ${now.toLocaleDateString("fr-FR")} à ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>

<div class="card">
  <h2>Comptabilité du mois</h2>
  <table>
    ${row("Entrées (crédits)", fmt(credits) + " FCFA")}
    ${row("Sorties (débits)", fmt(debits) + " FCFA")}
    <tr><td style="padding:10px 0;font-weight:700">Solde net</td><td style="padding:10px 0;text-align:right" class="big net">${fmt(credits - debits)} FCFA</td></tr>
  </table>
</div>

<div class="card">
  <h2>Activité</h2>
  <table>
    ${row("Rendez-vous du mois", String(aptMonth.length))}
    ${row("Rendez-vous terminés", String(aptDone.length))}
    ${row("CA prestations (terminées)", fmt(caPrestations) + " FCFA")}
    ${row("Nouveaux clients", String(newClients))}
  </table>
</div>

<div class="card">
  <h2>Fidélité</h2>
  <table>
    ${row("Total clients", String(customers.length))}
    ${row("Total visites cumulées", String(totalVisits))}
    ${row("Total points distribués", fmt(totalPoints))}
  </table>
</div>

<div class="card">
  <h2>Top prestations du mois</h2>
  <table>
    ${topServices.length ? topServices.map(([n, c]) => row(n, c + " RDV")).join("") : `<tr><td style="color:#aaa;padding:8px 0">Aucune prestation terminée ce mois</td></tr>`}
  </table>
</div>

<div class="foot">Rapport généré par Fidely · Pour enregistrer en PDF, choisissez « Enregistrer au format PDF » dans la boîte d'impression.</div>
<div class="noprint" style="text-align:center;margin-top:20px"><button onclick="window.print()" style="padding:10px 20px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">Imprimer / Enregistrer en PDF</button></div>
</body></html>`;
  };

  const generate = (title: string) => {
    const html = buildReport(title);
    const w = window.open("", "_blank");
    if (!w) { alert("Autorisez les pop-ups pour générer le rapport."); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => { try { w.print(); } catch {} }, 400);
  };

  if (loading) return <Layout><div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div></Layout>;

  if (business && business.role && business.role !== "admin") {
    return (
      <Layout>
        <div className="max-w-md mx-auto mt-16 bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
          <Lock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900">Accès réservé</h2>
          <p className="text-gray-500 mt-1">Les rapports sont réservés aux administrateurs.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Rapports</h1>
          <p className="text-sm text-gray-500 mt-1">Générez et exportez vos statistiques en PDF</p>
        </div>
        <button onClick={() => generate("Bilan mensuel")}
          className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors shadow-sm text-sm font-medium">
          <Download className="h-4 w-4 mr-2" /> Exporter (PDF)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start space-x-4">
          <div className="bg-indigo-50 p-3 rounded-xl"><FileText className="h-6 w-6 text-indigo-600" /></div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Bilan Mensuel</h3>
            <p className="text-xs text-gray-500 mt-1 mb-2">Comptabilité, activité et fidélité du mois.</p>
            <button onClick={() => generate("Bilan mensuel")} className="text-sm text-indigo-600 font-medium hover:underline">Générer le rapport</button>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start space-x-4">
          <div className="bg-green-50 p-3 rounded-xl"><TrendingUp className="h-6 w-6 text-green-600" /></div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Comptabilité</h3>
            <p className="text-xs text-gray-500 mt-1 mb-2">Entrées, sorties et solde du mois.</p>
            <button onClick={() => generate("Rapport comptable")} className="text-sm text-indigo-600 font-medium hover:underline">Générer le rapport</button>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start space-x-4">
          <div className="bg-amber-50 p-3 rounded-xl"><Users className="h-6 w-6 text-amber-600" /></div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Fidélité & Clients</h3>
            <p className="text-xs text-gray-500 mt-1 mb-2">Acquisition, points et visites.</p>
            <button onClick={() => generate("Rapport fidélité & clients")} className="text-sm text-indigo-600 font-medium hover:underline">Générer le rapport</button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Évolution annuelle du Chiffre d'Affaires</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#a3a3a3', fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a3a3a3', fontSize: 12 }} />
              <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="ca" name="CA (FCFA)" fill="#d4af37" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Layout>
  );
}
