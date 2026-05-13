"use client";

import { type ChangeEvent, type CSSProperties, useEffect, useMemo, useRef, useState } from "react";

import { buttonClassName, cx } from "../../../../components/ui";
import styles from "./invoice-builder.module.css";

type InvoiceLineItem = {
  amount: string;
  icon: string;
  note: string;
  quantity: string;
  rate: string;
  title: string;
};

type InvoiceDraft = {
  billToBusiness: string;
  billToCityStateZip: string;
  billToContact: string;
  billToEmail: string;
  billToStreet: string;
  brandAccent: string;
  brandName: string;
  brandTagline: string;
  colorAccent: string;
  colorDark: string;
  colorSilver: string;
  dueDate: string;
  footerMessage: string;
  invoiceDate: string;
  invoiceNumber: string;
  logoDataUrl: string;
  milestone: string;
  paymentMethod: string;
  paymentRecipient: string;
  projectSubtitle: string;
  projectTitle: string;
  showFooter: boolean;
  showFooterLogo: boolean;
  showSwooshes: boolean;
  showLogo: boolean;
  thankYou: string;
  terms: string;
};

type SavedInvoiceDraft = {
  draft: InvoiceDraft;
  id: string;
  items: InvoiceLineItem[];
  name: string;
  savedAt: string;
};

const savedDraftsStorageKey = "torqueops.invoiceBuilder.savedDrafts.v1";
const invoicePreviewWidth = 850;
const invoicePreviewPadding = 48;

const initialDraft: InvoiceDraft = {
  billToBusiness: "Underdog Automotive",
  billToCityStateZip: "[City, State, ZIP]",
  billToContact: "[Contact Name]",
  billToEmail: "[Email Address]",
  billToStreet: "[Street Address]",
  brandAccent: "Ops",
  brandName: "Torque",
  brandTagline: "Custom software. Built for performance.",
  colorAccent: "#ff7900",
  colorDark: "#05080c",
  colorSilver: "#cfd3d8",
  dueDate: "Upon Receipt",
  footerMessage: "Thank you for partnering with TorqueOps.",
  invoiceDate: "May 12, 2026",
  invoiceNumber: "TO-001",
  logoDataUrl: "",
  milestone: "Invoice 1 of 4",
  paymentMethod: "Zelle Transfer",
  paymentRecipient: "kfoust1012@gmail.com",
  projectSubtitle: "Milestone 1 of 4",
  projectTitle: "TorqueOps - Phase 1\nCustom Software Development",
  showFooter: true,
  showFooterLogo: true,
  showSwooshes: true,
  showLogo: true,
  thankYou: "This invoice is for Milestone 1 of 4 for the development of TorqueOps. Payment is due upon receipt.",
  terms: "Due upon receipt of invoice."
};

const initialItems: InvoiceLineItem[] = [
  {
    amount: "1250",
    icon: "⌕",
    note: "Requirements gathering, business analysis, and workflow documentation.",
    quantity: "1",
    rate: "1250",
    title: "Project discovery and workflow mapping"
  },
  {
    amount: "1250",
    icon: "▭",
    note: "User experience planning, screen flow design, and system architecture.",
    quantity: "1",
    rate: "1250",
    title: "UI/UX planning and system structure"
  },
  {
    amount: "500",
    icon: "⚙",
    note: "Development tools, subscriptions, and API usage required to build and iterate the platform.",
    quantity: "1",
    rate: "500",
    title: "Development software, tooling, and API usage"
  }
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(Number.isFinite(value) ? value : 0);
}

function parseMoney(value: string) {
  const normalized = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(normalized) ? normalized : 0;
}

function calculateLineAmount(item: InvoiceLineItem) {
  const manualAmount = parseMoney(item.amount);

  if (manualAmount > 0) {
    return manualAmount;
  }

  return parseMoney(item.quantity) * parseMoney(item.rate);
}

function splitLines(value: string) {
  return value.split(/\r?\n/).filter(Boolean);
}

function getBrandLabel(draft: InvoiceDraft) {
  return `${draft.brandName}${draft.brandAccent}`.trim() || "TorqueOps";
}

function getDefaultDraftName(draft: InvoiceDraft) {
  return [draft.invoiceNumber, draft.billToBusiness].filter(Boolean).join(" - ") || "Invoice draft";
}

function readSavedDrafts() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(savedDraftsStorageKey);
    return storedValue ? (JSON.parse(storedValue) as SavedInvoiceDraft[]) : [];
  } catch {
    return [];
  }
}

function writeSavedDrafts(savedDrafts: SavedInvoiceDraft[]) {
  window.localStorage.setItem(savedDraftsStorageKey, JSON.stringify(savedDrafts));
}

export function InvoiceBuilder() {
  const [draft, setDraft] = useState<InvoiceDraft>(initialDraft);
  const [draftName, setDraftName] = useState(getDefaultDraftName(initialDraft));
  const [items, setItems] = useState<InvoiceLineItem[]>(initialItems);
  const [savedDraftId, setSavedDraftId] = useState("");
  const [savedDrafts, setSavedDrafts] = useState<SavedInvoiceDraft[]>([]);
  const [saveStatus, setSaveStatus] = useState("");
  const invoiceRef = useRef<HTMLElement>(null);
  const previewWrapRef = useRef<HTMLElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  const subtotal = useMemo(() => items.reduce((total, item) => total + calculateLineAmount(item), 0), [items]);

  useEffect(() => {
    const drafts = readSavedDrafts();
    setSavedDrafts(drafts);
  }, []);

  useEffect(() => {
    const previewWrap = previewWrapRef.current;

    if (!previewWrap || typeof ResizeObserver === "undefined") {
      return;
    }

    const updatePreviewScale = () => {
      const availableWidth = previewWrap.clientWidth - invoicePreviewPadding;
      const nextScale = Math.min(1, Math.max(0.62, availableWidth / invoicePreviewWidth));
      setPreviewScale(Number(nextScale.toFixed(3)));
    };

    updatePreviewScale();
    const resizeObserver = new ResizeObserver(updatePreviewScale);
    resizeObserver.observe(previewWrap);

    return () => resizeObserver.disconnect();
  }, []);

  function updateDraft<Key extends keyof InvoiceDraft>(key: Key, value: InvoiceDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateItem(index: number, updates: Partial<InvoiceLineItem>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...updates } : item)));
  }

  function addItem() {
    setItems((current) => [
      ...current,
      {
        amount: "",
        icon: "▣",
        note: "",
        quantity: "1",
        rate: "0",
        title: "New invoice line"
      }
    ]);
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function resetDraft() {
    setDraft(initialDraft);
    setItems(initialItems);
    setDraftName(getDefaultDraftName(initialDraft));
    setSavedDraftId("");
    setSaveStatus("");
  }

  function saveCurrentDraft() {
    const id = savedDraftId || crypto.randomUUID();
    const savedAt = new Date().toISOString();
    const nextDraft: SavedInvoiceDraft = {
      draft,
      id,
      items,
      name: draftName.trim() || getDefaultDraftName(draft),
      savedAt
    };
    const nextDrafts = [nextDraft, ...savedDrafts.filter((savedDraft) => savedDraft.id !== id)];

    writeSavedDrafts(nextDrafts);
    setSavedDraftId(id);
    setSavedDrafts(nextDrafts);
    setDraftName(nextDraft.name);
    setSaveStatus(`Saved ${nextDraft.name}`);
  }

  function loadSavedDraft(id: string) {
    const savedDraft = savedDrafts.find((candidate) => candidate.id === id);

    if (!savedDraft) {
      setSavedDraftId("");
      return;
    }

    setDraft(savedDraft.draft);
    setItems(savedDraft.items);
    setDraftName(savedDraft.name);
    setSavedDraftId(savedDraft.id);
    setSaveStatus(`Loaded ${savedDraft.name}`);
  }

  function deleteSavedDraft() {
    if (!savedDraftId) {
      return;
    }

    const deletedDraft = savedDrafts.find((candidate) => candidate.id === savedDraftId);
    const nextDrafts = savedDrafts.filter((candidate) => candidate.id !== savedDraftId);

    writeSavedDrafts(nextDrafts);
    setSavedDrafts(nextDrafts);
    setSavedDraftId("");
    setSaveStatus(deletedDraft ? `Deleted ${deletedDraft.name}` : "Draft deleted");
  }

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      updateDraft("logoDataUrl", result);
      updateDraft("showLogo", true);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function removeLogo() {
    updateDraft("logoDataUrl", "");
    updateDraft("showLogo", false);
  }

  function openEmailDraft() {
    const itemSummary = items
      .map((item) => {
        const amount = calculateLineAmount(item);

        return `- ${item.title}: ${item.quantity} x ${formatCurrency(parseMoney(item.rate))} = ${formatCurrency(amount)}${
          item.note ? `\n  ${item.note}` : ""
        }`;
      })
      .join("\n");
    const subject = `${draft.invoiceNumber} - ${getBrandLabel(draft)} invoice`;
    const body = [
      `Hi ${draft.billToContact.replace(/\[[^\]]+\]/g, "").trim() || draft.billToBusiness},`,
      "",
      `Attached/outlined below is ${draft.invoiceNumber} for ${draft.projectTitle.replace(/\s+/g, " ").trim()}.`,
      "",
      itemSummary,
      "",
      `Total due: ${formatCurrency(subtotal)}`,
      `Due date: ${draft.dueDate}`,
      "",
      `Payment method: ${draft.paymentMethod}`,
      `Payment recipient: ${draft.paymentRecipient}`,
      "",
      draft.terms,
      "",
      "Thank you,",
      "Kyle Foust"
    ].join("\n");
    const params = new URLSearchParams({
      body,
      subject
    });

    window.location.href = `mailto:${encodeURIComponent(draft.billToEmail)}?${params.toString()}`;
  }

  function printInvoice() {
    const invoiceElement = invoiceRef.current;

    if (!invoiceElement) {
      window.print();
      return;
    }

    const styleText = Array.from(document.styleSheets)
      .map((styleSheet) => {
        try {
          return Array.from(styleSheet.cssRules)
            .map((rule) => rule.cssText)
            .join("\n");
        } catch {
          return "";
        }
      })
      .join("\n");

    const printFrame = document.createElement("iframe");
    printFrame.setAttribute("aria-hidden", "true");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    document.body.appendChild(printFrame);

    const printDocument = printFrame.contentDocument;
    const printWindow = printFrame.contentWindow;

    if (!printDocument || !printWindow) {
      printFrame.remove();
      window.print();
      return;
    }

    printDocument.open();
    printDocument.write(`<!doctype html>
<html>
  <head>
    <title>${draft.invoiceNumber} invoice</title>
    <style>${styleText}</style>
    <style>
      @page { size: letter portrait; margin: 0; }
      html, body {
        width: 8.5in;
        height: 11in;
        margin: 0 !important;
        overflow: hidden !important;
        background: white !important;
        print-color-adjust: exact !important;
        -webkit-print-color-adjust: exact !important;
      }
      body {
        display: block;
      }
      body * {
        visibility: visible !important;
        print-color-adjust: exact !important;
        -webkit-print-color-adjust: exact !important;
      }
      .print-sheet {
        width: 8.5in;
        height: 11in;
        overflow: hidden;
        background: white;
      }
      main {
        position: static !important;
        width: 850px !important;
        min-height: 1100px !important;
        margin: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        transform: scale(0.96);
        transform-origin: top left;
        zoom: 1 !important;
      }
      @media print {
        html, body {
          width: 8.5in;
          height: 11in;
          margin: 0 !important;
          overflow: hidden !important;
          background: white !important;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }
        body * {
          visibility: visible !important;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }
        .print-sheet {
          width: 8.5in;
          height: 11in;
          overflow: hidden;
        }
        main {
          position: static !important;
          width: 850px !important;
          min-height: 1100px !important;
          margin: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          transform: scale(0.96);
          transform-origin: top left;
          zoom: 1 !important;
          break-after: avoid;
          page-break-after: avoid;
        }
      }
    </style>
  </head>
  <body><div class="print-sheet">${invoiceElement.outerHTML}</div></body>
</html>`);
    printDocument.close();
    printWindow.onafterprint = () => printFrame.remove();
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
    window.setTimeout(() => printFrame.remove(), 60000);
  }

  return (
    <div className={styles.builderShell}>
      <form className={styles.controls} onSubmit={(event) => event.preventDefault()}>
        <div className={styles.controlsHeader}>
          <div>
            <p className={styles.eyebrow}>Invoice details</p>
            <h2>Quick create</h2>
          </div>
          <div className={styles.controlActions}>
            <button className={buttonClassName({ size: "sm", tone: "secondary" })} onClick={resetDraft} type="button">
              <span aria-hidden>↺</span>
              Reset
            </button>
            <button className={buttonClassName({ size: "sm", tone: "secondary" })} onClick={openEmailDraft} type="button">
              <span aria-hidden>✉</span>
              Email draft
            </button>
            <button className={buttonClassName({ size: "sm", tone: "primary" })} onClick={printInvoice} type="button">
              <span aria-hidden>⎙</span>
              Print / PDF
            </button>
          </div>
        </div>

        <section className={styles.formGrid} aria-label="Saved invoice drafts">
          <div className={styles.brandControls}>
            <div>
              <p className={styles.eyebrow}>Saved drafts</p>
              <h3>{savedDrafts.length ? `${savedDrafts.length} saved` : "No saved drafts"}</h3>
            </div>
            {saveStatus ? <span>{saveStatus}</span> : null}
          </div>

          <label>
            Draft name
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
          </label>

          <label>
            Load draft
            <select value={savedDraftId} onChange={(event) => loadSavedDraft(event.target.value)}>
              <option value="">Select a saved draft</option>
              {savedDrafts.map((savedDraft) => (
                <option key={savedDraft.id} value={savedDraft.id}>
                  {savedDraft.name}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.brandControls}>
            <button className={buttonClassName({ size: "sm", tone: "secondary" })} onClick={saveCurrentDraft} type="button">
              <span aria-hidden>▣</span>
              Save draft
            </button>
            <button
              className={buttonClassName({ size: "sm", tone: "tertiary" })}
              disabled={!savedDraftId}
              onClick={deleteSavedDraft}
              type="button"
            >
              <span aria-hidden>×</span>
              Delete
            </button>
          </div>
        </section>

        <div className={styles.formGrid}>
          <label>
            Invoice #
            <input value={draft.invoiceNumber} onChange={(event) => updateDraft("invoiceNumber", event.target.value)} />
          </label>
          <label>
            Date
            <input value={draft.invoiceDate} onChange={(event) => updateDraft("invoiceDate", event.target.value)} />
          </label>
          <label>
            Due date
            <input value={draft.dueDate} onChange={(event) => updateDraft("dueDate", event.target.value)} />
          </label>
          <label>
            Milestone
            <input value={draft.milestone} onChange={(event) => updateDraft("milestone", event.target.value)} />
          </label>
        </div>

        <div className={styles.formGrid}>
          <label>
            Brand name
            <input value={draft.brandName} onChange={(event) => updateDraft("brandName", event.target.value)} />
          </label>
          <label>
            Accent text
            <input value={draft.brandAccent} onChange={(event) => updateDraft("brandAccent", event.target.value)} />
          </label>
          <label className={styles.wideField}>
            Tagline
            <input value={draft.brandTagline} onChange={(event) => updateDraft("brandTagline", event.target.value)} />
          </label>
          <div className={styles.brandControls}>
            <label className={cx(styles.logoUpload, buttonClassName({ size: "sm", tone: "secondary" }))}>
              <span aria-hidden>↑</span>
              Upload logo
              <input accept="image/*" type="file" onChange={handleLogoChange} />
            </label>
            <label className={styles.checkboxControl}>
              <input
                checked={draft.showLogo}
                type="checkbox"
                onChange={(event) => updateDraft("showLogo", event.target.checked)}
              />
              Show logo mark
            </label>
            <button className={buttonClassName({ size: "sm", tone: "tertiary" })} onClick={removeLogo} type="button">
              <span aria-hidden>⊘</span>
              Remove
            </button>
          </div>
        </div>

        <div className={styles.formGrid}>
          <label>
            Accent color
            <input
              className={styles.colorInput}
              type="color"
              value={draft.colorAccent}
              onChange={(event) => updateDraft("colorAccent", event.target.value)}
            />
          </label>
          <label>
            Dark color
            <input
              className={styles.colorInput}
              type="color"
              value={draft.colorDark}
              onChange={(event) => updateDraft("colorDark", event.target.value)}
            />
          </label>
          <label>
            Silver color
            <input
              className={styles.colorInput}
              type="color"
              value={draft.colorSilver}
              onChange={(event) => updateDraft("colorSilver", event.target.value)}
            />
          </label>
          <div className={styles.brandControls}>
            <label className={styles.checkboxControl}>
              <input
                checked={draft.showSwooshes}
                type="checkbox"
                onChange={(event) => updateDraft("showSwooshes", event.target.checked)}
              />
              Show swooshes
            </label>
            <label className={styles.checkboxControl}>
              <input
                checked={draft.showFooter}
                type="checkbox"
                onChange={(event) => updateDraft("showFooter", event.target.checked)}
              />
              Show footer
            </label>
            <label className={styles.checkboxControl}>
              <input
                checked={draft.showFooterLogo}
                type="checkbox"
                onChange={(event) => updateDraft("showFooterLogo", event.target.checked)}
              />
              Footer logo
            </label>
          </div>
          <label className={styles.wideField}>
            Footer message
            <input value={draft.footerMessage} onChange={(event) => updateDraft("footerMessage", event.target.value)} />
          </label>
        </div>

        <div className={styles.formGrid}>
          <label>
            Bill-to contact
            <input value={draft.billToContact} onChange={(event) => updateDraft("billToContact", event.target.value)} />
          </label>
          <label>
            Business
            <input value={draft.billToBusiness} onChange={(event) => updateDraft("billToBusiness", event.target.value)} />
          </label>
          <label>
            Street
            <input value={draft.billToStreet} onChange={(event) => updateDraft("billToStreet", event.target.value)} />
          </label>
          <label>
            City / state / ZIP
            <input value={draft.billToCityStateZip} onChange={(event) => updateDraft("billToCityStateZip", event.target.value)} />
          </label>
          <label className={styles.wideField}>
            Email
            <input value={draft.billToEmail} onChange={(event) => updateDraft("billToEmail", event.target.value)} />
          </label>
        </div>

        <div className={styles.formGrid}>
          <label className={styles.wideField}>
            Project title
            <textarea rows={2} value={draft.projectTitle} onChange={(event) => updateDraft("projectTitle", event.target.value)} />
          </label>
          <label>
            Project subtitle
            <input value={draft.projectSubtitle} onChange={(event) => updateDraft("projectSubtitle", event.target.value)} />
          </label>
          <label>
            Payment method
            <input value={draft.paymentMethod} onChange={(event) => updateDraft("paymentMethod", event.target.value)} />
          </label>
          <label>
            Payment recipient
            <input value={draft.paymentRecipient} onChange={(event) => updateDraft("paymentRecipient", event.target.value)} />
          </label>
          <label className={styles.wideField}>
            Thank-you note
            <textarea rows={2} value={draft.thankYou} onChange={(event) => updateDraft("thankYou", event.target.value)} />
          </label>
          <label className={styles.wideField}>
            Payment terms
            <input value={draft.terms} onChange={(event) => updateDraft("terms", event.target.value)} />
          </label>
        </div>

        <section className={styles.lineEditor} aria-label="Invoice line editor">
          <div className={styles.lineEditorHeader}>
            <div>
              <p className={styles.eyebrow}>Line items</p>
              <h3>{formatCurrency(subtotal)} total</h3>
            </div>
            <button className={buttonClassName({ size: "sm", tone: "secondary" })} onClick={addItem} type="button">
              <span aria-hidden>+</span>
              Add line
            </button>
          </div>

          {items.map((item, index) => (
            <div className={styles.lineItemEditor} key={index}>
              <label>
                Icon
                <input value={item.icon} onChange={(event) => updateItem(index, { icon: event.target.value })} />
              </label>
              <label className={styles.lineTitleField}>
                Title
                <input value={item.title} onChange={(event) => updateItem(index, { title: event.target.value })} />
              </label>
              <label>
                Qty
                <input value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} />
              </label>
              <label>
                Rate
                <input value={item.rate} onChange={(event) => updateItem(index, { rate: event.target.value, amount: "" })} />
              </label>
              <label>
                Amount
                <input value={item.amount} onChange={(event) => updateItem(index, { amount: event.target.value })} />
              </label>
              <label className={styles.lineNoteField}>
                Note
                <textarea rows={2} value={item.note} onChange={(event) => updateItem(index, { note: event.target.value })} />
              </label>
              <button
                aria-label={`Remove ${item.title}`}
                className={cx(buttonClassName({ size: "sm", tone: "tertiary" }), styles.removeLineButton)}
                disabled={items.length === 1}
                onClick={() => removeItem(index)}
                type="button"
              >
                <span aria-hidden>×</span>
              </button>
            </div>
          ))}
        </section>
      </form>

      <section
        ref={previewWrapRef}
        className={styles.previewWrap}
        style={{ "--invoice-preview-scale": previewScale } as CSSProperties}
        aria-label="Invoice preview"
      >
        <main
          ref={invoiceRef}
          className={styles.invoicePage}
          style={
            {
              "--invoice-accent": draft.colorAccent,
              "--invoice-dark": draft.colorDark,
              "--invoice-silver": draft.colorSilver
            } as CSSProperties
          }
        >
          <header className={styles.topBand}>
            {draft.showSwooshes ? (
              <>
                <div className={styles.topSwooshOrange}></div>
                <div className={styles.topSwooshSilver}></div>
              </>
            ) : null}

            <div className={styles.brandRow}>
              {draft.showLogo ? (
                draft.logoDataUrl ? (
                  <img className={styles.uploadedBrandLogo} alt={`${getBrandLabel(draft)} logo`} src={draft.logoDataUrl} />
                ) : (
                  <div className={styles.brandLogo} aria-label={`${getBrandLabel(draft)} logo`}>
                    <span>{getBrandLabel(draft).charAt(0).toUpperCase()}</span>
                  </div>
                )
              ) : null}
              <div>
                <div className={styles.brandWordmark}>
                  <span className={styles.torque}>{draft.brandName}</span>
                  <span className={styles.ops}>{draft.brandAccent}</span>
                </div>
                <div className={styles.brandTagline}>{draft.brandTagline}</div>
              </div>
            </div>

            <div className={styles.invoiceTitle}>
              <div className={styles.label}>INVOICE</div>
              <div className={styles.number}>{draft.invoiceNumber}</div>
            </div>
          </header>

          <section className={styles.content}>
            <section className={styles.topInfo}>
              <div className={styles.profile}>
                <div className={styles.roundIcon}>●</div>
                <div>
                  <div className={styles.name}>Kyle Foust</div>
                  <div className={styles.role}>Software Development &amp; Consulting</div>
                  <div className={styles.contactRow}>
                    <span className={styles.contactDot}>✉</span> kfoust1012@gmail.com
                  </div>
                  <div className={styles.contactRow}>
                    <span className={styles.contactDot}>☎</span> 214-930-4538
                  </div>
                  <div className={styles.contactRow}>
                    <span className={styles.contactDot}>⌖</span> Dallas, Texas
                  </div>
                </div>
              </div>

              <div className={styles.invoiceMeta}>
                <div className={styles.metaLabel}>Invoice #:</div>
                <div>{draft.invoiceNumber}</div>
                <div className={styles.metaLabel}>Date:</div>
                <div>{draft.invoiceDate}</div>
                <div className={styles.metaLabel}>Due Date:</div>
                <div>{draft.dueDate}</div>
                <div></div>
                <div>
                  <span className={styles.milestone}>{draft.milestone}</span>
                </div>
              </div>
            </section>

            <div className={styles.divider}></div>

            <section className={styles.projectRow}>
              <div className={styles.billTo}>
                <div className={styles.billIcon}>▥</div>
                <div>
                  <div className={styles.sectionLabel}>Bill To:</div>
                  <div className={styles.billName}>{draft.billToBusiness}</div>
                  <div className={styles.placeholderLine}>{draft.billToContact}</div>
                  <div className={styles.placeholderLine}>{draft.billToBusiness}</div>
                  <div className={styles.placeholderLine}>{draft.billToStreet}</div>
                  <div className={styles.placeholderLine}>{draft.billToCityStateZip}</div>
                  <div className={styles.placeholderLine}>{draft.billToEmail}</div>
                </div>
              </div>

              <div>
                <div className={styles.projectTitle}>
                  {splitLines(draft.projectTitle).map((line) => (
                    <span key={line}>
                      {line}
                      <br />
                    </span>
                  ))}
                </div>
                <div className={styles.projectSub}>{draft.projectSubtitle}</div>
              </div>
            </section>

            <table className={styles.invoiceTable} aria-label="Invoice line items">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className={styles.qty}>Qty</th>
                  <th className={styles.rate}>Rate</th>
                  <th className={styles.amount}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const amount = calculateLineAmount(item);

                  return (
                    <tr key={`${item.title}-${index}`}>
                      <td>
                        <div className={styles.descCell}>
                          <div className={styles.lineIcon}>{item.icon}</div>
                          <div>
                            <div className={styles.itemTitle}>{item.title}</div>
                            <div className={styles.itemNote}>{item.note}</div>
                          </div>
                        </div>
                      </td>
                      <td className={styles.qty}>{item.quantity}</td>
                      <td className={styles.rate}>{formatCurrency(parseMoney(item.rate))}</td>
                      <td className={styles.amount}>
                        <strong>{formatCurrency(amount)}</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <section className={styles.lower}>
              <div>
                <div className={styles.thankyou}>
                  <strong>Thank you for your business!</strong>
                  <p>{draft.thankYou}</p>
                </div>

                <div className={styles.paymentCard}>
                  <div className={styles.moneyIcon}>$</div>
                  <div>
                    <div className={styles.cardLabel}>Payment Method</div>
                    <div className={styles.cardMain}>{draft.paymentMethod}</div>
                    <div className={styles.cardLabel}>Payment Recipient</div>
                    <div className={styles.cardValue}>{draft.paymentRecipient}</div>
                  </div>
                </div>
              </div>

              <div className={styles.verticalLine}></div>

              <div className={styles.totals}>
                <div className={styles.totalRow}>
                  <div className={styles.totalLabel}>Subtotal</div>
                  <div className={styles.totalValue}>{formatCurrency(subtotal)}</div>
                </div>
                <div className={cx(styles.totalRow, styles.grandTotal)}>
                  <div className={styles.totalLabel}>Total Due</div>
                  <div className={styles.totalValue}>{formatCurrency(subtotal)}</div>
                </div>

                <div className={styles.termsCard}>
                  <div className={styles.calendarIcon}>▣</div>
                  <div>
                    <div className={styles.cardLabel}>Payment Terms</div>
                    <div>{draft.terms}</div>
                  </div>
                </div>
              </div>
            </section>
          </section>

          {draft.showFooter ? (
            <footer className={styles.footerBand}>
              {draft.showSwooshes ? (
                <>
                  <div className={styles.bottomSwooshOrange}></div>
                  <div className={styles.bottomSwooshSilver}></div>
                </>
              ) : null}

              <div className={styles.footerBrand}>
                {draft.showFooterLogo && draft.showLogo ? (
                  draft.logoDataUrl ? (
                    <img className={styles.uploadedFooterLogo} alt={`${getBrandLabel(draft)} logo`} src={draft.logoDataUrl} />
                  ) : (
                    <div className={styles.footerMiniLogo}>
                      <span>{getBrandLabel(draft).charAt(0).toUpperCase()}</span>
                    </div>
                  )
                ) : null}
                <div>
                  <span>{draft.brandName}</span>
                  <span className={styles.footerOps}>{draft.brandAccent}</span>
                </div>
              </div>
              <div className={styles.footerMessage}>
                <strong>{draft.footerMessage}</strong>
                <br />
                {draft.brandTagline}
              </div>
            </footer>
          ) : null}
        </main>
      </section>
    </div>
  );
}
