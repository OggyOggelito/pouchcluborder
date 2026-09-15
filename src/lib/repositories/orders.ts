import { prisma } from "@/lib/db";

export type OrderLineDraft = {
  productId: string;
  quantity: number;
};

export type OrderLineDetail = {
  productId: string;
  brand: string;
  flavor: string;
  strength: string;
  format: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderDetail = {
  id: string;
  submittedAt: Date;
  note: string | null;
  store: { id: string; name: string; slug: string };
  lines: OrderLineDetail[];
  totalQuantity: number;
  totalSek: number;
};

export type OrderSummary = {
  id: string;
  submittedAt: Date;
  totalQuantity: number;
  totalSek: number;
  lineCount: number;
};

export class OrderValidationError extends Error {}

/**
 * Persists an order and its lines in one transaction, pricing each line from the
 * catalog at submit time rather than trusting anything sent by the browser.
 */
export async function createOrder(input: {
  storeId: string;
  lines: OrderLineDraft[];
  note?: string | null;
}): Promise<{ id: string }> {
  const lines = input.lines.filter((line) => Number.isInteger(line.quantity) && line.quantity > 0);

  if (lines.length === 0) {
    throw new OrderValidationError("An order needs at least one product with a quantity above zero.");
  }

  return prisma.$transaction(async (tx) => {
    const store = await tx.store.findUnique({ where: { id: input.storeId }, select: { id: true } });
    if (!store) {
      throw new OrderValidationError("Unknown store.");
    }

    const products = await tx.product.findMany({
      where: { id: { in: lines.map((line) => line.productId) } },
      select: { id: true, pricePerStock: true },
    });
    const priceById = new Map(products.map((product) => [product.id, product.pricePerStock]));

    const missing = lines.filter((line) => !priceById.has(line.productId));
    if (missing.length > 0) {
      throw new OrderValidationError(
        `${missing.length} product(s) in this order no longer exist in the catalog.`
      );
    }

    const order = await tx.order.create({
      data: {
        storeId: store.id,
        note: input.note?.trim() || null,
        lines: {
          create: lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: priceById.get(line.productId)!,
          })),
        },
      },
      select: { id: true },
    });

    return order;
  });
}

export async function getOrder(id: string): Promise<OrderDetail | null> {
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      submittedAt: true,
      note: true,
      store: { select: { id: true, name: true, slug: true } },
      lines: {
        select: {
          productId: true,
          quantity: true,
          unitPrice: true,
          product: {
            select: { brand: true, flavor: true, strength: true, format: true },
          },
        },
      },
    },
  });

  if (!order) return null;

  const lines: OrderLineDetail[] = order.lines
    .map((line) => ({
      productId: line.productId,
      brand: line.product.brand,
      flavor: line.product.flavor,
      strength: line.product.strength,
      format: line.product.format,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: round2(line.quantity * line.unitPrice),
    }))
    .sort(
      (a, b) =>
        a.brand.localeCompare(b.brand, "sv") ||
        a.flavor.localeCompare(b.flavor, "sv") ||
        a.strength.localeCompare(b.strength, "sv") ||
        a.format.localeCompare(b.format, "sv")
    );

  return {
    id: order.id,
    submittedAt: order.submittedAt,
    note: order.note,
    store: order.store,
    lines,
    totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    totalSek: round2(lines.reduce((sum, line) => sum + line.lineTotal, 0)),
  };
}

export async function listOrdersForStore(storeId: string, limit = 50): Promise<OrderSummary[]> {
  const orders = await prisma.order.findMany({
    where: { storeId },
    orderBy: { submittedAt: "desc" },
    take: limit,
    select: {
      id: true,
      submittedAt: true,
      lines: { select: { quantity: true, unitPrice: true } },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    submittedAt: order.submittedAt,
    lineCount: order.lines.length,
    totalQuantity: order.lines.reduce((sum, line) => sum + line.quantity, 0),
    totalSek: round2(order.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)),
  }));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
