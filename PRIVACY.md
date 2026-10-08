# Privacy notes — current implementation

This is an implementation description, not a retention promise for every hosting provider.

## Browser-local studio work

The calligraphy studio stores templates, autosaves, writing drafts and digital backups in the browser. Its Yjs editor can coordinate the same browser's open tabs. These drafts can remain after a tab closes; browser-local does not mean automatically erased. The editor can reset a draft to fixed wording and download text. Browser site-data controls can remove local storage. Draft preview can affect other studio views in that browser without changing committed poem source. Browser storage remains the default and does not require an account.

Imported reference photos and user-selected fonts are processed locally by default. A digital backup may include those assets. An ordinary print PDF contains only selected visible content; an editable template PDF includes the template and material/text notes but omits the original photo and uploaded font file. Photo sizing is calibration assistance, not OCR or handwriting-font identification.

The optional crew save sends the current worksheet settings, writing text, imported reference photo, and uploaded font to the authenticated crew service. It stores one current snapshot for the Authentik identity and replaces that snapshot only after a revision check. The anonymous browser draft remains separate. The site has no self-service crew-copy deletion or automatic expiry; server backups may retain prior bytes according to the operator's backup policy. Use the portable local backup when a complete user-controlled copy is required.

The separate 3D scale studio keeps its current design in local browser storage.
Its JSON export includes dimensions, layer assumptions, text, construction notes,
font choices and any embedded custom font. Importing that file processes it locally;
it does not publish it in the reference gallery or synchronize it to an account.
The page reports local storage failures and offers a downloadable copy.

## Optional shared relay

Live cross-browser synchronization is disabled unless the operator configures `COLLAB_DIR`. When enabled, the server receives shared Yjs draft updates and writes room documents and plain-text mirrors to that directory. Other visitors able to reach those rooms can edit them. Backups may retain old copies; the application does not implement an automatic expiry policy. Operators should establish retention and removal procedures before enabling shared editing and tell participants that it is shared.

## Website requests and links

The application serves public metadata, assets and pages. It does not implement account signup, general sketch uploads, or recipient-detail collection. Authentik supplies the identity used by the narrow crew worksheet service. The server writes startup messages; hosting, reverse-proxy and network services may process request information under their own configuration. This document does not claim those services collect no logs.

The site links to external services, including source hosting and the artist's profile. Their privacy policies apply when you visit them. Original model assets and public downloads are intentionally published. Andrew explicitly approved a public gallery of the complete supplied project reference images on 2026-09-18, including Jill's calligraphy photograph and the uncropped sculpture screenshots. These reviewed originals are committed site assets, available without an account; importing a photo in the studio still does not upload it. Unpublished reference material and private archive history remain excluded.

## Draft requirements for broader platform capabilities

The following is a draft checklist, not a current platform policy. Document the actual account and file data, lawful/public reporting contacts, access controls, browser cache separation, telemetry consent, retention windows, backup expiry and deletion limitations before releasing the broader proposed [platform features](ROADMAP.md). Avoid putting private sketches, personal details or secrets in today's publicly editable shared drafts.
