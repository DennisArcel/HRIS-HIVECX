// Shared by the server actions, the setup page and the admin pages. Safe to import anywhere.
export const BUCKET = "employee-docs";
export const MAX_MB = 5;
export const MAX_BYTES = MAX_MB * 1024 * 1024;
export const ALLOWED_EXT = ["pdf", "doc", "docx", "jpg", "jpeg", "png"];
export const ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png";

// Add, remove or rename document types here. required: true means setup can't be finished without it.
export const DOC_TYPES: { key: string; label: string; required: boolean }[] = [
  { key: "resume", label: "Resume / CV", required: true },
  { key: "valid_id", label: "Valid government ID", required: false },
  { key: "nbi", label: "NBI / Police clearance", required: false },
  { key: "birth_cert", label: "Birth certificate", required: false },
  { key: "diploma", label: "Diploma / Transcript", required: false },
  { key: "contract", label: "Signed contract", required: false },
  { key: "other", label: "Other", required: false },
];

export const REQUIRED_TYPES = DOC_TYPES.filter((t) => t.required).map((t) => t.key);
export const labelFor = (key: string) => DOC_TYPES.find((t) => t.key === key)?.label ?? key;
export const isDocType = (key: string) => DOC_TYPES.some((t) => t.key === key);
