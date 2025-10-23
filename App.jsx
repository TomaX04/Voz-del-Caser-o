import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Voz del Caserío — MVP en una sola página (estilo simple tipo Gmail)
 * - UI limpia responsive (Tailwind)
 * - Autenticación simulada (nombre + rol)
 * - Crear reportes y adjuntar imágenes (base64)
 * - Lista con búsqueda y filtros
 * - Detalle con comentarios e historial
 * - Cambiar estado (si rol es Moderador/Admin)
 * - Votos de apoyo
 * - Persistencia en localStorage (sin servidor)
 */

const STORAGE_KEYS = {
  reports: "vozdelcaserio.reports.v1",
  session: "vozdelcaserio.session.v1",
};

const CATEGORIES = [
  { id: "vial", label: "Vías y huecos", icon: "🛣️" },
  { id: "alumbrado", label: "Alumbrado público", icon: "💡" },
  { id: "aseo", label: "Aseo y residuos", icon: "🗑️" },
  { id: "agua", label: "Acueducto", icon: "🚰" },
  { id: "energia", label: "Energía", icon: "⚡" },
  { id: "seguridad", label: "Seguridad", icon: "🛡️" },
  { id: "ambiente", label: "Ambiente", icon: "🌱" },
  { id: "otros", label: "Otros", icon: "📌" },
];

const STATUS = [
  { id: "nuevo", label: "Reportado", color: "bg-red-100 text-red-700" },
  { id: "gestion", label: "En gestión", color: "bg-amber-100 text-amber-700" },
  { id: "resuelto", label: "Resuelto", color: "bg-green-100 text-green-700" },
];

const ROLES = [
  { id: "vecino", label: "Vecino" },
  { id: "moderador", label: "Moderador JAC" },
  { id: "admin", label: "Administrador" },
];

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}
function nowISO() { return new Date().toISOString(); }
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
}

function load(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function seedIfEmpty() {
  const has = load(STORAGE_KEYS.reports, null);
  if (has && has.length) return;
  const seedUser = { id: uid("usr"), name: "María Pérez", role: "vecino" };
  const reports = [
    {
      id: uid("rep"),
      title: "Hueco grande en la vía principal",
      category: "vial",
      description: "A la altura de la escuela hay un hueco que pone en riesgo a motos y bicicletas.",
      place: "Frente a la Escuela Rural El Progreso",
      status: "nuevo",
      createdBy: seedUser,
      createdAt: nowISO(),
      votes: 3,
      images: [],
      history: [
        { id: uid("evt"), at: nowISO(), by: seedUser, type: "create", note: "Creó el reporte" },
      ],
      comments: [
        { id: uid("cmt"), at: nowISO(), by: seedUser, text: "Por favor tener cuidado en las noches." },
      ],
    },
    {
      id: uid("rep"),
      title: "Poste sin luz en la entrada del caserío",
      category: "alumbrado",
      description: "El poste frente a la tienda de Don Luis no enciende desde hace 2 semanas.",
      place: "Tienda Don Luis, entrada al caserío",
      status: "gestion",
      createdBy: seedUser,
      createdAt: nowISO(),
      votes: 5,
      images: [],
      history: [
        { id: uid("evt"), at: nowISO(), by: seedUser, type: "create", note: "Creó el reporte" },
        { id: uid("evt"), at: nowISO(), by: {id:"sys", name:"JAC"}, type: "status", to:"gestion", note: "Radicada solicitud a la empresa de energía" },
      ],
      comments: [],
    },
    {
      id: uid("rep"),
      title: "Acumulación de basuras en la cancha",
      category: "aseo",
      description: "Hay vertimiento de residuos los domingos. Se solicita jornada de limpieza.",
      place: "Cancha múltiple",
      status: "resuelto",
      createdBy: seedUser,
      createdAt: nowISO(),
      votes: 2,
      images: [],
      history: [
        { id: uid("evt"), at: nowISO(), by: seedUser, type: "create", note: "Creó el reporte" },
        { id: uid("evt"), at: nowISO(), by: {id:"sys", name:"JAC"}, type: "status", to:"gestion", note: "Convocada minga" },
        { id: uid("evt"), at: nowISO(), by: {id:"sys", name:"JAC"}, type: "status", to:"resuelto", note: "Se realizó limpieza comunitaria" },
      ],
      comments: [
        { id: uid("cmt"), at: nowISO(), by: {id:"sys", name:"JAC"}, text: "¡Gracias a quienes asistieron!" },
      ],
    },
  ];
  save(STORAGE_KEYS.reports, reports);
}

function Badge({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = STATUS.find((x) => x.id === status) || STATUS[0];
  return <Badge className={s.color}>{s.label}</Badge>;
}

function CategoryPill({ category }) {
  const c = CATEGORIES.find((x) => x.id === category) || CATEGORIES[CATEGORIES.length - 1];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
      <span>{c.icon}</span>
      <span className="text-gray-700">{c.label}</span>
    </span>
  );
}

function TopBar({ session, onChangeSession, onNewReport }) {
  const [open, setOpen] = useState(false);
  const nameRef = useRef(null);
  const roleRef = useRef(null);

  function saveSession() {
    const name = nameRef.current?.value?.trim() || "Vecino/a";
    const role = roleRef.current?.value || "vecino";
    const sess = { id: uid("usr"), name, role };
    save(STORAGE_KEYS.session, sess);
    onChangeSession(sess);
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-emerald-600 px-2 py-1 text-sm font-semibold text-white">Voz del Caserío</span>
          <span className="hidden text-sm text-gray-500 sm:block">Participación ciudadana simple</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onNewReport} className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50">
            + Nuevo reporte
          </button>
          <div className="relative">
            <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm hover:bg-gray-50">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-[10px] font-semibold text-white">U</span>
              <span>{session?.name || "Invitado"}</span>
              <Badge className="bg-gray-100 text-gray-700">{(ROLES.find(r=>r.id===session?.role)||ROLES[0]).label}</Badge>
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl border bg-white p-3 shadow-lg">
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500">Nombre</label>
                    <input ref={nameRef} defaultValue={session?.name} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring" placeholder="Tu nombre" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Rol</label>
                    <select ref={roleRef} defaultValue={session?.role} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring">
                      {ROLES.map((r) => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm hover:bg-gray-50">Cancelar</button>
                    <button onClick={saveSession} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Guardar</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function Sidebar({ filters, setFilters, counts }) {
  return (
    <aside className="hidden w-72 shrink-0 border-r bg-gray-50 p-3 md:block">
      <div className="space-y-6">
        <div>
          <label className="text-xs text-gray-500">Búsqueda</label>
          <input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="Buscar por título, lugar..."
            className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring"
          />
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold text-gray-500">Estado</div>
          <div className="space-y-1">
            {STATUS.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="status"
                    checked={filters.status === s.id}
                    onChange={() => setFilters((f) => ({ ...f, status: s.id }))}
                  />
                  <span>{s.label}</span>
                </div>
                <span className="text-xs text-gray-500">{counts.byStatus[s.id] || 0}</span>
              </label>
            ))}
            <label className="mt-1 flex cursor-pointer items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <input type="radio" name="status" checked={filters.status === "todos"} onChange={() => setFilters((f) => ({ ...f, status: "todos" }))} />
                <span>Todos</span>
              </div>
              <span className="text-xs text-gray-500">{counts.total}</span>
            </label>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold text-gray-500">Categorías</div>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilters((f) => ({ ...f, category: f.category === c.id ? "todas" : c.id }))}
                className={`rounded-lg border bg-white px-2 py-2 text-left text-xs hover:bg-gray-50 ${filters.category === c.id ? "ring-2 ring-emerald-500" : ""}`}
              >
                <div className="flex items-center gap-1">
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                </div>
                <div className="mt-1 text-[10px] text-gray-500">{(counts.byCat[c.id] || 0)} reportes</div>
              </button>
            ))}
            <button onClick={() => setFilters((f) => ({ ...f, category: "todas" }))} className={`rounded-lg border bg-white px-2 py-2 text-left text-xs hover:bg-gray-50 ${filters.category === "todas" ? "ring-2 ring-emerald-500" : ""}`}>
              Ver todas
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function EmptyState({ onNew }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="rounded-full bg-emerald-50 p-4 text-3xl">📭</div>
      <h3 className="text-lg font-semibold">No hay reportes con los filtros actuales</h3>
      <p className="max-w-md text-sm text-gray-500">Crea un reporte nuevo o cambia los filtros de estado/categoría/búsqueda para ver otros resultados.</p>
      <button onClick={onNew} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">+ Crear reporte</button>
    </div>
  );
}

function ReportsList({ items, onOpen, onVote }) {
  return (
    <ul role="list" className="divide-y">
      {items.map((r) => (
        <li key={r.id} className="cursor-pointer px-3 py-3 hover:bg-gray-50" onClick={() => onOpen(r)}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="truncate text-[15px] font-semibold text-gray-900">{r.title}</h4>
                <StatusBadge status={r.status} />
                <CategoryPill category={r.category} />
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-gray-600">{r.description}</p>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span>📍 {r.place}</span>
                <span>👤 {r.createdBy?.name || "Vecino/a"}</span>
                <span>🕒 {timeAgo(r.createdAt)}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onVote(r); }}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-gray-100"
                aria-label="Apoyar reporte"
              >
                <span>👍</span>
                <span>{r.votes || 0}</span>
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function UploadImages({ onChange }) {
  const [previews, setPreviews] = useState([]);
  function handleFiles(files) {
    const arr = Array.from(files || []);
    const readers = arr.map((file) => new Promise((res) => {
      const reader = new FileReader();
      reader.onload = () => res({ name: file.name, dataUrl: reader.result });
      reader.readAsDataURL(file);
    }));
    Promise.all(readers).then((imgs) => {
      setPreviews(imgs);
      onChange && onChange(imgs);
    });
  }
  return (
    <div>
      <input type="file" multiple accept="image/*" onChange={(e) => handleFiles(e.target.files)} className="block w-full text-sm" />
      {previews.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {previews.map((img, i) => (
            <img key={i} src={img.dataUrl} alt={`Imagen ${i+1}`} className="h-24 w-full rounded-lg object-cover" />
          ))}
        </div>
      )}
    </div>
  );
}

function NewReportModal({ open, onClose, onCreate, currentUser }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("vial");
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState("");
  const [images, setImages] = useState([]);

  useEffect(() => { if (!open) { setTitle(""); setCategory("vial"); setDescription(""); setPlace(""); setImages([]);} }, [open]);

  if (!open) return null;

  function submit() {
    if (!title.trim() || !description.trim()) return alert("Título y descripción son obligatorios.");
    const rep = {
      id: uid("rep"),
      title: title.trim(),
      category,
      description: description.trim(),
      place: place.trim() || "—",
      status: "nuevo",
      createdBy: currentUser || { id: uid("usr"), name: "Vecino/a", role: "vecino" },
      createdAt: nowISO(),
      votes: 0,
      images,
      history: [ { id: uid("evt"), at: nowISO(), by: currentUser, type: "create", note: "Creó el reporte" } ],
      comments: [],
    };
    onCreate(rep);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-lg font-semibold">Nuevo reporte</h3>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-gray-100" aria-label="Cerrar">✕</button>
        </div>
        <div className="grid gap-4 p-4">
          <div>
            <label className="text-xs text-gray-600">Título</label>
            <input value={title} onChange={(e)=>setTitle(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring" placeholder="Ej: Hueco en la vía principal" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-gray-600">Categoría</label>
              <select value={category} onChange={(e)=>setCategory(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring">
                {CATEGORIES.map((c)=> (
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600">Lugar / referencia</label>
              <input value={place} onChange={(e)=>setPlace(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring" placeholder="Ej: Frente a la escuela" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600">Descripción</label>
            <textarea value={description} onChange={(e)=>setDescription(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring" placeholder="Describe el problema y su impacto" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Fotos (opcional)</label>
            <UploadImages onChange={setImages} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t p-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={submit} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Crear</button>
        </div>
      </div>
    </div>
  );
}

function Timeline({ history }) {
  return (
    <ol className="relative ml-2 border-l pl-4">
      {history.slice().reverse().map((h) => (
        <li key={h.id} className="mb-3">
          <div className="absolute -left-[9px] h-4 w-4 rounded-full border bg-white" />
          <div className="text-xs text-gray-500">{new Date(h.at).toLocaleString()}</div>
          <div className="text-sm">
            {h.type === "create" && (<span><b>{h.by?.name || "Alguien"}</b> creó el reporte.</span>)}
            {h.type === "comment" && (<span><b>{h.by?.name || "Alguien"}</b> comentó: “{h.note}”.</span>)}
            {h.type === "status" && (<span><b>{h.by?.name || "Gestión"}</b> cambió estado a <b>{(STATUS.find(s=>s.id===h.to)||{}).label}</b>.</span>)}
          </div>
          {h.note && h.type !== "comment" && (<div className="text-xs text-gray-600">{h.note}</div>)}
        </li>
      ))}
    </ol>
  );
}

function ReportDetail({ report, onClose, onUpdate, session }) {
  const [comment, setComment] = useState("");
  const canManage = session?.role === "admin" || session?.role === "moderador";

  function addComment() {
    const txt = comment.trim();
    if (!txt) return;
    const c = { id: uid("cmt"), at: nowISO(), by: session, text: txt };
    const updated = {
      ...report,
      comments: [...report.comments, c],
      history: [...report.history, { id: uid("evt"), at: c.at, by: session, type: "comment", note: txt }],
    };
    onUpdate(updated);
    setComment("");
  }

  function changeStatus(to) {
    const updated = {
      ...report,
      status: to,
      history: [...report.history, { id: uid("evt"), at: nowISO(), by: session, type: "status", to, note: "" }],
    };
    onUpdate(updated);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/30 p-4">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold">{report.title}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <StatusBadge status={report.status} />
              <CategoryPill category={report.category} />
              <span>📍 {report.place}</span>
              <span>👤 {report.createdBy?.name}</span>
              <span>🕒 {new Date(report.createdAt).toLocaleString()}</span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-gray-100" aria-label="Cerrar">✕</button>
        </div>

        <div className="grid gap-6 p-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <h4 className="mb-2 text-sm font-semibold text-gray-700">Descripción</h4>
            <p className="whitespace-pre-wrap text-sm text-gray-800">{report.description}</p>

            {report.images?.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-sm font-semibold text-gray-700">Imágenes</h4>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {report.images.map((img, i) => (
                    <img key={i} src={img.dataUrl} alt={`Imagen ${i+1}`} className="h-32 w-full rounded-lg object-cover" />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              <h4 className="mb-2 text-sm font-semibold text-gray-700">Comentarios</h4>
              <div className="space-y-3">
                {report.comments.length === 0 && <div className="text-sm text-gray-500">Aún no hay comentarios.</div>}
                {report.comments.map((c) => (
                  <div key={c.id} className="rounded-lg border bg-white p-2">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{c.by?.name || "Vecino/a"}</span>
                      <span>{new Date(c.at).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-800">{c.text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input value={comment} onChange={(e)=>setComment(e.target.value)} className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring" placeholder="Escribe un comentario" />
                <button onClick={addComment} className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black">Comentar</button>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-700">Historial</h4>
            <div className="rounded-xl border bg-white p-3">
              <Timeline history={report.history} />
            </div>

            {canManage && (
              <div className="mt-6 rounded-xl border bg-white p-3">
                <h4 className="mb-2 text-sm font-semibold text-gray-700">Gestión</h4>
                <div className="grid gap-2">
                  <button onClick={() => changeStatus("nuevo")} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 text-left">Marcar como Reportado</button>
                  <button onClick={() => changeStatus("gestion")} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 text-left">Marcar En gestión</button>
                  <button onClick={() => changeStatus("resuelto")} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 text-left">Marcar Resuelto</button>
                </div>
                <p className="mt-2 text-xs text-gray-500">Solo visible para Moderador/Admin.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(load(STORAGE_KEYS.session, { id: uid("usr"), name: "Invitado", role: "vecino" }));
  const [reports, setReports] = useState(load(STORAGE_KEYS.reports, []));
  const [filters, setFilters] = useState({ q: "", status: "todos", category: "todas" });
  const [openNew, setOpenNew] = useState(false);
  const [openDetail, setOpenDetail] = useState(null);

  useEffect(() => { seedIfEmpty(); setReports(load(STORAGE_KEYS.reports, [])); }, []);
  useEffect(() => { save(STORAGE_KEYS.reports, reports); }, [reports]);

  const counts = useMemo(() => {
    const byStatus = Object.fromEntries(STATUS.map(s => [s.id, 0]));
    const byCat = Object.fromEntries(CATEGORIES.map(c => [c.id, 0]));
    for (const r of reports) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byCat[r.category] = (byCat[r.category] || 0) + 1;
    }
    return { total: reports.length, byStatus, byCat };
  }, [reports]);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (filters.status !== "todos" && r.status !== filters.status) return false;
      if (filters.category !== "todas" && r.category !== filters.category) return false;
      if (filters.q) {
        const q = filters.q.toLowerCase();
        const blob = `${r.title} ${r.description} ${r.place} ${r.createdBy?.name}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [reports, filters]);

  function handleCreateReport(rep) {
    setReports((prev) => [rep, ...prev]);
  }
  function handleUpdateReport(updated) {
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setOpenDetail(updated);
  }
  function handleVote(rep) {
    setReports((prev) => prev.map((r) => (r.id === rep.id ? { ...r, votes: (r.votes || 0) + 1 } : r)));
  }

  return (
    <div className="flex h-screen flex-col">
      <TopBar session={session} onChangeSession={setSession} onNewReport={() => setOpenNew(true)} />
      <div className="mx-auto flex h-[calc(100vh-52px)] w-full max-w-7xl overflow-hidden">
        <Sidebar filters={filters} setFilters={setFilters} counts={counts} />
        <main className="flex-1 overflow-auto">
          {/* Encabezado tipo Gmail */}
          <div className="sticky top-0 z-10 border-b bg-white/70 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-700">Reportes</h2>
                {filters.status !== "todos" && <StatusBadge status={filters.status} />}
                {filters.category !== "todas" && <CategoryPill category={filters.category} />}
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden sm:block">
                  <input
                    value={filters.q}
                    onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                    placeholder="Buscar…"
                    className="w-64 rounded-full border px-3 py-1.5 text-sm outline-none focus:ring"
                    aria-label="Buscar"
                  />
                </div>
                <button onClick={() => setOpenNew(true)} className="rounded-full bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">+ Nuevo</button>
              </div>
            </div>
          </div>

          {/* Lista */}
          {filtered.length === 0 ? (
            <EmptyState onNew={() => setOpenNew(true)} />
          ) : (
            <ReportsList items={filtered} onOpen={setOpenDetail} onVote={handleVote} />
          )}
        </main>
      </div>

      {/* Modales */}
      <NewReportModal open={openNew} onClose={() => setOpenNew(false)} onCreate={handleCreateReport} currentUser={session} />
      {openDetail && (
        <ReportDetail report={openDetail} onClose={() => setOpenDetail(null)} onUpdate={handleUpdateReport} session={session} />
      )}

      {/* Pie */}
      <footer className="border-t bg-white/80 px-3 py-2 text-center text-[11px] text-gray-500">
        Hecho con ❤️ para comunidades — "Voz del Caserío" · MVP sin servidor · Guarda datos en tu navegador.
      </footer>
    </div>
  );
}
