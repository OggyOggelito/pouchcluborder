/**
 * Writes the first brand pages for the staff guide.
 *
 * The text here is Pouch Club's own, written from factual sources: the brands'
 * own product and production pages (skruf.se, x-allwhite.se, zonepouch.se, read
 * 2026-09-19), manufacturer figures, and the strength spread in our own catalog.
 * No marketing copy from a brand or a competing retailer is reproduced.
 *
 * Knox, X, ZONE and Smålands Brukssnus all come out of Skruf's plant, so each
 * points back at the Skruf page for the production detail rather than repeating
 * it five times.
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

## Utan tobak

**Skruf Super White** är den tobaksfria motsvarigheten: samma hus, men växtfiber i
stället för malen tobak. Den delen av processen ovan som handlar om tobak gäller
alltså inte dem.

## Samma fabrik, flera märken

Sävsjö gör mer än Skruf. **Knox**, **Smålands Brukssnus**, **X All White** och
**ZONE** kommer ur samma produktion — se respektive sida.

*Källor: skruf.se, läst 2026-09-19.*`,
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

  {
    name: "Knox",
    countryOfOrigin: "Sverige",
    websiteUrl: "https://skruf.se/vara-produkter/knox/",
    shortDescription:
      "Klassiskt svenskt tobakssnus från Skruf, tillverkat i Sävsjö. Knox är den mer traditionella delen av Skrufs sortiment — hit går kunden som vill ha vanligt brunt snus snarare än en vit nikotinpåse.",
    manufacturingProcess: `## Var det görs

Knox tillverkas av **Skruf i Sävsjö**, samma fabrik som Skrufs eget snus. Hela
processen — malning, blandning, pastörisering, mognad och packning — är densamma.
Den beskrivs i detalj på [Skrufs sida](/staff/brands/skruf).

## Karaktär

**Knox Karaktär** är inte ett eget märke utan en serie inom Knox, och den är
tobakssnus precis som resten. Smakbilden bygger på klassiska svenska toner —
enbär, bergamott och torkade örter — med tobaken tydligt framme.

Serien går på färg i stället för namn. Vi har fyra i sortimentet:

- Karaktär **Blue**
- Karaktär **Green**
- Karaktär **Red**
- Karaktär **Yellow**

> I leverantörens fil heter allt det här "Knox Karaktär", men Karaktär är en serie
> under Knox — inte ett märke. Därför ligger de under Knox hos oss.`,
    blendingNotes: `## Styrkor i vårt sortiment

Knox ligger starkt: **10,5 till 19,2 mg per portion**. Det är bland det starkaste vi
har i brunt snus, så det är värt att fråga innan man rekommenderar till någon som är
van vid vitt snus i lägre styrkor.

## Format

**Lös**, **portion** och **vit portion**. Kom ihåg att vit portion packas torr och
därför rinner långsammare — skillnaden mot brun portion märks direkt.`,
  },
  {
    name: "ZONE",
    countryOfOrigin: "Sverige",
    websiteUrl: "https://zonepouch.se/",
    shortDescription:
      "Tobaksfria nikotinpåsar som tillverkas i Sverige av Imperial Tobacco, i samma produktion som Skruf. Sortimentet är smakdrivet — bär, mint och frukt — och numreras i stället för att skriva ut styrkan.",
    manufacturingProcess: `## Var det görs

ZONE tillverkas i **Sverige** av Imperial Tobacco, som också äger Skruf, och våra
leverantörsuppgifter anger Skruf som tillverkare. Produktionen följer samma steg som
beskrivs på [Skrufs sida](/staff/brands/skruf), men utan tobaksmomenten — ZONE är
helt tobaksfritt och byggt på växtfiber.`,
    blendingNotes: `## Nyckeln till numreringen

ZONE skriver inte ut styrkan i klartext. **Sista siffran i numret är styrkan** — det
är den enda du behöver hålla reda på:

| Slutar på | Styrka | Nikotin |
| --- | --- | --- |
| **3** | Strong | ca 10 mg/portion |
| **4–5** | Ultra | ca 11 mg/portion |
| **7** | Ultra Strong | ca 17 mg/portion |

Så *No13 Sweet Mint* och *No15 Sweet Mint Ultra* är samma smak i två styrkor, och
*No 77 Blueberry Burst* är den starkaste vi har av den smaken.

## Styrkor i vårt sortiment

Tre nivåer: **10**, **11** och **17 mg per portion**. Hoppet upp till 17 är stort —
en kund som är nöjd med en trea ska inte rekommenderas en sjua rakt av.`,
  },
  {
    name: "X",
    countryOfOrigin: "Sverige",
    websiteUrl: "https://x-allwhite.se/",
    shortDescription:
      "Tobaksfria all white-påsar som tillverkas i Sävsjö av Imperial Tobacco. Litet sortiment med tre smaklinjer, och den av våra tillverkare som gått längst på förpackningssidan.",
    manufacturingProcess: `## Var det görs

X tillverkas i **Sävsjö**, samma ort som Skruf, av Imperial Tobacco. Produktionsstegen
finns beskrivna på [Skrufs sida](/staff/brands/skruf) — utan tobaksmomenten, eftersom
X är tobaksfritt.

## Påsen och dosan

Påsen är av **bambufiber**. Dosorna tillverkas av **90 % återvunnen plast** och är
ISCC+-certifierade, vilket är värt att nämna för kunder som frågar om förpackningen.`,
    blendingNotes: `## Styrkor i vårt sortiment

Vi har X på **9 och 10 mg per portion**. Märket säljs i Medium, Strong och Extra
Strong, men i vårt sortiment ligger de tätt ihop i styrka.

## Smaker

Tre linjer: **Cold Blast** (pepparmynta och mentol), **Berry Fresh** (mynta och
svarta vinbär) och **Cosmic Blast** (röda bär och vanilj).

> X numrerar en del varianter med **#3** och **#4**. Högre siffra är starkare, på
> samma sätt som hos flera andra märken.`,
  },
  {
    name: "Smålands Brukssnus",
    countryOfOrigin: "Sverige",
    websiteUrl: "https://skruf.se/vara-produkter/brukssnus/",
    shortDescription:
      "Traditionellt brunt snus från Skruf, lanserat 2012 och prissatt för att vara vardagssnuset snarare än premiumvalet. Tillverkas i Sävsjö som resten av Skrufs sortiment.",
    manufacturingProcess: `## Var det görs

Samma fabrik i **Sävsjö** som Skruf och Knox, och samma process — malning, blandning,
pastörisering, mognad och packning. Den beskrivs på [Skrufs sida](/staff/brands/skruf).

Det här är **tobakssnus**, inte en nikotinpåse.`,
    blendingNotes: `## Styrkor i vårt sortiment

Milt i sammanhanget: **8,4 och 9,88 mg per portion**. Klart under Knox, som börjar
på 10,5.

## Format

**Lös**, **portion** och **vit portion**. Ett litet sortiment — tre varianter hos oss
— så det är lätt att ha koll på hela hyllan.`,
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
