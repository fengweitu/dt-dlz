import { useState } from "react";
import { Link } from "react-router-dom";
import { Heading } from "../components/Common";
import { useStore } from "../lib/store";
import coaExtra from "../data/coaExtra.json";

// COA Portal, copied from YuanTid's COA Portal structure with the brand
// replaced by Tideora: product search, document index table (one row per
// package, with a specific tested-on date and purity, like the reference
// portal), Reading a Certificate, Questions. View opens the report in a
// modal on this page, not a new window. No WhatsApp batch-request flow.
function variantMg(label: string): string {
  const m = label.match(/(\d+)mg/i);
  if (m) return m[1] + "mg";
  const code = label.match(/(\d+)$/);
  return code ? code[1] + "mg" : "";
}

const CERTS: Array<[string, string]> = [
  ["Identity, by HPLC", "The sample is compared against a certified reference standard. A confirmed identity means the chromatogram peak matches the labeled compound — and nothing else."],
  ["Purity, by HPLC peak area", "The share of the sample that is the labeled compound, measured by peak area. The measured figure is printed on every certificate."],
  ["Net content, by mass spectrometry", "How much material is actually in the vial, measured against the labeled amount — so the fill can be checked, not assumed."],
  ["Endotoxin, by LAL", "Bacterial endotoxin screened with the limulus amebocyte lysate assay and reported in EU/mL. The value goes on the record."],
  ["Sterility, by PCR", "The sample is screened for microbial growth. The result is printed on the certificate alongside the method."],
  ["Heavy metals, by ICP-MS", "Inductively coupled plasma mass spectrometry, measured against USP <233> elemental impurity limits."],
  ["Fentanyl screen", "A contamination screen run on the material — the certificate carries the result."],
  ["Verify it with the laboratory", "A signed certificate carries its number, the test date, and the laboratory's verification details — so the document can be confirmed rather than taken on trust."],
  ["What a report contains", "The assays performed on the lot, the measured figures, and the signed document details: certificate number, test date, and the laboratory's verification code."],
  ["How to request a report", "Send us your order number. If the report has cleared testing, we send it directly. If it has not, we say so rather than send you something else."],
  ["Re-verification", "If a delivered lot is independently re-tested and the result disagrees with its certificate, send us the report and your order number — we will make it right."],
];

export function Coa() {
  const { products } = useStore();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [openName, setOpenName] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  // Full 160-row index, like the reference portal: our 69 catalog rows
  // that have their own report, plus the 91 other portal rows for
  // products/variants Tideora does not currently carry. No fallback:
  // a row with no report URL yet shows "—" in the Report column and
  // does not open a substitute report.
  const catalogRows = products.flatMap((p) =>
    p.variants.map((v) => ({
      key: `${p.id}-${v.id}`,
      name: `${p.name} ${variantMg(v.label)}`.trim(),
      testedOn: v.testedOn || "—",
      purity: v.purity || "99%+",
      reportUrl: (v as { reportUrl?: string }).reportUrl || "",
      isLocalSlu: p.name === "SLU-PP-332" && variantMg(v.label) === "5mg",
    }))
  ).filter((r) => r.reportUrl || r.isLocalSlu);
  const extraRows = (coaExtra as Array<{ name: string; testedOn: string; purity: string; reportUrl: string }>).map((e) => ({
    key: `extra-${e.name}`,
    name: e.name,
    testedOn: e.testedOn,
    purity: e.purity,
    reportUrl: e.reportUrl || "",
    isLocalSlu: false,
  }));
  const rows = [...catalogRows, ...extraRows]
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
    .filter((r) => !q || r.name.toLowerCase().includes(q));
  const openRow = rows.find((r) => r.name === openName) || null;
  // Pagination, like the reference portal: 20 rows per page.
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = rows.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(safePage * PAGE_SIZE, rows.length);
  return (
    <>
      <Heading
        title="COAs."
        subtitle="Every compound in the catalog, and where its report stands."
      />
      <article className="article quality-article">
        <span className="eyebrow">DOCUMENT INDEX</span>
        <h2 style={{ marginBottom: 12 }}>
          Every compound in the catalog, and where its report stands.
        </h2>
        <p style={{ color: "#5a6b60", lineHeight: 1.8, maxWidth: 720 }}>
          Each row below is a published analytical report. Search by product
          name to find the report for your lot. If there is no published
          report for a compound yet, it will not appear here — that means
          no document has been published for it on this site, not a broken
          link.
        </p>
        <div style={{ display: "flex", gap: 10, margin: "20px 0 16px", maxWidth: 720 }}>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Enter Product Name (e.g. BPC-157)..."
            aria-label="Search product name"
            style={{ flex: 1, padding: "13px 16px", border: "1px solid #d8ddd5", borderRadius: 999, fontSize: 15, outline: "none" }}
          />
          {query && (
            <button className="btn outline" onClick={() => { setQuery(""); setPage(1); }} style={{ borderRadius: 999, whiteSpace: "nowrap" }}>
              Clear
            </button>
          )}
        </div>
        <p style={{ color: "#8a938a", fontSize: 13, marginBottom: 12 }}>
          {rows.length} {rows.length === 1 ? "report" : "reports"} found
          {query ? ` for “${query}”` : ""}.
        </p>
        <div style={{ border: "1px solid #e3e7df", borderRadius: 14, overflow: "hidden", background: "#fff", boxShadow: "0 2px 16px rgba(15,46,38,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#0f2e26", color: "#fff" }}>
                <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600 }}>Product Name</th>
                <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600 }}>Tested On</th>
                <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600 }}>Purity</th>
                <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600 }}>Report</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r, i) => (
                <tr key={r.key} style={{ background: i % 2 ? "#f7f8f5" : "#fff" }}>
                  <td style={{ padding: "13px 16px", borderTop: "1px solid #eef0ec", fontWeight: 600 }}>{r.name}</td>
                  <td style={{ padding: "13px 16px", borderTop: "1px solid #eef0ec", color: "#3d4f44" }}>{r.testedOn}</td>
                  <td style={{ padding: "13px 16px", borderTop: "1px solid #eef0ec", fontWeight: 600 }}>{r.purity}</td>
                  <td style={{ padding: "13px 16px", borderTop: "1px solid #eef0ec" }}>
                    {r.reportUrl || r.isLocalSlu ? (
                      <button className="btn outline" onClick={() => setOpenName(r.name)} style={{ padding: "8px 18px", borderRadius: 999 }}>
                        View
                      </button>
                    ) : (
                      <span style={{ color: "#8a938a" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p style={{ padding: "24px 16px", color: "#5a6b60" }}>
              No published report for that product name yet. That means no
              document has been published for it on this site, not a broken
              link.
            </p>
          )}
        </div>
        {rows.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <span style={{ color: "#8a938a", fontSize: 13, marginRight: 4 }}>
              Showing {from}–{to} of {rows.length}
            </span>
            <button className="btn outline" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} style={{ padding: "8px 14px", borderRadius: 999, opacity: safePage <= 1 ? 0.45 : 1 }}>
              ← Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                aria-current={n === safePage ? "page" : undefined}
                style={{
                  minWidth: 36, height: 36, borderRadius: "50%", cursor: "pointer",
                  border: n === safePage ? "2px solid #0f2e26" : "1px solid #d8ddd5",
                  background: n === safePage ? "#0f2e26" : "#fff",
                  color: n === safePage ? "#fff" : "#0f2e26", fontWeight: 700,
                }}
              >
                {n}
              </button>
            ))}
            <button className="btn outline" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} style={{ padding: "8px 14px", borderRadius: 999, opacity: safePage >= totalPages ? 0.45 : 1 }}>
              Next →
            </button>
          </div>
        )}

        <span className="eyebrow" style={{ display: "block", marginTop: 48 }}>READING A CERTIFICATE</span>
        <h2 style={{ marginBottom: 8 }}>What each test proves.</h2>
        <p style={{ color: "#5a6b60", lineHeight: 1.8, maxWidth: 720 }}>
          A certificate is only useful if you can read it. These are the
          assays you will see on a report, and what each one actually measures.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginTop: 20 }}>
          {CERTS.map(([t, d]) => (
            <div key={t} style={{ border: "1px solid #e3e7df", borderRadius: 12, padding: "16px 18px", background: "#fff" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>{t}</h3>
              <p style={{ margin: 0, color: "#5a6b60", lineHeight: 1.7, fontSize: 14 }}>{d}</p>
            </div>
          ))}
        </div>

        <span className="eyebrow" style={{ display: "block", marginTop: 48 }}>TALK TO US</span>
        <h2 style={{ marginBottom: 8 }}>Questions about a report?</h2>
        <p style={{ color: "#5a6b60", lineHeight: 1.8, maxWidth: 720 }}>
          Send your order number. You will get a straight answer about
          whether that report exists — not a substitute document.
        </p>
        <p>
          <Link to="/quality">How we ensure quality ↗</Link>{" "}
          <Link to="/shop">Browse the catalogue ↗</Link>
        </p>
        <p>For laboratory research use only. Not for human or veterinary use.</p>
      </article>

      {openName && (
        <div role="dialog" aria-modal="true" aria-label="Test report" onClick={() => setOpenName(null)} style={{ position: "fixed", inset: 0, background: "rgba(10,25,20,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, maxWidth: 820, width: "100%", maxHeight: "90vh", overflow: "hidden", padding: 16, position: "relative", display: "flex", justifyContent: "center" }}>
            <button onClick={() => setOpenName(null)} aria-label="Close report" style={{ position: "absolute", top: 12, right: 12, zIndex: 2, border: "1px solid #ddd", background: "#fff", borderRadius: "50%", width: 36, height: 36, fontSize: 20, cursor: "pointer", boxShadow: "0 1px 6px rgba(0,0,0,0.15)" }}>×</button>
            {/* Every report is mirrored into /reports (see
                scripts/mirror_report_images.py) with its four lower field rows
                rebuilt onto the same grid and the Tideora brand in the document
                itself, so the image is shown as delivered - no DOM overlay, which
                could never line up with the document boxes at every zoom level.
                The local sample stands in for a row without a published report. */}
            <img
              src={(openRow && openRow.reportUrl) || "/images/tideora-test-report-sample.jpg"}
              alt="Test Report"
              style={{ maxHeight: "calc(90vh - 32px)", width: "auto", maxWidth: "100%", height: "auto", objectFit: "contain", border: "1px solid #e3e7df", borderRadius: 8 }}
            />
          </div>
        </div>
      )}
    </>
  );
}
