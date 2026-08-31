# REVIT_MCP_study integration notes

Observed on 2026-08-31. Rediscover live capabilities because source, build output and loaded add-in may differ.

- Follow AGENTS.md / CLAUDE.md and relevant PDF export guidance.
- A standard MCP SDK Client with StdioClientTransport successfully launched the configured MCP-Server/build/index.js. The server handles the WebSocket connection and dispatch. Use this supported route when the project provides it and direct tools are absent; do not use a custom raw socket.
- get_active_view, get_all_views and get_active_schema identified the legend and TextNotes category. get_category_fields, query_elements_with_filter and get_element_info returned IDs, font/type names and parameters but not TextNote.Text in that build. Font names are not annotation contents.
- The inspected tool list had no view/sheet PDF export. domain/pdf-export-comparison.md mentioning PDFExportOptions is documentation, not a callable command. Use native Revit UI export only if supported UI control is actually available; otherwise request the exported file.
- Respect the exclusive connection lock. Request release/switch if occupied; never disable the lock.
- The example source was zoning/plans/和美細部計畫-土地使用分區管制要點/source/和美細部計畫-土地使用分區管制要點.pdf: six pages, printed labels 15–20, articles 1–15, tables in articles 2, 3, 8 and 9. Reconfirm against the actual input. Article 8 continues onto the next page; article 2 has a residential special-case footnote; article 3 has separate parking categories and a special note.
- Adding an export tool is separate development: proper MCP registration, matching Revit dispatcher implementation, build and deployment verification are needed. Do not silently add/deploy code during a read-only audit.

## Verified native UI fallback (2026-08-31)

A native UI fallback succeeded on Revit 2026.5 without pyRevit or a new MCP command. If Windows UI Automation is available through the permitted execution tools, inspect the actual Revit window and export controls rather than claiming export is impossible solely because MCP has no PDF tool.

- Use MCP to identify and activate the exact legend; match the full name to avoid exporting a similarly named copy.
- Inspect and invoke the actual native PDF ribbon control. In this run its AutomationId was ID_EXPORT_PDF, but rediscover it each run.
- Export the complete current window, not the visible portion. Select fit-to-page and vector processing; choose a fresh filename and an existing writable output folder. Combined output permits an explicit filename. Disable background export when practical so completion can be verified.
- Native dialog controls sometimes expose no ValuePattern/InvokePattern. Observed HWND controls can be operated with native Windows messages when permitted; never reuse saved handles across dialogs or runs. Re-read the UI names/values before clicking Export.
- Verify file creation and inspect every exported page. Here the legend exported directly as one complete double-column PDF, so no sheet or viewport creation was needed.
- The downloaded CyberPotato0416/MCP-Tools-extension ExportPDF.pushbutton/script.py is a separate pyRevit implementation restricted to ViewSheet. It is not the route used for the successful legend export and must not be run in standalone Python.
