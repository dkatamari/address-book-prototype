# Address book prototype

This is a standalone account address-book and demo send frontend for deposits and withdrawals. Keep it statically exportable;
no API routes, backend dependencies, authentication services or server actions.
Use a light theme: white panels on #F5F5F7, Alliance No.2 typography, #CEFD54
primary buttons, purple navigation and focus indicators. Dashboard and Address book are interactive in the sidebar; History and Settings
remain disabled. Send uses fixed illustrative balances/rates and a transient confirmation screen;
do not persist transfers or their files, reserve balances, or show request history.
It never moves funds or implies real approval.

Keep recipient code under src/app/recipients and shared UI primitives under
src/components/ui. Country requirements belong to the imported Internal
playbook snapshot. Update it only through npm run sync:playbooks; do not
hand-edit country rules or reference repositories. Preserve canonical paths,
compound rule semantics and deferred transaction conditions. Do not represent
saved accounts as approved payments.
Use Address book for the collection and account for saved entries in UI copy.

Run npm test, npm run lint, npm run typecheck and npm run build after changes.
For UI changes also run npm run test:browser and inspect desktop/mobile output.
