# Teamschema — what was built, and what you need to decide

The schedule is no longer imported. Each store enters its own employees' shifts in the
portal, and because every shop uses the same system, nearby stores can see who is free
and ask to borrow them. This is the report that goes with it; the how-it-works is in
the README under **Teamschema**.

---

## 1. Opening hours: which stores matched

Seeded with `npm run seed:hours`, matched **by store name**, case- and space-
insensitively.

| In the brief | Store in the database | Result |
| --- | --- | --- |
| Täby Centrum | Täby Centrum | seeded, 7 weekdays |
| Linköping | Linköping | seeded, 7 weekdays |
| Helsingborg | Helsingborg | seeded, 7 weekdays |
| Örebro | Örebro | seeded, 7 weekdays |
| **Kungsholmen** | — | **no match. Nothing seeded, nothing invented.** |

The database has five stores and the fifth is called **Västermalmsgallerian**. That
shopping centre is on Kungsholmen, so it is almost certainly the shop you meant — but
"almost certainly" is not a match, and a store invented to hang opening hours on would
never be questioned again. So the seed reported it and stopped.

Two ways to fix it, both yours to choose:

```bash
# Keep the name, map it once:
npm run seed:hours -- --alias "Kungsholmen=Västermalmsgallerian"
```

…or rename the store to Kungsholmen at `/admin/users`' sibling screens and re-run the
seed plain. **Until one of those happens, Västermalmsgallerian has no opening hours**,
and its week grid says "Öppettider saknas" rather than "Stängt" — the two are
deliberately different states.

Closed days (Linköping and Örebro on Sundays) still carry times in the row. They are
unused while `closed` is true and exist so that re-opening a Sunday does not mean
retyping it; the Saturday hours were used as the starting point.

## 2. Which stores have no nearby store

Nothing is inferred from geography. While no pairs are configured, stores with the same
`region` count as nearby:

| Store | Region | Can see free staff at |
| --- | --- | --- |
| Täby Centrum | Stockholm | Västermalmsgallerian |
| Västermalmsgallerian | Stockholm | Täby Centrum |
| **Helsingborg** | Syd | **nobody** |
| **Linköping** | Öst | **nobody** |
| **Örebro** | Mitt | **nobody** |

Three of five stores are alone in their region, so three of five see an empty
"Lediga hos andra butiker" until an ADMIN pairs them at `/admin/nearby`. That page says
so in as many words, and lists the stores that are on their own.

This matches what the brief expected — Täby Centrum and Kungsholmen being the two close
together — but it does mean the feature is live for one pair of shops and dormant for
the rest. Pair them, or leave it: an empty availability list is an honest answer.

## 3. What I assumed

**"Kungsholmen" is not Västermalmsgallerian until you say so.** Covered above.

**`manual` now means the portal's own schedule.** `SCHEDULE_PROVIDER=manual` used to
select the CSV/ICS uploader. It now selects `StoreEnteredScheduleProvider`, because
"manual" is what the stores' own schedule is. The uploader moved to
`SCHEDULE_PROVIDER=import` and still works. Nothing was deleted.

**A day off is the absence of a shift.** There is no "ledig" row and no absence model.
"Markera ledig hela dagen" removes that person's shifts for that day. See the privacy
note below for why.

**Opening and closing templates take the buffer; "Hel dag" does not.** The brief says
"Hel dag (open to close)", so it is exactly open to close. `Öppning` starts 30 minutes
before opening and `Stängning` ends 30 minutes after closing, which is where the buffer
earns its keep. The split is the midpoint rounded to the half hour.

**The buffer is one setting for the chain, not per store.** `SCHEDULE_SHIFT_BUFFER_MINUTES`
in `.env`, default 30. Per-store would have meant another column and another form; say
the word if the shops actually differ.

**An ADMIN is not limited by the nearby setting, but consent still applies.** An admin
searching for free staff sees every store. They do *not* see employees who have not
agreed to extra shifts — that flag is the person's answer, not a configuration an admin
should be able to route around. An admin who needs the whole picture opens the store's
own grid, which is a different question from "who may we ask".

**An extra shift is never copied.** "Kopiera förra veckan" skips borrowed shifts. The
other store agreed once, for one day; repeating that by copying a week would commit
their employee to work nobody asked them about.

**Copying never overwrites.** If the destination already has that person at that start
time, the row is listed as a duplicate and skipped. The plan is recomputed on the
server when you press the button, so what is written is never more than what you saw.

**STAFF read, they do not write.** `/schedule` shows their own shifts and their store's
whole week, read-only. They have no route to another store's employees at all.

## 4. Privacy — what is stored, and what I refused to store

An `Employee` row is: a name, a home store, an active flag, an `openToExtraShifts`
consent flag, and an optional link to a portal account. That is the whole record.

There is no field for a personnummer, payroll, a phone number, an email address, an
absence reason or a free-text note about the person — and the forms have no box to type
one into, which is the part that actually holds. A staff list grows those fields by
accident.

Three things worth your attention:

**A day off is not recorded, only the absence of a shift.** Once the app can store
"ledig" it is one small step to storing why, and a reason for an absence is health
information. If you later want to record holiday or sick leave, that is a separate
decision with a separate legal basis, not a column to slip into this table.

**`openToExtraShifts` is consent and is off by default.** It is the only reason an
employee becomes visible to a manager who is not their own. The edit form says "fråga
personen först" under the checkbox. Nothing in the app verifies that you did, so the
honest description is: this is a record of a conversation you had, not the consent
itself. If staff turnover makes that hard to keep true, the flag should be re-confirmed
periodically — there is no mechanism for that today.

**The change trail is personal data with a retention period.** `ScheduleChange` keeps
"who changed what, and when" as a one-line summary (`Anna A · 2026-11-04 10:00–18:00`)
so a mistake can be traced. Rows older than **90 days** are deleted on the next write to
that store. There is no job runner in this app, so a store that stops being scheduled
keeps its last 90 days indefinitely; if that matters, it needs a scheduled job.

One thing I did **not** do and you may want: nothing tells an employee that their name
and availability are visible to another store. They find out when their manager asks
them. A line in the staff handbook is probably the right place for that, not a screen.

## 5. Not built, on purpose

Payroll, hours totals, time clocks, shift swaps between employees, holiday and leave
management, SMS, automatic scheduling — all out of scope per the brief.

The optional CSV import of employees (name, store) was also left out. Five stores'
worth of staff is a few minutes of typing on a page that already exists, and a second
import path is a second thing to keep correct. Say the word if the real staff list is
long enough to change that answer.

## 6. The dormant TooEasy integration

Untouched and switched off, not deleted:

- `TooEasyApiScheduleProvider`, the client, the mapper, the employee directory and
  `npm run tooeasy:probe` are all still there.
- `/admin/tooeasy` leaves the admin hub and global search while
  `SCHEDULE_PROVIDER` is not `tooeasy`, through the ordinary feature-flag machinery
  (`features.tooeasy`). Setting the variable brings it straight back.
- The CSV/ICS uploader at `/admin/schedule` is collapsed behind a disclosure and only
  renders its form when `import` is the live source. Importing into a table nothing
  reads is a trap, not a feature.
- The one thing removed is `getTeamSchedule` in `src/lib/schedule/queries.ts` — the
  read-only region coverage grid that `/team-schedule` used to render. Its page is now
  a 308 to `/store/schedule`, nothing called the function any more, and the two
  questions it answered are now `/store/schedule` and `/schedule/available`.

Switching back is three steps, in the README under **Switching back to TooEasy later**.
While another provider is live, the week grid says so at the top of the page: what you
type there is saved, but "Mitt schema" is reading somebody else's data.

## 7. Demo data in `prisma/dev.db`

Verifying this end to end meant creating people. Six employees whose names all start
with **"Demo "** are in your development database, one accepted extra shift between
Västermalmsgallerian and Täby Centrum, and one ordinary shift at Täby Centrum. They are
fictional. Deactivate them at `/store/employees` or:

```bash
sqlite3 prisma/dev.db "delete from employees where name like 'Demo %';"
```

Shifts, requests and the change trail cascade with the employee. A backup of the
database as it was before any of this ran is in `backups/`.
