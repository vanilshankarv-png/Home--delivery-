import { useEffect, useState } from "react";
import { Save, SlidersHorizontal } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import Spinner from "../../components/ui/Spinner.jsx";

const ruleDescriptions = {
  demand: "Controls area demand surge, provider radius, and the request lookback window.",
  distance: "Controls the included travel distance and incremental distance factor.",
  time: "Controls evening and overnight price multipliers.",
  fee: "Controls the platform fee percentage applied to the calculated subtotal."
};

export default function PricingRules() {
  const [rules, setRules] = useState([]);
  const [configs, setConfigs] = useState({});
  const [active, setActive] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    api.get("/pricing/rules")
      .then(({ data }) => {
        if (!mounted) return;
        setRules(data.rules);
        setConfigs(Object.fromEntries(data.rules.map((rule) => [rule._id, rule.config])));
        setActive(Object.fromEntries(data.rules.map((rule) => [rule._id, rule.isActive])));
      })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || "Pricing rules could not be loaded.");
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function save(rule) {
    setSavingId(rule._id);
    try {
      const { data } = await api.put(`/pricing/rules/${rule._id}`, {
        config: configs[rule._id],
        isActive: active[rule._id]
      });
      setRules((current) => current.map((item) => item._id === rule._id ? data.rule : item));
      toast.success(`${rule.name} updated.`);
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Pricing rule could not be saved.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white">
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-bold tracking-[0.26em] text-accent">ADMIN SETTINGS</p>
        <h1 className="mt-3 text-3xl font-semibold">Dynamic pricing rules</h1>
        <p className="mt-2 text-sm text-slate-400">Edit the active pricing constants used for quotes and bookings.</p>
        {loading ? <div className="grid min-h-60 place-items-center"><Spinner label="Loading pricing rules" /></div> : error ? (
          <div role="alert" className="mt-8 rounded-xl border border-rose-300/20 bg-rose-400/5 p-5 text-sm text-rose-200">{error}</div>
        ) : rules.length ? (
          <div className="mt-8 grid gap-5">
            {rules.map((rule) => (
              <Card key={rule._id} className="p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><h2 className="text-lg font-semibold">{rule.name}</h2><p className="mt-1 text-sm text-slate-400">{ruleDescriptions[rule.type]}</p></div>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={Boolean(active[rule._id])} onChange={(event) => setActive((current) => ({ ...current, [rule._id]: event.target.checked }))} className="accent-accent" />Active</label>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(configs[rule._id] || {}).map(([key, value]) => (
                    <label key={key} className="grid gap-2 text-sm font-medium capitalize text-slate-300">{key.replace(/([A-Z])/g, " $1")}
                      <input type="number" step="any" value={value} onChange={(event) => setConfigs((current) => ({
                        ...current,
                        [rule._id]: { ...current[rule._id], [key]: Number(event.target.value) }
                      }))} className="w-full rounded-xl border border-white/10 bg-midnight px-3 py-3 text-sm text-white outline-none focus:border-accent/60" />
                    </label>
                  ))}
                </div>
                <div className="mt-5 flex justify-end"><Button onClick={() => save(rule)} disabled={savingId === rule._id}><Save size={15} />{savingId === rule._id ? "Saving…" : "Save rule"}</Button></div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center"><SlidersHorizontal size={28} className="mx-auto text-accent" /><h2 className="mt-4 font-semibold">No pricing rules configured</h2><p className="mt-2 text-sm text-slate-400">Run the server seed script to add the default pricing rules.</p></div>
        )}
      </main>
    </div>
  );
}
