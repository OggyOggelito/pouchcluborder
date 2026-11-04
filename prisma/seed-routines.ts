/**
 * One example routine article, explaining how to write the real ones.
 *
 * Deliberately not a routine: no procedures, no legal, compliance, age-check,
 * tobacco or nicotine-rule text, and nothing about brands. Pouch Club writes
 * those; this codebase has no business guessing at them.
 *
 * No categories are seeded either, for the same reason — the taxonomy is
 * theirs to decide at /admin/routines.
 *
 * Idempotent: skips the article if one with that title already exists.
 */
import { prisma } from "../src/lib/db";
import { EXAMPLE_ARTICLE_TITLE, articleSlug } from "../src/lib/knowledge";

const BODY = `**EXEMPEL.** Den här artikeln finns bara för att visa hur sidan fungerar.
Ta bort den när ni har skrivit era egna rutiner.

## Så skriver du en rutin

Gå till \`/admin/routines\` och välj **Ny artikel**. En rutin består av tre delar:

1. En **rubrik** som är det någon skulle söka efter — "Stängning", "Kassan strular",
   "Så beställer vi".
2. En **kategori**, så den hamnar under rätt chip på personalsidan. Kategorierna
   läggs upp längst ned på översikten.
3. **Innehållet**, som skrivs i Markdown.

## Markdown i korthet

| Det här | Blir det här |
| --- | --- |
| \`## Rubrik\` | en underrubrik |
| \`**fet**\` | **fet** text |
| \`- punkt\` | en punktlista |
| \`1. steg\` | en numrerad lista |
| \`[text](/news)\` | en länk till en annan sida i appen |

Tabeller, listor och länkar renderas likadant här som i varumärkesguiden.

## Innan du publicerar

- Tryck **Förhandsgranska** och läs igenom den som om du var ny på jobbet.
- Lämna **Publicerad** avbockad så länge den är ett utkast — då syns den bara
  för administratörer.
- Skriv inga personuppgifter: varken om kunder eller om kollegor.

## Bra att veta

Adressen till en artikel sätts när den skapas och ändras inte om du byter
rubrik, så länkar till den fortsätter fungera. Sidan är gjord för att skrivas
ut — menyer och länkar följer inte med på papperet.
`;

async function main() {
  const existing = await prisma.knowledgeArticle.findFirst({
    where: { title: EXAMPLE_ARTICLE_TITLE },
    select: { id: true },
  });

  if (existing) {
    console.log(`Example article already present (${existing.id}) — nothing to do.`);
    return;
  }

  const article = await prisma.knowledgeArticle.create({
    data: {
      title: EXAMPLE_ARTICLE_TITLE,
      slug: articleSlug(EXAMPLE_ARTICLE_TITLE),
      body: BODY,
      category: null,
      // Published, because the point of it is to be read by whoever opens the
      // page first. It says in its first line that it should be deleted.
      published: true,
    },
    select: { id: true, slug: true },
  });

  console.log(`Created example article /staff/routines/${article.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
