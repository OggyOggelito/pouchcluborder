# Put the Örebro system here

Code, a repository checkout, a database dump, exported CSVs, screenshots —
whatever you can get. Nothing in this folder is read by the app; it is a
drop-off point so a follow-up task has something concrete to analyse instead
of guessing.

Two things to check before you drop anything in:

- **No production personal data.** A database dump from a live system may
  carry employee names, customer details or credentials. Ask for a
  schema-only dump, or one with the tables that matter and nothing else.
- **No secrets.** `.env` files, API keys and connection strings do not belong
  in this repository. If a dump contains them, strip them first.

Work through `../intake.md` first — the answers are worth more than the code.
