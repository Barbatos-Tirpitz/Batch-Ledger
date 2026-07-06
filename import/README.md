# import/

Put your working `Batch_Ledger_Import_Template.xlsx` (or your own workbook) in this folder.

It's just a convenient, consistent place to keep it — the app doesn't read from disk automatically (browsers can't watch a folder without you granting access each session), so you'll still open the app and use the **Import Excel workbook** button in the header to pick the file from here.

The app looks for sheets named exactly:
- `Ingredients`
- `Products`
- `Production Log`

Any of the three can be present or missing — it imports whichever it finds, in that order, in a single click.

Files placed here (other than this README) are ignored by git, so your real ingredient/recipe/production data never gets committed.
