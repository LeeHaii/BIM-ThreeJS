# Platform scope and initial budgets

Supported baseline: current and previous major Chromium, Firefox, and Safari;
desktop and tablet pointer/touch; IFC2x3 and IFC4 input in the offline pipeline;
one active building browser session with federated fragment layers.

Initial measurable budgets (to refine against real fixtures):

- API p95 excluding asset transfer: 400 ms.
- Unit search interaction p95 after debounce: 700 ms.
- First useful model: 8 s medium model on reference desktop/network.
- Interactive orbit target: 30 fps p95 on reference desktop.
- Building switches settle without monotonically growing renderer resources.

Private operational data is never stored in static assets, URLs, browser
persistence, analytics, or service-worker caches.
