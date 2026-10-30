/**
 * Starter checklist templates and a placeholder quiz.
 *
 * Everything is prefixed "EXEMPEL –" and deliberately generic: no legal,
 * compliance, age-check, tobacco or nicotine-rule content, and nothing about
 * brands. Replace it with the real routines before anyone relies on it.
 *
 * Idempotent: skips anything that already exists by title.
 */
import { prisma } from "../src/lib/db";

const TEMPLATES = [
  {
    type: "DAILY_OPEN",
    title: "EXEMPEL – Öppning",
    intro: "EXEMPEL. Byt ut mot butikens riktiga öppningsrutin.",
    items: [
      { title: "EXEMPEL – Lås upp och tänd i butiken", required: true },
      { title: "EXEMPEL – Kontrollera att kassan är redo", required: true },
      {
        title: "EXEMPEL – Läs dagens nyheter i appen",
        description: "Nya produkter och butiksnyheter ligger under Nyheter.",
        linkUrl: "/news",
        required: false,
      },
    ],
  },
  {
    type: "DAILY_CLOSE",
    title: "EXEMPEL – Stängning",
    intro: "EXEMPEL. Byt ut mot butikens riktiga stängningsrutin.",
    items: [
      { title: "EXEMPEL – Städa och fyll på i hyllan", required: true },
      { title: "EXEMPEL – Stäng kassan för dagen", required: true },
      { title: "EXEMPEL – Släck och lås", required: true },
    ],
  },
  {
    type: "STORE_OPENING",
    title: "EXEMPEL – Nyöppning av butik",
    intro: "EXEMPEL. En körning per ny butik.",
    items: [
      { title: "EXEMPEL – Lägg upp butiken i appen", required: true },
      { title: "EXEMPEL – Koppla personalens konton till butiken", required: true },
      { title: "EXEMPEL – Gör en första beställning", required: false },
    ],
  },
  {
    type: "ONBOARDING",
    title: "EXEMPEL – Introduktion för ny medarbetare",
    intro: "EXEMPEL. Byt ut mot er riktiga introduktion.",
    items: [
      {
        title: "EXEMPEL – Läs igenom varumärkessidorna",
        description: "Guiden beskriver hur produkterna tillverkas och skiljer sig åt.",
        linkUrl: "/staff",
        required: true,
      },
      {
        title: "EXEMPEL – Prova produktsöket",
        description: "Filtrera fram en produkt åt en kund som vill ha något milt och fruktigt.",
        linkUrl: "/staff/finder",
        required: true,
      },
      {
        title: "EXEMPEL – Gör exempelquizet",
        linkUrl: "/staff/quizzes",
        required: false,
      },
    ],
  },
] as const;

async function main() {
  let created = 0;
  let kept = 0;

  for (const template of TEMPLATES) {
    const existing = await prisma.checklistTemplate.findFirst({
      where: { title: template.title },
      select: { id: true },
    });
    if (existing) {
      kept += 1;
      continue;
    }

    await prisma.checklistTemplate.create({
      data: {
        type: template.type,
        title: template.title,
        intro: template.intro,
        items: {
          create: template.items.map((item, index) => ({
            title: item.title,
            description: "description" in item ? item.description : null,
            linkUrl: "linkUrl" in item ? item.linkUrl : null,
            required: item.required,
            position: index,
          })),
        },
      },
    });
    created += 1;
    console.log(`  + ${template.title}`);
  }

  // ---- placeholder quiz -------------------------------------------------
  const quizTitle = "EXEMPEL – ta bort";
  const existingQuiz = await prisma.quiz.findFirst({
    where: { title: quizTitle },
    select: { id: true },
  });

  if (existingQuiz) {
    kept += 1;
  } else {
    await prisma.quiz.create({
      data: {
        title: quizTitle,
        description:
          "EXEMPEL. Två frågor om begrepp i den här appen, så att quizfunktionen går att prova. Ta bort och skriv egna frågor.",
        published: false,
        questions: {
          create: [
            {
              text: "EXEMPEL – Vad menas med en \"stock\" när du beställer?",
              options: JSON.stringify(["En enskild dosa", "En rulle med flera dosor", "En hel låda"]),
              correctOption: 1,
              explanation:
                "I beställningsflödet räknas allt i stockar. Hur många dosor en stock innehåller står som *Innehåll DFP* på produkten.",
              position: 0,
            },
            {
              text: "EXEMPEL – Var ser du dina tidigare beställningar?",
              options: JSON.stringify(["Under Nyheter", "Under Tidigare", "I produktsöket"]),
              correctOption: 1,
              explanation: "Tidigare beställningar ligger under **Tidigare**, med Excel-export per order.",
              position: 1,
            },
          ],
        },
      },
    });
    created += 1;
    console.log(`  + ${quizTitle} (quiz)`);
  }

  console.log(`\n${created} created, ${kept} already existed.`);
  console.log('Everything is prefixed "EXEMPEL" — replace it before anyone relies on it.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
