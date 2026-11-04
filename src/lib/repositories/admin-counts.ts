import { prisma } from "@/lib/db";
import type { AdminEntry } from "@/config/navigation";

/**
 * The "behöver åtgärd" numbers on the admin hub.
 *
 * Every one of these is something an admin can actually do something about.
 * The brief also asked for "orders to confirm", "delivery discrepancies" and
 * "catalog previews waiting" — none of those exist in this app: `Order` has no
 * status column, there is no goods-receiving feature, and the importer applies
 * directly with no preview queue. They are left out rather than faked.
 */
export type AdminCounts = {
  openIssues: number;
  newRequests: number;
  openTransfers: number;
  needsReview: number;
  draftContent: number;
};

export const EMPTY_COUNTS: AdminCounts = {
  openIssues: 0,
  newRequests: 0,
  openTransfers: 0,
  needsReview: 0,
  draftContent: 0,
};

export async function getAdminCounts(): Promise<AdminCounts> {
  try {
    const [openIssues, newRequests, openTransfers, needsReview, draftContent] = await Promise.all([
      prisma.issueReport.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] } } }),
      prisma.customerRequest.count({ where: { status: "NEW" } }),
      prisma.stockTransfer.count({ where: { status: { in: ["REQUESTED", "ACCEPTED", "SENT"] } } }),
      prisma.product.count({ where: { needsReview: true, active: true } }),
      prisma.brand.count({ where: { published: false } }),
    ]);

    return { openIssues, newRequests, openTransfers, needsReview, draftContent };
  } catch {
    // A hub that renders without badges is better than a hub that does not
    // render.
    return EMPTY_COUNTS;
  }
}

export function countFor(entry: AdminEntry, counts: AdminCounts): number | null {
  if (!entry.actionCount) return null;
  return counts[entry.actionCount];
}
