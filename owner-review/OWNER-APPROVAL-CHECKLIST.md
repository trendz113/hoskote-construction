# Owner approval checklist (redesign, Oct 2026)

Nothing below was invented. These are existing site claims that I could not verify, and a few wording decisions that need your sign-off before you rely on them publicly.

## 1. Prices and what the rate covers
- [ ] ₹1,800 / ₹2,000 / ₹2,200 per sq ft are the current rates (shown as "indicative, confirmed in written quote").
- [ ] Is GST included in the per sq ft rate? The site now says "confirmed in your written quote". Decide and state it plainly.
- [ ] Are structural/architectural design fees included? Same wording applies until you decide.
- [ ] How is built-up area measured (balconies, staircase, parapet, sump)? Add one clear sentence.
- [ ] The old FAQ (Q1) says approval fees are "Panchayat" fees; the packages page says "BMRDA". Which authority applies for your plots? Fix whichever is wrong.
- [ ] The calculator's "typical additional costs" (₹1.45 L – ₹3.55 L) is the sum of your published ranges: plan approval 20k–80k, temporary electricity 15k–40k, permanent BESCOM 15k–45k, borewell 60k–1.2L, sump 35k–70k. Confirm these ranges.

## 2. Promises and process claims
- [ ] Stage-wise payment percentages in FAQ Q10 (10/15/20/15/15/15/10) and "8–12% advance" elsewhere. Both are on /faq only. Confirm they match your real agreements.
- [ ] WhatsApp updates: Comfortable says "weekly", Better-Living and Dream Home say "daily"; FAQ Q11 says "daily photos and videos". The homepage now says "regular". Confirm the real promise per package.
- [ ] "You approve each stage before paying" (Better-Living) and "dedicated site supervisor" (Dream Home).
- [ ] Warranty: FAQ mentions a 1-year warranty with a 7-working-day response. Confirm the exact terms, and put them in the agreement.
- [ ] Timelines in FAQ Q7 (G 6–8, G+1 9–12, G+2 14–18 months).
- [ ] Response times: "within 2 hours" and "estimate within 24 hours" were REMOVED from the contact page because they were commitments we cannot check. Add back only if you will always keep them.
- [ ] "Our Promise to You" list on the old About section (never ask for money before showing completed work, etc.). Check /about before keeping it.
- [ ] Plan-approval help wording on /services ("we help prepare documentation").

## 3. Projects
- [ ] Are all 7 projects real, completed, and is it OK to show them? Photos are your Cloudinary images.
- [ ] Project detail pages (/projects/<slug>) still contain family first names, cost ranges and timelines from `public/projects/_data.json`. I did not change these. Please confirm each family agreed to be named and that the costs/timelines are true, or tell me to remove them.
- [ ] Project cards now show location, floors, plot size and approximate built-up area. These numbers come from your existing `public/projects/_data.json` (the built-up figures are estimates there, e.g. 1,900 / 3,600 / 4,800 sq ft). Confirm each, or send corrected figures.
- [ ] The hero photo (G+2, Hoskote Town) and the team photo on the homepage: confirm they are your real project and team.
- [ ] Old hero caption "Dream Home package, 9 months, ₹68L" was removed (unverified).

## 4. Testimonials and team photos
No testimonial section is shown because none could be verified. Send real reviews (name, project type, link to the Google review) and I will add them. The only team photo on the site is the existing one on the homepage and About page; send more real photos if you have them.

### Removed testimonials
The six testimonials on the old homepage were removed from the live site and parked in `owner-review/testimonials-unverified.md`. Re-add only real ones, with the customer's permission and, ideally, a link to the original Google review. The old page also showed a star rating; no rating or review count is shown now.

## 5. Business details
- [ ] Office: Balaji Gold City, Hoskote 562114; hours Mon–Sat 9–6, Sunday 10–2 by appointment (hours also in structured data for Mon–Sat only).
- [ ] UDYAM-KR-02-0127051 (unchanged).
- [ ] Service areas list (Hoskote Town, Sulibele, Malur, Anugondanahalli, Kannamangala, Channasandra, Jadigenahalli, Nandagudi, Vijayapura, Old Madras Road, Budigere Road, Devanahalli Road, KR Puram edge). Remove any you do not actually serve. The old "x km from Hoskote" notes were removed.
- [ ] Removed from structured data because unverified: geo coordinates, "Property Resale" and "Home Loan Assistance" as offered services.
- [ ] Services page lists home loan guidance, property document verification and properties for sale. Remove any you do not genuinely offer.

## 6. Legal
- [ ] The construction agreement generator is now labelled a sample, not legal advice. Have a lawyer review the agreement text.
- [ ] /privacy and /terms are drafts marked for review.

## 7. Deployment steps (yours)
1. Railway: set `ADMIN_PASSWORD` (unchanged value) and add a Volume mounted at `/data` with `DATA_DIR=/data`, otherwise enquiries are lost on every redeploy.
2. After deploying, send one real test enquiry from the homepage and one from /contact and check /admin shows them.
3. Revoke the GitHub token you pasted in chat on the first day.
4. In Google Search Console, resubmit `sitemap.xml`.
