/**
 * Writes the first brand pages for the staff guide.
 *
 * The text here is Pouch Club's own, written from factual sources: Skruf's
 * description of its production in Sävsjö (skruf.se/om-skruf/produktionen,
 * read 2026-09-19), manufacturer figures supplied by Oscar, and the strength
 * spread in our own catalog. No marketing copy from a brand or a competing
 * retailer is reproduced.
 *
 * Re-running overwrites these three brands' content, so edit at
 * /admin/brands/[id] instead once you have changed anything there.
 */
import { prisma } from "../src/lib/db";

type Content = {
  name: string;
  countryOfOrigin?: string;
  websiteUrl?: string;
  shortDescription: string;
  manufacturingProcess: string;
  blendingNotes: string;
};

const CONTENT: Content[] = [
  {
    name: "Skruf",
    countryOfOrigin: "Sverige",
    websiteUrl: "https://skruf.se",
    shortDescription:
      "Svensk tillverkare med egen fabrik i Sävsjö, som gör både tobakssnus och vita nikotinpåsar. Skruf är ett av få märken i vårt sortiment där hela tillverkningen sker i Sverige.",
    manufacturingProcess: `## Var det görs

Fabriken ligger i **Sävsjö i Småland** och går dygnet runt. Vattnet tas lokalt ur Vallsjön.

## Från blad till dosa

1. Tobaksbladen mals ner till ett fint pulver och lagras i silo
2. Pulvret blandas med salt och vatten
3. Blandningen **pastöriseras** — värmebehandlingen tar bort mikroorganismer och är samtidigt det som ger snuset mycket av sin karaktär
4. Massan kyls och smaksätts
5. Den får sedan mogna innan den packas

Råtobaken köps in från Indien, Filippinerna och Sydafrika.

## Brunt och vitt

Brun portion fuktas innan den packas. **Vit portion packas torr**, direkt i dosan — det är därför en vit portion rinner långsammare och håller smaken längre.

## Kontroll

Produktionen kontrolleras i flera steg, och vikt och mått stäms av löpande vid packningen.

*Källa: skruf.se, läst 2026-09-19.*`,
    blendingNotes: `## Styrkor i vårt sortiment

Skruf ligger brett: från **6 mg** upp till **17,1 mg per portion**.

Det gör att Skruf täcker både kunden som vill ha en mild vardagsprilla och den som vill ha något riktigt starkt — värt att komma ihåg när någon frågar efter "Skruf" utan att säga vilken.

## Format

Vi har Skruf som **lös**, **portion**, **slim** och **normal**. Lössnus och portion är tobakssnus; de vita påsarna är nikotinpåsar utan tobak.`,
  },
  {
    name: "Velo",
    countryOfOrigin: "Sverige",
    shortDescription:
      "Nikotinpåsar från BAT, med ett av marknadens bredaste utbud av smaker och styrkor. Lanserades i Sverige 2014 under namnet Epok, hette en period LYFT, och heter VELO sedan 2022 — kunder som frågar efter Epok eller LYFT menar oftast VELO.",
    manufacturingProcess: `## Vad påsen består av

VELO är **vitt snus utan tobak**. Basen är ett fyllnadsmedel av växtfiber (E460) i stället för malen tobak, och nikotinet tillsätts separat.

En typisk innehållsförteckning:

- Fyllnadsmedel (E460)
- Vatten
- Smakförstärkare (koksalt)
- Xylitol (E967)
- Nikotin
- Aromer
- Propylenglykol (E1520)
- Sötningsmedel (E955)
- Surhetsreglerande medel (E500)

## Format

Vi har VELO i både **normal** och **mini**. En dosa rymmer 20 påsar.`,
    blendingNotes: `## Styrkor i vårt sortiment

Från **0 mg** (nikotinfritt) upp till **17 mg per portion**: 0, 4, 6, 8, 10, 10,9, 14 och 17 mg.

VELO märker också styrka med **pluppar** på dosan i stället för siffror — en plupp är den mildaste. En mini på 4 mg/prilla motsvarar ungefär 8 mg/g, eftersom prillan väger mindre.

> Notera att VELO säljer både nikotinpåsar och nikotinfria påsar under samma namn. Kolla dosan innan du rekommenderar.

## Att tänka på i butik

Eftersom samma smak ofta finns i flera styrkor är det värt att fråga kunden om styrka, inte bara smak.`,
  },
  {
    name: "XQS",
    countryOfOrigin: "Sverige",
    shortDescription:
      "Nikotinpåsar från Jämtland, grundat 2005. Ett av de större svenska märkena av tobaksfritt snus, med tyngdpunkt på slim all-white-påsar.",
    manufacturingProcess: `## Påsen

XQS är **all-white slim portion** — en smal påse som ligger tunt under läppen.

Två saker som är värda att nämna för kunden: all-white-prillan missfärgar inte
tänderna, och dosan tål rumstemperatur, så den behöver ingen kyl i lager eller hylla.

En dosa rymmer **20 påsar**.

## Innehåll

- Fyllnadsmedel (E460)
- Destillerat vatten
- Nikotin
- Aromer
- Salt
- Propylenglykol (E1520)
- Surhetsreglerande medel (E500)
- Sötningsmedel (E955)`,
    blendingNotes: `## Styrkor i vårt sortiment

XQS finns i **nio olika styrkor** hos oss: 0, 4, 6, 8, 9,6, 10, 11, 11,2 och 17 mg per portion.

> **Säg inte att XQS är 8 mg.** En vanlig uppgift är att XQS ligger på 16 mg/g (8 mg/portion). Det stämmer för vissa varianter, men vi har XQS ända upp till 17 mg/portion. Läs alltid på dosan.

## Nikotinfritt

XQS finns även helt utan nikotin (0 mg) — de ligger under Nikotinfritt i listan.`,
  },
];

async function main() {
  for (const content of CONTENT) {
    const brand = await prisma.brand.findUnique({
      where: { name: content.name },
      select: { id: true, published: true },
    });

    if (!brand) {
      console.warn(`  ! no Brand row named "${content.name}" — skipped`);
      continue;
    }

    await prisma.brand.update({
      where: { id: brand.id },
      data: {
        countryOfOrigin: content.countryOfOrigin ?? null,
        websiteUrl: content.websiteUrl ?? null,
        shortDescription: content.shortDescription,
        manufacturingProcess: content.manufacturingProcess,
        blendingNotes: content.blendingNotes,
      },
    });
    console.log(`  + ${content.name}${brand.published ? "" : " (still a draft)"}`);
  }
  console.log(`\n${CONTENT.length} brand page(s) written. Review at /admin/brands.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
