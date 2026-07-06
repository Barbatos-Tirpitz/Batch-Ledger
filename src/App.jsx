import React, { useState, useEffect, useMemo, useRef } from "react";
import Papa from "papaparse";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Plus, Trash2, Upload, Download, FlaskConical, Package, ClipboardList, LayoutDashboard, ChevronDown, ChevronRight } from "lucide-react";

const C = {
  paper: "#FAF7F0",
  paperDim: "#F2EEE3",
  ink: "#211E19",
  inkSoft: "#5B564A",
  line: "#DEDACB",
  accent: "#2E5F55",
  accentSoft: "#E4EEEA",
  warn: "#A6512F",
  warnSoft: "#F3E4DC",
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
`;

const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const STORAGE_KEY = "batchledger-data";

function download(filename, content, mime = "text/csv") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return "—";
  const r = Math.round(n * 1000) / 1000;
  return r.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

// ---------- shared bits ----------
function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-t-md text-sm font-medium transition-colors"
      style={{
        fontFamily: "'Space Grotesk', sans-serif",
        background: active ? C.paper : "transparent",
        color: active ? C.ink : C.inkSoft,
        borderTop: active ? `2px solid ${C.accent}` : "2px solid transparent",
        borderLeft: active ? `1px solid ${C.line}` : "1px solid transparent",
        borderRight: active ? `1px solid ${C.line}` : "1px solid transparent",
      }}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

function IconBtn({ onClick, icon: Icon, label, tone = "accent" }) {
  const color = tone === "warn" ? C.warn : C.accent;
  const bg = tone === "warn" ? C.warnSoft : C.accentSoft;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium"
      style={{ background: bg, color, fontFamily: "'Inter', sans-serif" }}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

function FileImportBtn({ onData, label = "Import CSV" }) {
  const ref = useRef(null);
  return (
    <>
      <input
        type="file"
        accept=".csv"
        ref={ref}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            const parsed = Papa.parse(evt.target.result, { header: true, skipEmptyLines: true });
            onData(parsed.data);
          };
          reader.readAsText(file);
          e.target.value = "";
        }}
      />
      <IconBtn onClick={() => ref.current.click()} icon={Upload} label={label} />
    </>
  );
}

// ---------- main app ----------
export default function BatchLedger() {
  const [data, setData] = useState({ ingredients: [], products: [], logs: [] });
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("ingredients");
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setData(JSON.parse(raw));
    } catch (e) {
      // no saved data yet, or storage unavailable — start fresh
    }
    setLoaded(true);
  }, []);

  const persist = (next) => {
    setData(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      setNotice({ tone: "warn", text: "Could not save — your changes are only in this session." });
    }
  };

  const flash = (text, tone = "accent") => {
    setNotice({ tone, text });
    setTimeout(() => setNotice(null), 3500);
  };

  // ---- ingredient ops ----
  const addIngredient = (ing) => {
    if (data.ingredients.some((i) => i.name.toLowerCase() === ing.name.toLowerCase())) {
      flash("An ingredient with that name already exists.", "warn");
      return;
    }
    persist({ ...data, ingredients: [...data.ingredients, { id: uid("ing"), ...ing }] });
  };
  const deleteIngredient = (id) => {
    persist({
      ...data,
      ingredients: data.ingredients.filter((i) => i.id !== id),
      products: data.products.map((p) => ({ ...p, recipe: p.recipe.filter((r) => r.ingredientId !== id) })),
    });
  };

  // ---- product ops ----
  const addProduct = (product) => {
    if (data.products.some((p) => p.name.toLowerCase() === product.name.toLowerCase())) {
      flash("A product with that name already exists.", "warn");
      return;
    }
    persist({ ...data, products: [...data.products, product] });
  };
  const deleteProduct = (id) => {
    persist({
      ...data,
      products: data.products.filter((p) => p.id !== id),
      logs: data.logs.filter((l) => l.productId !== id),
    });
  };
  const addRecipeLine = (productId, line) => {
    persist({
      ...data,
      products: data.products.map((p) =>
        p.id === productId ? { ...p, recipe: [...p.recipe.filter((r) => r.ingredientId !== line.ingredientId), line] } : p
      ),
    });
  };
  const removeRecipeLine = (productId, ingredientId) => {
    persist({
      ...data,
      products: data.products.map((p) =>
        p.id === productId ? { ...p, recipe: p.recipe.filter((r) => r.ingredientId !== ingredientId) } : p
      ),
    });
  };

  // ---- log ops ----
  const addLog = (log) => persist({ ...data, logs: [...data.logs, log] });
  const deleteLog = (id) => persist({ ...data, logs: data.logs.filter((l) => l.id !== id) });

  // ---- CSV import handlers ----
  const importIngredients = (rows) => {
    let added = 0;
    let next = { ...data, ingredients: [...data.ingredients] };
    rows.forEach((r) => {
      const name = (r.name || "").trim();
      if (!name) return;
      const idx = next.ingredients.findIndex((i) => i.name.toLowerCase() === name.toLowerCase());
      const entry = { name, unit: (r.unit || "unit").trim(), cost: r.cost ? parseFloat(r.cost) : undefined };
      if (idx >= 0) next.ingredients[idx] = { ...next.ingredients[idx], ...entry };
      else {
        next.ingredients.push({ id: uid("ing"), ...entry });
        added++;
      }
    });
    persist(next);
    flash(`Imported ${rows.length} rows (${added} new ingredients).`);
  };

  const importProducts = (rows) => {
    let next = { ...data, ingredients: [...data.ingredients], products: [...data.products] };
    let skipped = 0;
    rows.forEach((r) => {
      const pname = (r.product || "").trim();
      const iname = (r.ingredient || "").trim();
      const qty = parseFloat(r.qty_per_unit);
      if (!pname || !iname || isNaN(qty)) {
        skipped++;
        return;
      }
      let ing = next.ingredients.find((i) => i.name.toLowerCase() === iname.toLowerCase());
      if (!ing) {
        ing = { id: uid("ing"), name: iname, unit: "unit" };
        next.ingredients.push(ing);
      }
      let prod = next.products.find((p) => p.name.toLowerCase() === pname.toLowerCase());
      if (!prod) {
        prod = { id: uid("prod"), name: pname, recipe: [] };
        next.products.push(prod);
      }
      prod.recipe = [...prod.recipe.filter((l) => l.ingredientId !== ing.id), { ingredientId: ing.id, qty }];
    });
    persist(next);
    flash(`Imported recipe rows.${skipped ? ` Skipped ${skipped} incomplete rows.` : ""}`);
  };

  const importLogs = (rows) => {
    let next = { ...data, logs: [...data.logs] };
    let skipped = 0;
    rows.forEach((r) => {
      const pname = (r.product || "").trim();
      const qty = parseFloat(r.qty_produced);
      const date = (r.date || "").trim();
      const prod = data.products.find((p) => p.name.toLowerCase() === pname.toLowerCase());
      if (!prod || isNaN(qty) || !date) {
        skipped++;
        return;
      }
      next.logs.push({ id: uid("log"), date, productId: prod.id, qty });
    });
    persist(next);
    flash(`Imported ${rows.length - skipped} production entries.${skipped ? ` Skipped ${skipped} (unknown product or bad data).` : ""}`);
  };

  // ---- derived dashboard data ----
  const perProduct = useMemo(() => {
    return data.products.map((p) => {
      const prodLogs = data.logs.filter((l) => l.productId === p.id);
      const totalProduced = prodLogs.reduce((s, l) => s + l.qty, 0);
      const rows = p.recipe.map((r) => {
        const ing = data.ingredients.find((i) => i.id === r.ingredientId);
        const consumed = r.qty * totalProduced;
        return { ingredientId: r.ingredientId, name: ing?.name || "?", unit: ing?.unit || "", qty: r.qty, consumed, cost: ing?.cost };
      });
      const totalCost = rows.every((r) => r.cost !== undefined)
        ? rows.reduce((s, r) => s + r.cost * r.consumed, 0)
        : undefined;
      return { product: p, totalProduced, rows, totalCost };
    });
  }, [data]);

  const aggregateConsumption = useMemo(() => {
    const map = {};
    perProduct.forEach((pp) =>
      pp.rows.forEach((r) => {
        if (!map[r.name]) map[r.name] = { name: r.name, unit: r.unit, qty: 0 };
        map[r.name].qty += r.consumed;
      })
    );
    return Object.values(map).sort((a, b) => b.qty - a.qty);
  }, [perProduct]);

  if (!loaded) {
    return (
      <div className="p-10 text-sm" style={{ fontFamily: "'Inter', sans-serif", color: C.inkSoft }}>
        Loading…
      </div>
    );
  }

  return (
    <div
      className="min-h-full w-full"
      style={{
        background: `repeating-linear-gradient(0deg, transparent, transparent 27px, ${C.line}55 27px, ${C.line}55 28px), repeating-linear-gradient(90deg, transparent, transparent 27px, ${C.line}55 27px, ${C.line}55 28px), ${C.paperDim}`,
        fontFamily: "'Inter', sans-serif",
        color: C.ink,
      }}
    >
      <style>{FONTS}</style>

      <div className="max-w-5xl mx-auto px-6 pt-8 pb-16">
        {/* header */}
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <div className="text-xs tracking-widest uppercase mb-1" style={{ color: C.accent, fontFamily: "'JetBrains Mono', monospace" }}>
              No. 001 · Local Record
            </div>
            <h1 className="text-3xl font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Batch Ledger
            </h1>
          </div>
          <div className="text-xs text-right" style={{ color: C.inkSoft, fontFamily: "'JetBrains Mono', monospace" }}>
            {data.ingredients.length} ingredients · {data.products.length} products · {data.logs.length} entries
          </div>
        </div>

        {notice && (
          <div
            className="mb-4 px-3 py-2 rounded text-xs font-medium"
            style={{
              background: notice.tone === "warn" ? C.warnSoft : C.accentSoft,
              color: notice.tone === "warn" ? C.warn : C.accent,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {notice.text}
          </div>
        )}

        {/* tabs */}
        <div className="flex gap-1 -mb-px">
          <TabButton active={tab === "ingredients"} onClick={() => setTab("ingredients")} icon={FlaskConical} label="Ingredients" />
          <TabButton active={tab === "products"} onClick={() => setTab("products")} icon={Package} label="Products" />
          <TabButton active={tab === "logs"} onClick={() => setTab("logs")} icon={ClipboardList} label="Production Log" />
          <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={LayoutDashboard} label="Dashboard" />
        </div>

        <div
          className="rounded-b-md rounded-tr-md p-5"
          style={{ background: C.paper, border: `1px solid ${C.line}` }}
        >
          {tab === "ingredients" && (
            <IngredientsTab data={data} onAdd={addIngredient} onDelete={deleteIngredient} onImport={importIngredients} />
          )}
          {tab === "products" && (
            <ProductsTab
              data={data}
              onAdd={addProduct}
              onDelete={deleteProduct}
              onAddLine={addRecipeLine}
              onRemoveLine={removeRecipeLine}
              onImport={importProducts}
            />
          )}
          {tab === "logs" && <LogsTab data={data} onAdd={addLog} onDelete={deleteLog} onImport={importLogs} />}
          {tab === "dashboard" && <DashboardTab perProduct={perProduct} aggregate={aggregateConsumption} />}
        </div>
      </div>
    </div>
  );
}

// ---------- Ingredients ----------
function IngredientsTab({ data, onAdd, onDelete, onImport }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  const [cost, setCost] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), unit, cost: cost ? parseFloat(cost) : undefined });
    setName("");
    setCost("");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SectionLabel text="Ingredients" />
        <div className="flex gap-2">
          <FileImportBtn onData={onImport} label="Import CSV" />
          <IconBtn
            icon={Download}
            label="Export CSV"
            onClick={() =>
              download(
                "ingredients.csv",
                Papa.unparse(data.ingredients.map((i) => ({ name: i.name, unit: i.unit, cost: i.cost ?? "" })))
              )
            }
          />
        </div>
      </div>

      <div className="flex gap-2 mb-4 items-end flex-wrap">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cocoa butter" style={inputStyle} />
        </Field>
        <Field label="Unit">
          <select value={unit} onChange={(e) => setUnit(e.target.value)} style={inputStyle}>
            {["g", "kg", "ml", "L", "pcs"].map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </Field>
        <Field label="Cost / unit (optional)">
          <input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" style={{ ...inputStyle, width: 100 }} />
        </Field>
        <button onClick={submit} className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium mb-0.5" style={{ background: C.accent, color: C.paper }}>
          <Plus size={14} /> Add
        </button>
      </div>

      <Table
        cols={["Name", "Unit", "Cost/unit", ""]}
        rows={data.ingredients.map((i) => [i.name, i.unit, i.cost !== undefined ? fmt(i.cost) : "—", <DeleteBtn key="x" onClick={() => onDelete(i.id)} />])}
        empty="No ingredients yet — add one above or import a CSV (columns: name, unit, cost)."
      />
    </div>
  );
}

// ---------- Products ----------
function ProductsTab({ data, onAdd, onDelete, onAddLine, onRemoveLine, onImport }) {
  const [name, setName] = useState("");
  const [expanded, setExpanded] = useState({});

  const submit = () => {
    if (!name.trim()) return;
    onAdd({ id: uid("prod"), name: name.trim(), recipe: [] });
    setName("");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SectionLabel text="Products" />
        <div className="flex gap-2">
          <FileImportBtn onData={onImport} label="Import CSV" />
          <IconBtn
            icon={Download}
            label="Export CSV"
            onClick={() => {
              const rows = [];
              data.products.forEach((p) =>
                p.recipe.forEach((r) => {
                  const ing = data.ingredients.find((i) => i.id === r.ingredientId);
                  rows.push({ product: p.name, ingredient: ing?.name || "", qty_per_unit: r.qty });
                })
              );
              download("products.csv", Papa.unparse(rows));
            }}
          />
        </div>
      </div>
      <p className="text-xs mb-3" style={{ color: C.inkSoft }}>
        CSV format for recipes: <code>product, ingredient, qty_per_unit</code> — one row per ingredient used in a product.
      </p>

      <div className="flex gap-2 mb-4 items-end">
        <Field label="New product name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dark chocolate bar 100g" style={{ ...inputStyle, width: 260 }} />
        </Field>
        <button onClick={submit} className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium mb-0.5" style={{ background: C.accent, color: C.paper }}>
          <Plus size={14} /> Add product
        </button>
      </div>

      {data.products.length === 0 && <Empty text="No products yet — add one above." />}

      <div className="space-y-2">
        {data.products.map((p) => (
          <div key={p.id} style={{ border: `1px solid ${C.line}`, borderRadius: 6 }}>
            <div className="flex items-center justify-between px-3 py-2 cursor-pointer" onClick={() => setExpanded((e) => ({ ...e, [p.id]: !e[p.id] }))}>
              <div className="flex items-center gap-2 text-sm font-medium">
                {expanded[p.id] ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                {p.name}
                <span className="text-xs font-normal" style={{ color: C.inkSoft, fontFamily: "'JetBrains Mono', monospace" }}>
                  {p.recipe.length} ingredient{p.recipe.length !== 1 ? "s" : ""}
                </span>
              </div>
              <DeleteBtn onClick={(e) => { onDelete(p.id); }} />
            </div>
            {expanded[p.id] && (
              <div className="px-3 pb-3">
                <RecipeEditor product={p} ingredients={data.ingredients} onAddLine={onAddLine} onRemoveLine={onRemoveLine} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RecipeEditor({ product, ingredients, onAddLine, onRemoveLine }) {
  const [ingId, setIngId] = useState("");
  const [qty, setQty] = useState("");

  return (
    <div>
      <Table
        cols={["Ingredient", "Qty per unit produced", ""]}
        rows={product.recipe.map((r) => {
          const ing = ingredients.find((i) => i.id === r.ingredientId);
          return [ing?.name || "?", `${fmt(r.qty)} ${ing?.unit || ""}`, <DeleteBtn key="x" onClick={() => onRemoveLine(product.id, r.ingredientId)} />];
        })}
        empty="No recipe lines yet."
        dense
      />
      <div className="flex gap-2 mt-2 items-end">
        <Field label="Ingredient">
          <select value={ingId} onChange={(e) => setIngId(e.target.value)} style={inputStyle}>
            <option value="">Select…</option>
            {ingredients.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Qty per unit">
          <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0.0" style={{ ...inputStyle, width: 90 }} />
        </Field>
        <button
          onClick={() => {
            if (!ingId || !qty) return;
            onAddLine(product.id, { ingredientId: ingId, qty: parseFloat(qty) });
            setQty("");
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium mb-0.5"
          style={{ background: C.accentSoft, color: C.accent }}
        >
          <Plus size={13} /> Add line
        </button>
      </div>
    </div>
  );
}

// ---------- Logs ----------
function LogsTab({ data, onAdd, onDelete, onImport }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");

  const submit = () => {
    if (!productId || !qty) return;
    onAdd({ id: uid("log"), date, productId, qty: parseFloat(qty) });
    setQty("");
  };

  const sorted = [...data.logs].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SectionLabel text="Production Log" />
        <div className="flex gap-2">
          <FileImportBtn onData={onImport} label="Import CSV" />
          <IconBtn
            icon={Download}
            label="Export CSV"
            onClick={() =>
              download(
                "production_log.csv",
                Papa.unparse(
                  data.logs.map((l) => ({
                    date: l.date,
                    product: data.products.find((p) => p.id === l.productId)?.name || "",
                    qty_produced: l.qty,
                  }))
                )
              )
            }
          />
        </div>
      </div>
      <p className="text-xs mb-3" style={{ color: C.inkSoft }}>
        CSV format: <code>date, product, qty_produced</code>
      </p>

      <div className="flex gap-2 mb-4 items-end flex-wrap">
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Product">
          <select value={productId} onChange={(e) => setProductId(e.target.value)} style={{ ...inputStyle, width: 220 }}>
            <option value="">Select…</option>
            {data.products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Qty produced">
          <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" style={{ ...inputStyle, width: 90 }} />
        </Field>
        <button onClick={submit} className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium mb-0.5" style={{ background: C.accent, color: C.paper }}>
          <Plus size={14} /> Log
        </button>
      </div>

      <Table
        cols={["Date", "Product", "Qty produced", ""]}
        rows={sorted.map((l) => [
          l.date,
          data.products.find((p) => p.id === l.productId)?.name || "(deleted product)",
          fmt(l.qty),
          <DeleteBtn key="x" onClick={() => onDelete(l.id)} />,
        ])}
        empty="No production logged yet."
      />
    </div>
  );
}

// ---------- Dashboard ----------
function DashboardTab({ perProduct, aggregate }) {
  return (
    <div>
      <SectionLabel text="Consumption per product" />
      {perProduct.length === 0 && <Empty text="Add products and log production to see consumption here." />}
      <div className="grid sm:grid-cols-2 gap-3 mt-3 mb-8">
        {perProduct.map((pp) => (
          <div key={pp.product.id} className="p-3 rounded" style={{ border: `1px solid ${C.line}` }}>
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{pp.product.name}</div>
              <div className="text-xs" style={{ color: C.inkSoft, fontFamily: "'JetBrains Mono', monospace" }}>
                {fmt(pp.totalProduced)} produced
              </div>
            </div>
            {pp.rows.length === 0 ? (
              <div className="text-xs" style={{ color: C.inkSoft }}>No recipe defined.</div>
            ) : (
              <table className="w-full text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                <tbody>
                  {pp.rows.map((r) => (
                    <tr key={r.ingredientId} style={{ borderTop: `1px solid ${C.line}` }}>
                      <td className="py-1" style={{ fontFamily: "'Inter', sans-serif" }}>{r.name}</td>
                      <td className="py-1 text-right">{fmt(r.consumed)} {r.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {pp.totalCost !== undefined && (
              <div className="text-xs mt-2 pt-2 font-medium" style={{ borderTop: `1px solid ${C.line}`, color: C.accent }}>
                Total ingredient cost: {fmt(pp.totalCost)}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <SectionLabel text="Total ingredient consumption (all products)" />
        {aggregate.length > 0 && (
          <IconBtn
            icon={Download}
            label="Export CSV"
            onClick={() =>
              download("consumption_summary.csv", Papa.unparse(aggregate.map((a) => ({ ingredient: a.name, total_consumed: a.qty, unit: a.unit }))))
            }
          />
        )}
      </div>

      {aggregate.length === 0 ? (
        <Empty text="Nothing to summarize yet." />
      ) : (
        <>
          <div style={{ height: 240 }} className="mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aggregate} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: "Inter" }} />
                <YAxis tick={{ fontSize: 11, fontFamily: "Inter" }} />
                <Tooltip contentStyle={{ fontFamily: "Inter", fontSize: 12 }} />
                <Bar dataKey="qty" fill={C.accent} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Table cols={["Ingredient", "Total consumed", "Unit"]} rows={aggregate.map((a) => [a.name, fmt(a.qty), a.unit])} />
        </>
      )}
    </div>
  );
}

// ---------- small UI helpers ----------
const inputStyle = {
  border: `1px solid ${C.line}`,
  borderRadius: 4,
  padding: "6px 8px",
  fontSize: 13,
  fontFamily: "'Inter', sans-serif",
  background: "#fff",
  outline: "none",
};

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: C.inkSoft }}>{label}</span>
      {children}
    </label>
  );
}

function SectionLabel({ text }) {
  return (
    <div className="text-xs tracking-widest uppercase font-medium" style={{ color: C.inkSoft, fontFamily: "'JetBrains Mono', monospace" }}>
      {text}
    </div>
  );
}

function DeleteBtn({ onClick }) {
  return (
    <button onClick={onClick} className="p-1 rounded" style={{ color: C.warn }}>
      <Trash2 size={14} />
    </button>
  );
}

function Empty({ text }) {
  return (
    <div className="text-sm py-6 text-center rounded" style={{ color: C.inkSoft, background: C.paperDim }}>
      {text}
    </div>
  );
}

function Table({ cols, rows, empty, dense }) {
  if (rows.length === 0 && empty) return <Empty text={empty} />;
  return (
    <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {cols.map((c, i) => (
            <th
              key={i}
              className={`text-left ${dense ? "py-1" : "py-2"} text-xs uppercase tracking-wide`}
              style={{ color: C.inkSoft, borderBottom: `1px solid ${C.line}` }}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => (
              <td
                key={ci}
                className={dense ? "py-1" : "py-1.5"}
                style={{ borderBottom: `1px solid ${C.line}`, fontFamily: ci === 1 || ci === 2 ? "'JetBrains Mono', monospace" : "inherit", fontSize: 13 }}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
