## Packages
recharts | For visualizing sales trends and report data
framer-motion | For smooth wizard transitions and page entry animations
date-fns | For robust date formatting and calendar logic
clsx | For conditional class names
tailwind-merge | For merging tailwind classes safely

## Notes
- Mobile-first approach: large touch targets (min 48px)
- Wizard state management needs to persist between steps (using local state in parent page)
- Status logic: OK (diff == 0), Warning (|diff| <= 2.5), KO (|diff| > 2.5)
- "Opening Cash Fund" logic: Fetch previous day's closing fund using `GET /api/stores/:storeId/closes/previous`
