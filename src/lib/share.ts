const PRIMARY = "#00685f";
const ON_SURFACE_VARIANT = "#3d4947";
const OUTLINE_VARIANT = "#bcc9c6";
const SURFACE_CONTAINER_LOW = "#eff4ff";

const PRINT_BASE_STYLE = `
  body { font-family: 'Segoe UI', Inter, system-ui, sans-serif; color: #0d1c2e; margin: 0; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid ${PRIMARY}; padding-bottom: 20px; margin-bottom: 24px; }
  .header h1 { margin: 0; font-size: 22px; color: ${PRIMARY}; text-transform: uppercase; letter-spacing: -0.01em; }
  .header p { margin: 2px 0 0; font-size: 12px; color: ${ON_SURFACE_VARIANT}; }
  .reg { font-size: 12px; font-weight: bold; color: ${PRIMARY}; text-align: right; }
  .demo-box { display: flex; flex-wrap: wrap; gap: 20px; background: ${SURFACE_CONTAINER_LOW}; border: 1px solid ${OUTLINE_VARIANT}; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; }
  .demo-box div { display: flex; flex-direction: column; gap: 2px; }
  .demo-box span.label { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #6d7a77; letter-spacing: 0.05em; }
  .demo-box span.value { font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #dce9ff; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: ${ON_SURFACE_VARIANT}; }
  td { padding: 10px; font-size: 13px; border-bottom: 1px solid #eee; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid ${OUTLINE_VARIANT}; display: flex; justify-content: space-between; align-items: flex-end; }
  .signature { text-align: center; width: 220px; border-top: 2px solid #0d1c2e; padding-top: 6px; }
  .signature p:first-child { margin: 0; font-weight: bold; }
  .signature p:last-child { margin: 2px 0 0; font-size: 10px; color: ${ON_SURFACE_VARIANT}; letter-spacing: 0.08em; text-transform: uppercase; }
  @media print { .no-print { display: none !important; } }
`;

function openPrintWindow(title: string, bodyHtml: string, extraStyle = ""): void {
  const win = window.open("", "_blank", "width=520,height=720");
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>${PRINT_BASE_STYLE}${extraStyle}</style>
      </head>
      <body>${bodyHtml}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function clinicHeader(regNo: string): string {
  return `
    <div class="header">
      <div>
        <h1>Dr. Abdul Hayee Medical Centre</h1>
        <p>Nankana Sahib Branch, Punjab, Pakistan</p>
        <p>+92 (0) 56 1234567</p>
      </div>
      <span class="reg">${regNo}</span>
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function today(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/* ---------------------------------------------------------------- reception */

interface TokenSlipData {
  tokenNumber: number;
  patientName: string;
  age?: number;
  gender?: string;
  fee: number;
}

/** Small slip handed to the patient at the token desk. */
export function printTokenSlip(data: TokenSlipData): void {
  openPrintWindow(
    "Token Slip",
    `
      ${clinicHeader("Token Slip")}
      <div style="text-align:center;margin:24px 0;">
        <p style="margin:0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${ON_SURFACE_VARIANT};">Token Number</p>
        <p style="margin:4px 0 0;font-size:72px;font-weight:700;line-height:1;color:${PRIMARY};">${data.tokenNumber}</p>
      </div>
      <div class="demo-box">
        <div><span class="label">Patient Name</span><span class="value">${escapeHtml(data.patientName)}</span></div>
        <div><span class="label">Age / Gender</span><span class="value">${[data.age ? `${data.age} Yrs` : null, data.gender].filter(Boolean).join(" / ") || "—"}</span></div>
        <div><span class="label">Date</span><span class="value">${today()}</span></div>
      </div>
      <table>
        <tbody>
          <tr><td>Consultation Fee</td><td style="text-align:right;"><strong>Rs. ${data.fee}</strong></td></tr>
        </tbody>
      </table>
      <p style="text-align:center;margin-top:16px;font-size:14px;font-weight:bold;color:${PRIMARY};letter-spacing:0.08em;">PAID</p>
      <p style="text-align:center;margin-top:20px;font-size:11px;color:${ON_SURFACE_VARIANT};">
        Please keep this slip and wait for your token to be called.
      </p>
    `,
  );
}

/* ------------------------------------------------------------------ doctor */

interface PrescriptionSlipData {
  patientName: string;
  tokenNumber?: number;
  age?: number;
  gender?: string;
  mrNo?: string;
  diagnosis?: string;
  vitals?: { bp?: string; temperature?: number; weight?: number };
}

/**
 * A pre-printed prescription form: the clinic header and the patient's details
 * are filled in, and the ℞ area is left blank for the doctor to write the
 * medicines by hand — matching how the clinic has always worked.
 */
export function printPrescriptionSlip(data: PrescriptionSlipData): void {
  const vitalCells = [
    data.vitals?.bp
      ? `<div><span class="label">BP</span><span class="value">${escapeHtml(data.vitals.bp)}</span></div>`
      : "",
    data.vitals?.temperature
      ? `<div><span class="label">Temp</span><span class="value">${data.vitals.temperature}&deg;F</span></div>`
      : "",
    data.vitals?.weight
      ? `<div><span class="label">Weight</span><span class="value">${data.vitals.weight} kg</span></div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  openPrintWindow(
    "Prescription",
    `
      ${clinicHeader("REG # 5542-MD-NS")}
      <div class="demo-box">
        <div><span class="label">Patient Name</span><span class="value">${escapeHtml(data.patientName)}</span></div>
        <div><span class="label">Age / Gender</span><span class="value">${[data.age ? `${data.age} Yrs` : null, data.gender].filter(Boolean).join(" / ") || "—"}</span></div>
        ${data.tokenNumber ? `<div><span class="label">Token</span><span class="value">#${data.tokenNumber}</span></div>` : ""}
        <div><span class="label">Date</span><span class="value">${today()}</span></div>
        ${data.mrNo ? `<div><span class="label">MR No.</span><span class="value">${escapeHtml(data.mrNo)}</span></div>` : ""}
      </div>
      ${vitalCells ? `<div class="demo-box">${vitalCells}</div>` : ""}
      <div class="dx">
        <span class="dx-label">Diagnosis</span>
        <span class="dx-value">${data.diagnosis ? escapeHtml(data.diagnosis) : ""}</span>
      </div>
      <div class="rx-area">
        <span class="rx-symbol">&#8478;</span>
      </div>
      <div class="footer">
        <p style="font-size:10px;color:${ON_SURFACE_VARIANT};max-width:220px;">Health First &bull; Patient Focus &bull; Clinical Excellence</p>
        <div class="signature">
          <p>Dr. Abdul Hayee</p>
          <p>Authorized Signature</p>
        </div>
      </div>
    `,
    `
      .dx { display:flex; align-items:flex-end; gap:10px; margin-bottom:18px; }
      .dx-label { font-size:9px; font-weight:bold; text-transform:uppercase; letter-spacing:0.05em; color:#6d7a77; padding-bottom:3px; white-space:nowrap; }
      .dx-value { flex:1; border-bottom:1px dotted ${OUTLINE_VARIANT}; min-height:20px; font-size:13px; padding-bottom:3px; }
      /* Ruled writing area, sized to fill the page so there is room to write. */
      .rx-area {
        position:relative; min-height:420px; padding:16px 8px;
        border:1px solid ${OUTLINE_VARIANT}; border-radius:10px;
        background-image: repeating-linear-gradient(
          to bottom, transparent, transparent 33px, ${OUTLINE_VARIANT} 33px, ${OUTLINE_VARIANT} 34px
        );
        background-position: 0 26px;
      }
      .rx-symbol { position:absolute; top:8px; left:12px; font-size:34px; font-weight:700; color:${PRIMARY}; line-height:1; }
    `,
  );
}

/* --------------------------------------------------------------------- lab */

interface LabReportData {
  patientName: string;
  tokenNumber?: number;
  tests: { name: string; result?: string; unit?: string }[];
}

export function printLabReport(data: LabReportData): void {
  const rows = data.tests
    .map(
      (t) => `
        <tr>
          <td><strong>${escapeHtml(t.name)}</strong></td>
          <td>${escapeHtml(t.result ?? "—")}</td>
          <td>${escapeHtml(t.unit ?? "")}</td>
        </tr>`,
    )
    .join("");

  openPrintWindow(
    "Lab Report",
    `
      ${clinicHeader("Lab Report")}
      <div class="demo-box">
        <div><span class="label">Patient Name</span><span class="value">${escapeHtml(data.patientName)}</span></div>
        ${data.tokenNumber ? `<div><span class="label">Token</span><span class="value">#${data.tokenNumber}</span></div>` : ""}
        <div><span class="label">Date</span><span class="value">${today()}</span></div>
      </div>
      <table>
        <thead><tr><th>Test</th><th>Result</th><th>Unit</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">
        <p style="font-size:10px;color:${ON_SURFACE_VARIANT};">Results verified by the clinic laboratory.</p>
        <div class="signature">
          <p>Lab Technician</p>
          <p>Signature</p>
        </div>
      </div>
    `,
  );
}

/* ----------------------------------------------------------------- receipt */

interface ReceiptData {
  title: string;
  patientName: string;
  tokenNumber?: number;
  items: { label: string; amount: number }[];
  total: number;
  paid: boolean;
}

export function printReceipt(data: ReceiptData): void {
  const rows = data.items
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.label)}</td><td style="text-align:right;">Rs. ${i.amount}</td></tr>`,
    )
    .join("");

  openPrintWindow(
    data.title,
    `
      ${clinicHeader(data.title)}
      <div class="demo-box">
        <div><span class="label">Patient Name</span><span class="value">${escapeHtml(data.patientName)}</span></div>
        ${data.tokenNumber ? `<div><span class="label">Token</span><span class="value">#${data.tokenNumber}</span></div>` : ""}
        <div><span class="label">Date</span><span class="value">${today()}</span></div>
      </div>
      <table>
        <thead><tr><th>Description</th><th style="text-align:right;">Amount</th></tr></thead>
        <tbody>
          ${rows}
          <tr><td><strong>Total</strong></td><td style="text-align:right;"><strong>Rs. ${data.total}</strong></td></tr>
        </tbody>
      </table>
      <p style="text-align:center;margin-top:24px;font-size:16px;font-weight:bold;color:${data.paid ? PRIMARY : "#ba1a1a"};letter-spacing:0.1em;">
        ${data.paid ? "PAID" : "UNPAID"}
      </p>
      <div class="footer">
        <p style="font-size:10px;color:${ON_SURFACE_VARIANT};max-width:240px;">Computer-generated receipt — no physical signature required.</p>
        <div class="signature">
          <p>Dr. Abdul Hayee Medical Centre</p>
          <p>Nankana Sahib</p>
        </div>
      </div>
    `,
  );
}

/* ------------------------------------------------------------ patient card */

interface PatientCardData {
  mrNo?: number;
  patientName: string;
  phone: string;
  age?: number;
  gender?: string;
}

/**
 * Wallet-sized card the patient keeps and brings back. Reception types the MR
 * number instead of guessing name spellings, which is both faster and the
 * cheapest defence against creating duplicate records.
 */
export function printPatientCard(data: PatientCardData): void {
  openPrintWindow(
    "Patient Card",
    `
      ${clinicHeader("Patient Card")}
      <div style="text-align:center;margin:20px 0;">
        <p style="margin:0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${ON_SURFACE_VARIANT};">MR Number</p>
        <p style="margin:4px 0 0;font-size:56px;font-weight:700;line-height:1;color:${PRIMARY};">${data.mrNo ?? "—"}</p>
      </div>
      <div class="demo-box">
        <div><span class="label">Patient Name</span><span class="value">${escapeHtml(data.patientName)}</span></div>
        <div><span class="label">Phone</span><span class="value">${escapeHtml(data.phone)}</span></div>
        <div><span class="label">Age / Gender</span><span class="value">${[data.age ? `${data.age} Yrs` : null, data.gender].filter(Boolean).join(" / ") || "—"}</span></div>
      </div>
      <p style="text-align:center;margin-top:20px;font-size:12px;color:${ON_SURFACE_VARIANT};">
        Please bring this card on every visit and show it at the token desk.
      </p>
    `,
  );
}

/* --------------------------------------------------------- closing report */

export interface ClosingReportData {
  date: string;
  patientsSeen: number;
  patientsWaiting: number;
  consultationCount: number;
  consultationTotal: number;
  labCount: number;
  labTotal: number;
  unpaidLabCount: number;
  byCollector: { name: string; consultation: number; lab: number; total: number }[];
}

/** End-of-day sheet the doctor signs off against the cash actually in the drawers. */
export function printClosingReport(data: ClosingReportData): void {
  const collectorRows = data.byCollector.length
    ? data.byCollector
        .map(
          (c) => `
        <tr>
          <td>${escapeHtml(c.name)}</td>
          <td style="text-align:right;">Rs. ${c.consultation}</td>
          <td style="text-align:right;">Rs. ${c.lab}</td>
          <td style="text-align:right;"><strong>Rs. ${c.total}</strong></td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="4" style="text-align:center;color:${ON_SURFACE_VARIANT};">No payments recorded.</td></tr>`;

  openPrintWindow(
    "Daily Closing Report",
    `
      ${clinicHeader("Daily Closing")}
      <div class="demo-box">
        <div><span class="label">Date</span><span class="value">${escapeHtml(data.date)}</span></div>
        <div><span class="label">Patients Seen</span><span class="value">${data.patientsSeen}</span></div>
        <div><span class="label">Still Waiting</span><span class="value">${data.patientsWaiting}</span></div>
      </div>

      <h2 style="font-size:14px;margin:20px 0 4px;">Cash Drawers</h2>
      <table>
        <thead><tr><th>Drawer</th><th style="text-align:right;">Payments</th><th style="text-align:right;">Amount</th></tr></thead>
        <tbody>
          <tr><td>Reception — consultation</td><td style="text-align:right;">${data.consultationCount}</td><td style="text-align:right;"><strong>Rs. ${data.consultationTotal}</strong></td></tr>
          <tr><td>Laboratory — tests</td><td style="text-align:right;">${data.labCount}</td><td style="text-align:right;"><strong>Rs. ${data.labTotal}</strong></td></tr>
          <tr><td><strong>Total expected in hand</strong></td><td></td><td style="text-align:right;"><strong>Rs. ${data.consultationTotal + data.labTotal}</strong></td></tr>
        </tbody>
      </table>

      ${
        data.unpaidLabCount > 0
          ? `<p style="margin-top:12px;font-size:13px;color:#ba1a1a;"><strong>${data.unpaidLabCount}</strong> patient(s) were sent to the lab without paying.</p>`
          : ""
      }

      <h2 style="font-size:14px;margin:20px 0 4px;">Collected By</h2>
      <table>
        <thead><tr><th>Staff</th><th style="text-align:right;">Consultation</th><th style="text-align:right;">Lab</th><th style="text-align:right;">Total</th></tr></thead>
        <tbody>${collectorRows}</tbody>
      </table>

      <div style="margin-top:28px;display:flex;gap:24px;">
        <div style="flex:1;border:1px solid ${OUTLINE_VARIANT};border-radius:8px;padding:12px;">
          <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:${ON_SURFACE_VARIANT};">Cash counted</p>
          <div style="height:28px;border-bottom:1px dotted ${OUTLINE_VARIANT};"></div>
        </div>
        <div style="flex:1;border:1px solid ${OUTLINE_VARIANT};border-radius:8px;padding:12px;">
          <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:${ON_SURFACE_VARIANT};">Difference</p>
          <div style="height:28px;border-bottom:1px dotted ${OUTLINE_VARIANT};"></div>
        </div>
      </div>

      <div class="footer">
        <p style="font-size:10px;color:${ON_SURFACE_VARIANT};">Generated ${new Date().toLocaleString()}</p>
        <div class="signature">
          <p>Checked By</p>
          <p>Signature</p>
        </div>
      </div>
    `,
  );
}

/* --------------------------------------------------------------- exports */

/** Triggers a browser download of a CSV file built in memory. */
export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const escapeCell = (cell: string | number) => {
    const value = String(cell ?? "");
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  const csv = rows.map((row) => row.map(escapeCell).join(",")).join("\n");
  // BOM keeps Excel from mangling Urdu names.
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Opens WhatsApp with a prefilled text message, to the patient's number if known. */
export function shareOnWhatsApp(phone: string | undefined, text: string): void {
  const cleanedPhone = phone?.replace(/[^\d]/g, "");
  const base = cleanedPhone ? `https://wa.me/${cleanedPhone}` : "https://wa.me/";
  window.open(`${base}?text=${encodeURIComponent(text)}`, "_blank");
}
