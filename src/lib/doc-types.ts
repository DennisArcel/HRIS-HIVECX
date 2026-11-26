// Shared by the server actions, the setup page and the admin pages. Safe to import anywhere.
export const BUCKET = "employee-docs";
export const MAX_MB = 5;
export const MAX_BYTES = MAX_MB * 1024 * 1024;
export const ALLOWED_EXT = ["pdf", "doc", "docx", "jpg", "jpeg", "png"];
export const ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png";

/** Lowercase file extension without the dot ("Resume.PDF" -> "pdf"). Empty string if there is none. */
export const IMG_EXT = ["jpg", "jpeg", "png"];
export const PREVIEW_EXT = ["pdf", ...IMG_EXT];
export const extOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

// Every document type the system accepts. Which ones are required is set in REQUIREMENTS below.
export const DOC_TYPES: { key: string; label: string }[] = [
  { key: "resume", label: "Resume / CV" },
  { key: "nbi", label: "NBI / Police clearance" },
  { key: "medical", label: "Medical" },
  { key: "sss", label: "SSS" },
  { key: "philhealth", label: "PhilHealth" },
  { key: "pagibig", label: "Pag-IBIG" },
  { key: "tin", label: "TIN" },
  { key: "valid_id", label: "Valid ID" },
  // Older types, kept so existing uploads still show a proper name.
  { key: "birth_cert", label: "Birth certificate" },
  { key: "diploma", label: "Diploma / Transcript" },
  { key: "contract", label: "Signed contract" },
  { key: "other", label: "Other" },
];

export type WorkerType = "employee" | "contractor";
export const WORKER_LABEL: Record<WorkerType, string> = { employee: "Employee", contractor: "Contractor" };

/** Accepts "employee", "contractor", "independent_contractor", null, etc. Anything unknown counts as employee. */
export const normalizeWorker = (v: unknown): WorkerType =>
  String(v ?? "").toLowerCase().includes("contract") ? "contractor" : "employee";

export const REQUIREMENTS: Record<WorkerType, { required: string[]; optional: string[] }> = {
  employee: {
    required: ["resume", "nbi", "medical", "sss", "philhealth", "pagibig", "tin"],
    optional: ["valid_id", "other"],
  },
  contractor: {
    required: ["resume", "nbi", "valid_id"],
    optional: ["medical", "other"], // Medical only if HR asks for it
  },
};

export const requirementsFor = (v: unknown) => REQUIREMENTS[normalizeWorker(v)];

/** Legacy export (employee list). Prefer requirementsFor(workerType). */
export const REQUIRED_TYPES = REQUIREMENTS.employee.required;

export const labelFor = (key: string) => DOC_TYPES.find((t) => t.key === key)?.label ?? key;
export const isDocType = (key: string) => DOC_TYPES.some((t) => t.key === key);