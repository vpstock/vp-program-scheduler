# Project program scheduler

Victorian Projects live program calendar, November 2026 to January 2027, with stage hours, builder programs, Fantech fire station schedule and the WIP job list.

- Page: `index.html` (plain HTML and d3, no build step)
- Data: `data/*.csv`. The page reads these files each time it loads and every 5 minutes after that.
- A scheduled Claude task refreshes the CSVs each weekday morning from the WIP workbook, Mat's job programming agenda and builder programs. Edit a CSV here and the page updates within minutes.
- Rough-in means mechanical rough-in services only.
