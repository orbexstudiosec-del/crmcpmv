import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface TablaExport {
  titulo: string;
  columnas: string[];
  filas: (string | number)[][];
}

/** Cada tabla se vuelve una hoja del libro — nombre recortado a 31 caracteres, el límite de Excel. */
export function exportarExcel(tablas: TablaExport[], nombreArchivo: string) {
  const wb = XLSX.utils.book_new();
  tablas.forEach((t, i) => {
    const ws = XLSX.utils.aoa_to_sheet([t.columnas, ...t.filas]);
    XLSX.utils.book_append_sheet(wb, ws, t.titulo.slice(0, 31) || `Hoja ${i + 1}`);
  });
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
}

/** Un PDF con una tabla por sección, todas apiladas — agrega página nueva si no cabe. */
export function exportarPDF(titulo: string, tablas: TablaExport[], nombreArchivo: string) {
  const doc = new jsPDF();
  const margenIzq = 14;
  const altoPagina = doc.internal.pageSize.getHeight();

  doc.setFontSize(14);
  doc.text(titulo, margenIzq, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(new Date().toLocaleDateString("es-EC", { day: "2-digit", month: "long", year: "numeric" }), margenIzq, 21);
  doc.setTextColor(0);

  let y = 30;
  for (const t of tablas) {
    if (t.filas.length === 0) continue;
    if (y > altoPagina - 40) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.text(t.titulo, margenIzq, y);
    autoTable(doc, {
      startY: y + 3,
      head: [t.columnas],
      body: t.filas,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [42, 120, 214] },
      margin: { left: margenIzq, right: margenIzq },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  }
  doc.save(`${nombreArchivo}.pdf`);
}
