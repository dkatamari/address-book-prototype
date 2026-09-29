# Address book prototype

This is a standalone account address-book frontend for deposits and withdrawals. Keep it statically exportable;
no API routes, backend dependencies, authentication services or server actions.
Use a light theme: white panels on #F5F5F7, Alliance No.2 typography, #CEFD54
primary buttons, purple navigation and focus indicators. Only Address book is
interactive in the reference sidebar.

Keep recipient code under src/app/recipients and shared UI primitives under
src/components/ui. Country requirements belong to the imported Internal
playbook snapshot. Update it only through npm run sync:playbooks; do not
hand-edit country rules or reference repositories. Preserve canonical paths,
compound rule semantics and deferred transaction conditions. Do not represent
saved accounts as approved payments.
Use Address book for the collection and account for saved entries in UI copy.

Run npm test, npm run lint, npm run typecheck and npm run build after changes.
For UI changes also run npm run test:browser and inspect desktop/mobile output.
