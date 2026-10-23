export async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("Connection unavailable. Please try again.");
  }
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body as T;
}
export const money = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    value / 100,
  );
export const categories = ["GLP Series", "Single Peptides", "Peptide Blends"];
export const statusLabel = (status: string) =>
  ({
    待付款: "Awaiting payment",
    待发货: "Processing",
    已发货: "Shipped",
    已完成: "Completed",
    已取消: "Cancelled",
    退款申请中: "Refund requested",
    已退款: "Refunded",
  })[status] || status;
