import "server-only";
import { REQUIRED_TYPES, labelFor } from "./doc-types";

/**
 * Labels of required documents the employee hasn't uploaded yet (empty array = all done).
 * Call it from the setup "finish" action:  const missing = await missingRequiredDocs(sb, user.id);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function missingRequiredDocs(sb: { from: (t: string) => any }, employeeId: string): Promise<string[]> {
  const { data } = await sb.from("employee_documents").select("doc_type").eq("employee_id", employeeId);
  const have = new Set<string>(((data ?? []) as { doc_type: string }[]).map((d) => d.doc_type));
  return REQUIRED_TYPES.filter((k) => !have.has(k)).map(labelFor);
}
