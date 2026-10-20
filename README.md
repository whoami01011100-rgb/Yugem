YUGEM Advisory — Website Overview
> A page-by-page overview of the YUGEM Advisory web application, based on the supplied Lighthouse page captures.
About the Website
YUGEM Advisory is presented as a payment-entry and payment-tracking web application. Its interface brings payment records, summary figures, reporting, and user-access administration together in a shared dashboard-style workspace.
The application uses a dark interface with a left-side navigation menu. The captured pages also show a light-mode control.
Pages Overview
1. Dashboard
URL: `index.html`
The Dashboard provides a high-level snapshot of payment activity.
Visible sections and actions:
Summary cards: total payments, today's entries, total amount, and pending amount.
Quick Actions: shortcut to create a new payment entry.
Recent Payments: a table showing recent payment information, including payment ID, client, service, amount, and status.
Shared navigation: links to Dashboard, New Payment, Payment Entries, Reports, and User Access, plus Logout.
Appearance control: a Light-mode toggle is visible in the captured interface.
Purpose: Give users a quick view of payment activity and direct access to common tasks.
2. Payment Entries
URL: `payment-entries.html`
This page is used to browse and manage saved payment records.
Visible sections and actions:
Payment search: search field with a prompt covering payment, client, company, or employee ID.
Status filter: filter records by status, with options shown for All Status, Received, and Pending.
Search and Clear controls: run a search or clear the current filters.
Selection controls: select individual records or use the table's select-all checkbox.
Bulk action area: shows the number of selected payments and offers a Delete Selected action.
Payment table: columns include Payment ID, Date, Client, Company, and Total Amount. The table can scroll horizontally when its columns exceed the available width.
Purpose: Find, filter, review, select, and perform bulk actions on payment entries.
3. Reports — Payment Reports
URL: `report.html`
The Reports page summarizes payment activity and groups records into business-oriented views.
Visible sections and actions:
Report Filters: From Date and To Date inputs.
Date shortcuts: Today, Yesterday, This Week, This Month, Last Month, and This FY.
Filter actions: Apply Filter and Reset.
Export: Export Excel action is visible.
Summary cards: total entries, total deal value, received amount, and balance amount.
GST Summary: a separate summary of GST across payment entries.
BDE Performance: a table summarizing entries, total deal, received amount, and balance by BDE.
Service Summary: a breakdown of payment entries by service.
Payment Status: a grouping of entries by their current status.
Purpose: Review payment totals and outstanding balances, filter reports by date, inspect service/BDE summaries, and export report data.
4. User Access — User Access Management
URL: `admin-access.html`
This page is for administering application users and their access levels.
Visible sections and actions:
Add New User: a button to start adding a user.
User summary cards: total users, Admin access, Employee access, and No Access.
User table: columns include Employee ID, Full Name, Login ID, DB Role, and Access Role.
Access Role controls: dropdown options shown include ADMIN, EMPLOYEE, and NO ACCESS.
Account status controls: dropdown options shown include ACTIVE and INACTIVE.
Purpose: Review registered users and manage their application access roles and account status.
Shared Navigation and Interface
The captured application pages show a consistent navigation pattern with these items:
Dashboard — overview of payment activity.
New Payment — navigation item and dashboard shortcut for starting a payment entry.
Payment Entries — searchable list of saved payment records.
Reports — payment summaries and exports.
User Access — user and access administration.
Logout — leave the current session.
Light mode — appearance control visible on the captured pages.
Typical User Journey
Open the Dashboard to review payment totals and recent entries.
Use New Payment to begin entering a payment.
Open Payment Entries to find, filter, review, or select saved records.
Open Reports to apply a date range, review summaries, or export data.
Use User Access when user roles or account statuses need administration.
This journey describes the navigation and controls visible in the supplied captures; the exact behavior behind each action was not independ\
Scope Notes
This README describes the four pages represented by the supplied JSON captures: Dashboard, Payment Entries, Reports, and User Access.
Page descriptions are based on visible interface elements in those captures, rather than on source-code inspection.
The New Payment item is visible in navigation, but a separate capture for its page was not included in the files reviewed. Its fields and complete workflow therefore are not described.
Example values shown in screenshots are intentionally not reproduced as business facts.
This document is a website/product overview. It does not include Lighthouse scores, performance measurements, or optimization recommendations.
---
Website: yugem.onrender.com
