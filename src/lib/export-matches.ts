import type { Wine } from "./wines";
import jsPDF from "jspdf";

export type MatchRow = { wine: Wine; score: number; reasons: string[] };

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const ts = () => new Date().toISOString().slice(0, 10);

export function exportMatchesCSV(rows: MatchRow[]) {
  const headers = [
    "Name", "Producer", "Winemaker", "Year", "Region", "Varietal", "Type",
    "Price", "Body", "Sweetness", "Acidity", "Tannin", "Practices", "Festivals",
    "Match Score", "Match Reasons", "Producer URL", "Shop URL",
  ];
  const lines = [headers.join(",")];
  for (const { wine: w, score, reasons } of rows) {
    lines.push([
      w.name, w.producer, w.winemaker ?? "", w.year ?? "",
      w.region ?? "", w.varietal ?? "", w.type ?? "", w.price ?? "",
      w.body ?? "", w.sweetness ?? "", w.acidity ?? "", w.tannin ?? "",
      (w.practices ?? []).join("; "), (w.festivals ?? []).join("; "),
      score.toFixed(2), reasons.join("; "), w.producerUrl ?? "", w.shopUrl ?? "",
    ].map(csvEscape).join(","));
  }

  triggerDownload(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), `wine-matches-${ts()}.csv`);
}

export function exportMatchesPDF(rows: MatchRow[]) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  const ensureSpace = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.text("Your Wine Matches", margin, y);
  y += 22;
  doc.setFont("times", "italic");
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`${rows.length} wine${rows.length === 1 ? "" : "s"} · ${new Date().toLocaleDateString()}`, margin, y);
  y += 20;
  doc.setTextColor(0);

  rows.forEach(({ wine: w, score, reasons }, i) => {
    ensureSpace(120);
    doc.setDrawColor(210);
    doc.line(margin, y, pageW - margin, y);
    y += 14;

    doc.setFont("times", "bold");
    doc.setFontSize(13);
    const title = `${i + 1}. ${w.name}${w.year ? ` · ${w.year}` : ""}`;
    doc.text(title, margin, y);
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Match ${score.toFixed(1)}`, pageW - margin, y, { align: "right" });
    doc.setTextColor(0);
    y += 15;

    doc.setFontSize(10);
    doc.setTextColor(70);
    const meta = [w.producer, w.winemaker, w.region, w.varietal]
      .filter(Boolean).join(" · ");
    for (const line of doc.splitTextToSize(meta, pageW - margin * 2)) {
      ensureSpace(14); doc.text(line, margin, y); y += 13;
    }
    if (w.price != null) { ensureSpace(14); doc.text(`Price: $${w.price}`, margin, y); y += 13; }

    const practices = (w.practices ?? []).join(", ");
    if (practices) {
      for (const line of doc.splitTextToSize(`Practices: ${practices}`, pageW - margin * 2)) {
        ensureSpace(14); doc.text(line, margin, y); y += 13;
      }
    }
    doc.setTextColor(0);

    if (reasons.length) {
      y += 4;
      doc.setFont("times", "bold");
      doc.setFontSize(10);
      ensureSpace(14); doc.text("Why it matched", margin, y); y += 13;
      doc.setFont("times", "normal");
      for (const r of reasons) {
        for (const line of doc.splitTextToSize(`• ${r}`, pageW - margin * 2 - 10)) {
          ensureSpace(14); doc.text(line, margin + 10, y); y += 13;
        }
      }
    }
    y += 10;
  });

  doc.save(`wine-matches-${ts()}.pdf`);
}
