# Queue overview design contract — local teaching fixture

This is a local design specification, not a Figma export or a claim of a live Figma connection.

Use a readable single-page layout, light background, dark text and a blue accent. One h1: Queue overview. Keep the asOf label, input and Refresh button above the results. Open, Overdue and Closed cards must each have their label adjacent to their number. Show Open by priority with labels Priority 1, Priority 2, Priority 3. On a narrow viewport stack cards without horizontal overflow. Use semantic HTML and associated input labels; errors should have role=alert. Display count values using textContent or equivalent safe text nodes. Never expose raw ticket titles or private record details. The page must be useful without color distinctions.

Stable selectors for independent verification: input#as-of, button#refresh, #open-count, #overdue-count, #closed-count, #priority-1, #priority-2, #priority-3, #error. Load the initial summary when page opens and refresh on button activation. Keep layout and data behavior separate enough to review.
