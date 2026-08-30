import { useEffect, useState } from "react";
import Header from "./Header";
import Statements from "./Statements";
import Upload from "./Upload";
import Viewer from "./Viewer";
import Guide from "./Guide";

function parseHash() {
  const h = (location.hash || "#/").replace(/^#/, "");
  const parts = h.split("/").filter(Boolean); // ['statement','id','tab']
  if (parts[0] === "statement") return { view: "viewer", id: parts[1], tab: parts[2] || "summary" };
  if (parts[0] === "upload") return { view: "upload" };
  if (parts[0] === "guide") return { view: "guide" };
  return { view: "home" };
}

export default function App() {
  const [r, setR] = useState(parseHash());
  const [retention, setRetention] = useState(60);
  useEffect(() => {
    const on = () => setR(parseHash());
    window.addEventListener("hashchange", on);
    import("./api").then(({ api }) => api.meta().then((m) => setRetention(m.retention_minutes || 60)));
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const routeName = r.view === "viewer" ? "viewer" : r.view;
  return (
    <div className="min-h-[100dvh]">
      <Header route={routeName === "viewer" ? "" : routeName} />
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        {r.view === "home" && <Statements retention={retention} />}
        {r.view === "upload" && <Upload retention={retention} />}
        {r.view === "guide" && <Guide />}
        {r.view === "viewer" && <Viewer id={r.id} tab={r.tab} />}
      </main>
    </div>
  );
}
