"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createArticle,
  createCategory,
  deleteArticle,
  deleteCategory,
  getArticleById,
  updateArticle,
} from "@/lib/repositories/knowledge";
import { MAX_ARTICLE_TITLE_LENGTH } from "@/lib/knowledge";
import { requireAdmin } from "@/lib/session";

export type ArticleFormState = { error: string | null; savedAt: number | null };

/**
 * Creates or updates a routine article. ADMIN only.
 *
 * The slug is set once, when the article is created — see `uniqueSlug` in the
 * repository. Retitling a published routine keeps its URL, because that URL is
 * what a checklist or a note links to.
 */
export async function saveArticleAction(
  _state: ArticleFormState,
  formData: FormData
): Promise<ArticleFormState> {
  const user = await requireAdmin();

  const title = String(formData.get("title") ?? "").trim().slice(0, MAX_ARTICLE_TITLE_LENGTH);
  if (!title) return { error: "Artikeln behöver en rubrik.", savedAt: null };

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Skriv något i artikeln.", savedAt: null };

  const category = String(formData.get("category") ?? "").trim() || null;
  const published = formData.get("published") === "on";
  const id = String(formData.get("id") ?? "");

  if (id) {
    const existing = await getArticleById(id);
    if (!existing) return { error: "Okänd artikel.", savedAt: null };
    await updateArticle({ id, title, body, category, published, userId: user.id });
    revalidatePath("/admin/routines");
    revalidatePath("/staff/routines");
    revalidatePath(`/staff/routines/${existing.slug}`);
    return { error: null, savedAt: Date.now() };
  }

  const newId = await createArticle({ title, body, category, published, userId: user.id });
  revalidatePath("/admin/routines");
  revalidatePath("/staff/routines");
  redirect(`/admin/routines/${newId}`);
}

export async function deleteArticleAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await deleteArticle(id);
  revalidatePath("/admin/routines");
  revalidatePath("/staff/routines");
  redirect("/admin/routines");
}

export async function createCategoryAction(formData: FormData) {
  await requireAdmin();
  await createCategory(String(formData.get("name") ?? ""));
  revalidatePath("/admin/routines");
  revalidatePath("/staff/routines");
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await deleteCategory(id);
  revalidatePath("/admin/routines");
  revalidatePath("/staff/routines");
}
