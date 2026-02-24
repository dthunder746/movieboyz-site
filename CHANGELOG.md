# Changelog

## 24 Feb 2026

### New Features

**Show unowned movies**
A "Show unowned movies" toggle in the filter bar reveals all 2026 box office releases, not just league picks. Unowned movies appear with a grey dot and no pick badge. They can be clicked to plot on the chart, just like owned picks. Hidden by default.

**Breakeven (B/E) column**
A new B/E column in the table shows each movie's breakeven threshold — two times its production budget. Hover the column header for a description.

**Week history**
The Weekly Gross section now tracks every week of the year (up to 52 columns by December). The four most recent weeks are visible by default. Click "Show week history" in the filter bar to expand older weeks.

**Table pagination**
The table now shows 25 rows by default. A page size selector at the bottom of the table lets you choose 10, 25, 50, 100, or all rows.

**Drag-to-zoom on chart**
Click and drag on the chart to zoom into a time range (horizontal only). Hold Shift and drag to pan instead. Mouse wheel zoom continues to work as before.

### Improvements

**Opening column**
The release date and days running are now combined into a single column — e.g. "Jan 30 · 24d" — keeping the table compact without losing any information.

**Chart starts at first movie opening**
The chart's initial view now starts just before the first movie's opening day rather than from the beginning of the year. Zoom out or reset zoom to see the full timeline.

**Chart tooltip shows only relevant entries**
Hovering over a date now only shows movies and owners that have data at that point — pre-opening dates are no longer cluttering the tooltip with empty values.

**Chart profit lines fixed for unowned movies**
Profit lines for all movies now plot correctly from their individual opening date, including movies that opened before the earliest league pick.

---

## Earlier (initial build)

**Click table rows to plot movies on the chart**
Select any movie in the table to see its profit line on the chart. Select multiple movies to compare them side by side. A "Clear selection" button appears above the table while rows are selected. The chart heading updates to show which movie(s) you're viewing. Changing the owner filter automatically clears the movie selection.

**Click leaderboard cards to explore an owner's movies**
Click any owner card in the leaderboard to filter the table to their movies and switch the chart to show each of their movies as a separate profit line. Click the same card again to return to the full view. The owner filter buttons below the chart work independently and support multi-select — click multiple owners to compare them.

**Chart zoom and pan**
Scroll the mouse wheel over the chart to zoom in on a time range. On mobile, use a two-finger pinch gesture. A "Reset zoom" button above the chart restores the full view.

**Latest dates shown first in the table**
The Daily Gross and Weekly Gross columns are ordered with the most recent date on the left, so you see the newest numbers without scrolling right.

**Chart tooltip sorted by profit**
When hovering over the chart, owners are listed from highest to lowest profit at that point in time.

**Column headers no longer truncated**
Detail column headers now size to fit their content. "To Date Gross" and "To Date Profit" renamed to "Gross TD" and "Profit TD" for brevity.

**Mobile table scrolling fixed**
On touchscreens, swiping left/right on the table now scrolls as expected instead of accidentally triggering column resize.
