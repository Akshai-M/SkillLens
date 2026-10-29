// Client-side PDF export of a rendered report. Each [data-pdf-block] element is captured
// separately (keeping every canvas under browser size limits) and laid out on A4 pages;
// each [data-pdf-page] group (a report section) starts on a new page. Libraries load only
// when an export starts.

const LOGO_URL = "/brand/nxtwave-academy.jpeg";
/** Stay under Safari's ~16.7M-pixel canvas limit. */
const MAX_CANVAS_PIXELS = 16_000_000;

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/** The logo has a black square background; crop to the wordmark for the footer. */
async function loadLogo(): Promise<{ data: string; ratio: number } | null> {
  try {
    const img = new Image();
    img.src = LOGO_URL;
    await img.decode();
    const crop = { x: 0.04 * img.width, y: 0.2 * img.height, w: 0.94 * img.width, h: 0.48 * img.height };
    const canvas = document.createElement("canvas");
    canvas.width = crop.w;
    canvas.height = crop.h;
    canvas.getContext("2d")?.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
    return { data: canvas.toDataURL("image/jpeg", 0.92), ratio: crop.w / crop.h };
  } catch {
    return null;
  }
}

/** Outermost [data-pdf-block] elements under root, in document order. */
function collectBlocks(root: HTMLElement): HTMLElement[] {
  const all = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-block]"));
  return all.filter((el) => !all.some((other) => other !== el && other.contains(el)) && el.offsetHeight > 0);
}

export async function exportReportPdf(root: HTMLElement, fileName: string, footerLabel: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  await document.fonts?.ready;
  await nextFrame();

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait", compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 28;
  const footerH = 30;
  const gap = 10;
  const contentW = pageW - margin * 2;
  const contentBottom = pageH - margin - footerH;

  const rootRect = root.getBoundingClientRect();
  const ptPerPx = contentW / rootRect.width;
  const logo = await loadLogo();

  let y = margin;
  let pageHasContent = false;
  const newPage = () => {
    pdf.addPage();
    y = margin;
    pageHasContent = false;
  };

  let group: Element | null = null;
  for (const block of collectBlocks(root)) {
    const blockGroup = block.closest("[data-pdf-page]");
    if (blockGroup !== group) {
      if (blockGroup && pageHasContent) newPage();
      group = blockGroup;
    }

    const rect = block.getBoundingClientRect();
    const scale = Math.min(1.6, Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, rect.width * rect.height)));
    const canvas = await html2canvas(block, {
      scale,
      backgroundColor: null,
      useCORS: true,
      logging: false,
      ignoreElements: (el) => el.classList?.contains("no-print") ?? false,
      onclone: (doc) => {
        // Show full text and every collapsed detail in the PDF.
        doc.querySelectorAll<HTMLElement>("[data-clamp]").forEach((el) => {
          el.style.display = "block";
          el.style.webkitLineClamp = "unset";
          el.style.overflow = "visible";
        });
        doc.querySelectorAll("details").forEach((d) => (d.open = true));
        doc.querySelectorAll<HTMLElement>(".print\\:grid, .print\\:block").forEach((el) => el.classList.remove("hidden"));
      },
    });

    const x = margin + (rect.left - rootRect.left) * ptPerPx;
    const w = rect.width * ptPerPx;
    const h = (canvas.height / canvas.width) * w;

    if (y + h > contentBottom && pageHasContent) newPage();

    if (y + h <= contentBottom) {
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.82), "JPEG", x, y, w, h, undefined, "FAST");
      y += h + gap;
      pageHasContent = true;
      continue;
    }

    // Taller than a page: slice it across pages.
    const pxPerPt = canvas.width / w;
    let offsetPt = 0;
    while (offsetPt < h) {
      const sliceH = Math.min(contentBottom - y, h - offsetPt);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = Math.ceil(sliceH * pxPerPt);
      slice.getContext("2d")?.drawImage(canvas, 0, Math.floor(offsetPt * pxPerPt), canvas.width, slice.height, 0, 0, canvas.width, slice.height);
      pdf.addImage(slice.toDataURL("image/jpeg", 0.82), "JPEG", x, y, w, sliceH, undefined, "FAST");
      offsetPt += sliceH;
      pageHasContent = true;
      if (offsetPt < h) newPage();
      else y += sliceH + gap;
    }
  }

  // Footer on every page: label and page number left, "Powered by" logo right.
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    const fy = pageH - margin + 4;
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, pageH - margin - footerH + 8, pageW - margin, pageH - margin - footerH + 8);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`${footerLabel} · Page ${i} of ${pages}`, margin, fy);
    if (logo) {
      const lh = 16;
      const lw = lh * logo.ratio;
      const lx = pageW - margin - lw;
      pdf.setFillColor(0, 0, 0);
      pdf.roundedRect(lx - 4, fy - lh + 2, lw + 8, lh + 4, 3, 3, "F");
      pdf.addImage(logo.data, "JPEG", lx, fy - lh + 4, lw, lh);
      pdf.text("Powered by", lx - 10 - pdf.getTextWidth("Powered by"), fy);
    }
  }

  pdf.save(fileName);
}
