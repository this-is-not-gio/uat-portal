import { AlertCircle, AlertTriangle, CheckCircle2, Info, Lightbulb, type LucideIcon } from "lucide-react";

// How each block type reads and renders: see the Manual CMS block types.
export const BLOCK_TYPES = [
    { value: "general", label: "Markdown" },
    { value: "header", label: "Header" },
    { value: "icon", label: "Icon callout" },
    { value: "table", label: "Table" },
    { value: "content", label: "Content Box" },
] as const;

export type blockType = (typeof BLOCK_TYPES)[number]["value"];

// Only Header blocks have a header. The other types sit under a Header block: the row stores the
// type's label (the column is required) and the page leaves them out of "On this page". A callout's
// title lives in its data (data.title), not in the header.
export const hasBlockHeader = (type: blockType) => type === "header";
export const defaultBlockHeader = (type: blockType) => BLOCK_TYPES.find((t) => t.value === type)?.label ?? "Content";

export const BLOCK_ICONS: Record<string, { label: string; icon: LucideIcon }> = {
    info: { label: "Info", icon: Info },
    alert: { label: "Alert", icon: AlertCircle },
    warning: { label: "Warning", icon: AlertTriangle },
    success: { label: "Success", icon: CheckCircle2 },
    tip: { label: "Tip", icon: Lightbulb },
};

export type tableData = { columns: string[]; rows: string[][] };

// Per-type fields stored in manual_blocks.data.
export type blockData = { icon?: string; title?: string } & Partial<tableData>;

export const emptyBlockData = (type: blockType): blockData =>
    type === "icon" ? { icon: "info", title: "" } : type === "table" ? { columns: ["Column 1", "Column 2"], rows: [["", ""]] } : {};

export function toTableData(data: blockData): tableData {
    const columns = Array.isArray(data.columns) ? data.columns : [];
    const rows = Array.isArray(data.rows) ? data.rows : [];
    return { columns, rows: rows.map((row) => columns.map((_, i) => row[i] ?? "")) };
}
