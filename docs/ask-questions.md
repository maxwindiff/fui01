# Test questions for the Ask page

Drafted by a model given the case and its record types, and told nothing about the views the page can draw. All names and facts are invented.

## Questions

1. **"all contributions to Whitcombe from Halvorsen, Tessaly and Kestrel Row people and their spouses, 2019 to 2025. totals by person, and where they live"**
   - **Goal:** Find out how much of Whitcombe's money traces back to the winning bidder and its lobbyists.
   - **A complete answer contains:** each donor's name, stated employer, amount, date, home state and recipient committee. It gives totals per person, per organization and per election cycle, plus the share of Whitcombe's total receipts. It flags donors whose employer field is blank or vague but whose name matches a Halvorsen or Kestrel Row career history. It keeps the Liberty Orbit Fund's $1.15M in a separate category, because that money is an independent expenditure and not a contribution. The reader should notice whether the giving is concentrated in particular years, and how much comes from Washington state or Texas compared with Arizona.
   - **Data:** On hand: itemized contributions, career histories, staff directories. Derived: matching donors to employers, totals and shares.
   - **Hard because:** employer strings vary ("Halvorsen Aerodyne", "HAC", "Tessaly", "self-employed", "retired"). Spouses have to be inferred. The brief doesn't say whether Forward Lift PAC is connected to Whitcombe, so the tool has to decide whether to count it and say which way it went.

2. **"Did the giving pick up around when she changed position on sole source?"** (follows 1)
   - **Goal:** Find out whether the money's timing matches the timing of her stance changes.
   - **A complete answer contains:** the amounts from question 1 by quarter, 2019 to 2025, and the date of each stance marker:
     - the 2019 floor speech and vote
     - the June 2021 op-ed
     - the 2022 town hall
     - the 2023 hearing
     - the 21 May 2025 vote on S. 2114, section 6

     It also gives a baseline: how the same donors give in an ordinary election cycle, and what they gave to other senators on space committees. The reader needs to tell whether increases come before or after each shift, and whether the 2024 election cycle alone explains them.
   - **Data:** On hand: contributions, statements, votes. Derived: a baseline adjusted for the election cycle.
   - **Hard because:** there are only a handful of stance events, and the 2024 race makes everything before it look like a surge. The answer has to report coincidence in timing without suggesting a cause.

3. **"Did Petra Voss have any contact with OOL between March 2024 and March 2025?"**
   - **Goal:** Decide whether she may have broken her cooling-off restriction.
   - **A complete answer contains:**
     - every record of contact between Voss and OOL staff in that window: visitor logs, emails, calendar entries, gift log entries, and events both attended
     - whether any Kestrel Row filing listed her as a lobbyist for Halvorsen during the window
     - contacts with OOL by other Kestrel Row people (such as Owen Liang) on Halvorsen matters during the window
     - for each contact, whether it looks like representation before her former agency or something the restriction allows, such as a social event
     - for each record type, the time span and places it covers, so the reader knows which gaps mean "no record exists"

     The reader needs to tell "no contact found" apart from "no records cover this."
   - **Data:** On hand: contacts, lobbying filings, event attendee lists. Fetched: the text and scope of the cooling-off rule.
   - **Hard because:** the strongest answer may be an absence. Visitor logs miss off-site meetings, and FOIA releases have redactions. Indirect contact through colleagues needs reasoning across several kinds of record.

4. **"who else reported to her at OOL, and were any of them on the source selection board"** (follows 3)
   - **Goal:** Find out whether Voss's former subordinates, besides Calder, scored the bids.
   - **A complete answer contains:** the people who reported to Voss, directly or indirectly, from 2019 to 2024, with dates. It identifies the five board members, or says the names are withheld. It gives any overlap between the two groups and how long each overlapping person worked under her. It also covers Calder's part: she signed the final solicitation, and the answer should say whether she chose or oversaw the board.
   - **Data:** On hand: staff directories, career histories, memos, the bid protest. Fetched (possibly): board membership through FOIA or GAO protest filings.
   - **Hard because:** board membership is often confidential. Organization charts change every year, and "reported to" can be indirect.

5. **"diff draft vs final solicitation OOL-25-R-0090"**
   - **Goal:** Find out whether anything besides the cadence weight changed in a way that favors one bidder.
   - **A complete answer contains:** every change to evaluation factors and weights, including which factors lost the 15 points that cadence gained. It covers the definition of launch cadence (counting window, minimum number, which vehicles qualify), past performance, schedule and price terms, and any added or removed requirements. It gives the dates of the draft and the final, who signed each, and any industry comments received in between. The reader needs to notice which changes match a known trait of Halvorsen's or Meridian's offer.
   - **Data:** On hand: the draft and final solicitations, memos, the bid protest.
   - **Hard because:** these are long documents with renumbered sections, and definitions often change inside attachments. Whether a change matters depends on what each bidder can do, and that comes from other records.

6. **"Does any of the new cadence language show up earlier in Halvorsen, Kestrel Row or Whitcombe material?"** (follows 5)
   - **Goal:** Find out whether the solicitation wording came from the winning side.
   - **A complete answer contains:** each changed passage in the final solicitation, matched with similar passages from:
     - issue descriptions in lobbying filings
     - Kestrel Row and Halvorsen letters and emails released under FOIA
     - Halvorsen's public comments on the draft
     - Whitcombe's statements
     - the text of S. 2114

     For each match it gives the date, the author and how close the match is (verbatim, near-verbatim or paraphrase). It also says how often the phrase appears in unrelated solicitations, so the reader can set aside industry boilerplate.
   - **Data:** On hand: documents, statements, FOIA material, filings. Derived: text similarity. Fetched: other agencies' solicitations, to establish how common each phrase is.
   - **Hard because:** common phrases like "proven providers" prove little. Which text copied which depends on dates the records may not have.

7. **"If launch cadence had stayed at 20%, who wins?"**
   - **Goal:** Find out whether the weight change decided the award.
   - **A complete answer contains:** each bidder's score on each factor. It recomputes the totals at 35% and at 20%, putting the 15 points back where the draft had them, and gives the margin under each weighting. It says how price entered the decision (best-value tradeoff or lowest price) and whether the board scored with numbers or with adjectives. It states every assumption made in converting scores.
   - **Data:** Simulated, using scores from the award notice, the protest, and the source selection memos.
   - **Hard because:** scores may be adjectival or redacted. The best-value tradeoff involves judgment, and evaluators might have scored differently under another weighting.

8. **"what cadence weight flips the result, and does it hinge on one evaluator"** (follows 7)
   - **Goal:** Find out how fragile the outcome is.
   - **A complete answer contains:** the weight at which the bids tie. For each of the five board members, it says whether dropping or changing that member's scores changes the winner. It gives the range of outcomes under reasonable uncertainty in the scores.
   - **Data:** Simulated. Individual scoresheets come from memos if they were released.
   - **Hard because:** individual scoresheets are rarely released, and consensus scoring hides individual views. The answer has to state how uncertain it is.

9. **"Was Whitcombe or Ferreira in the same room as Tolliver, Voss, Liang or Calder at the Vegas summit?"**
   - **Goal:** Find out whether private contact happened at the Aerospace Futures Summit, 8 to 11 Sep 2025.
   - **A complete answer contains:** every overlap from the badge scans: the pair of people, the room, the start and end times, and the duration. It gives each room's kind and size, since a small suite means more than a ballroom. It adds calendar entries and attendee lists for the same days. The reader needs to notice repeated overlaps and any overlap in a small or private room.
   - **Data:** On hand: badge scans by room and time, attendee lists, calendars.
   - **Hard because:** scans record entries but often not exits. Badges can be shared, and people slip in behind others. Co-presence in a large room means little.

10. **"what happened between the summit and the award, same people"** (follows 9)
    - **Goal:** Find out whether contacts after the summit line up with movement on the solicitation or the award.
    - **A complete answer contains:** for 11 Sep to 6 Nov 2025, the contacts among the people in question 9 and Imani Calder. It covers lobbying filings for the third and fourth quarters of 2025, the Spaceport Industry Dinner if it fell in this window, and the dates of key procurement steps. The reader needs the order of these events.
    - **Data:** On hand: contacts, filings, documents, the stages of the award.
    - **Hard because:** the final solicitation may have been issued before the summit, which changes what any contact could have influenced. The answer has to check that date and say so.

11. **"Halvorsen and Texas. What's been reported, what has Texas offered, and since when?"**
    - **Goal:** Judge whether the Texas plan gives Halvorsen leverage over an Arizona senator.
    - **A complete answer contains:**
      - the press reports, with dates and sources
      - any state or local incentive applications or offers, with amounts
      - site selection filings
      - what Halvorsen has said to investors or regulators about a new line
      - Luis Arandia's public statements
      - which Halvorsen and Kestrel Row people attended the Gulf Launch Expo in Houston in March 2025 and March 2026

      The reader needs to compare when the Texas talk started with the S. 2114 vote and the award.
    - **Data:** Fetched: news, Texas and county economic development records, corporate filings. On hand: attendee lists, statements.
    - **Hard because:** reports may be rumor, and incentive talks are often confidential. The answer has to separate signs of a real plan from posturing.

12. **"Model it: Halvorsen puts the next line in Texas and Tucson shrinks. What does that do to Whitcombe vs Hayward?"** (follows 11)
    - **Goal:** Estimate how much the plant decision is worth to Whitcombe politically.
    - **A complete answer contains:** jobs lost or kept under each scenario (new line only, or new line plus a partial move out of Tucson) and where the affected workers live. It uses primary polling and constituent mail about Halvorsen and jobs, the size of the Republican primary electorate in the affected areas, and gives a range of outcomes with every assumption stated.
    - **Data:** On hand: polls, constituent mail, job counts. Fetched: county employment data, primary turnout, the primary date and, if available, the result. Simulated.
    - **Hard because:** the 2026 Arizona primary may already have happened, so the tool must check that and switch from a forecast to a counterfactual. The link from jobs to votes is indirect, which invites false precision.

13. **"halvorsen lobbying spend by quarter 2021 to 2026, every firm, what issues"**
    - **Goal:** Establish how much Halvorsen spent and when it began lobbying on this procurement.
    - **A complete answer contains:** amounts per registrant per quarter (Kestrel Row, Alder & Finch, others), including any separate Tessaly filings. It gives the issue text for each filing, flagging mentions of S. 2114, OOL, launch procurement or the solicitation number. It lists the lobbyists on each filing and the first quarter Voss appears. The reader needs to notice spikes in spending and when the bill or solicitation first appears.
    - **Data:** On hand: lobbying filings.
    - **Hard because:** amounts are rounded or given as ranges, issue text is vague, and spending is not broken down by issue.

14. **"now Meridian. who spent more on this bill and contract, and who started first"** (follows 13)
    - **Goal:** Find out whether Halvorsen's lobbying stands out or matches its rival's.
    - **A complete answer contains:** the same fields for Meridian. It gives totals for both companies over matching periods, the first quarter each mentions S. 2114 or OOL procurement, and spending through Alder & Finch, which works for both.
    - **Data:** On hand: filings. Derived: totals over matching periods.
    - **Hard because:** filings don't break spending down by issue, so "spent on this contract" can only be estimated, and the answer has to say so.

15. **"Alder & Finch has both Halvorsen and Meridian. who worked which account, and were they lobbying the same offices at the same time?"**
    - **Goal:** Check for a conflict inside the firm and how it was handled.
    - **A complete answer contains:** each Alder & Finch lobbyist, by client and by quarter, with the issues listed. It gives the quarters when both clients were on launch procurement at once, any lobbyist listed for both, and contacts with Whitcombe's office or OOL by each lobbyist and client.
    - **Data:** On hand: filings, contacts, staff directories.
    - **Hard because:** this means many people across many filings and record types. Name matching is uncertain, and any separation between the two client teams is unlikely to be documented.

16. **"who's behind Liberty Orbit Fund"**
    - **Goal:** Trace who paid for the $1.15M spent on TV for Whitcombe in 2024.
    - **A complete answer contains:**
      - the fund's donors, with amounts and dates
      - for each donor that is an LLC or a nonprofit, its owners or funders as far as records allow
      - any links to Halvorsen, Tessaly, Northgate Capital, Silas Marchetti or Kestrel Row
      - when the money came in compared with when the TV spending happened
      - signs of coordination with the campaign: shared vendors, shared staff, or ads that match campaign language

      The reader needs to know exactly where the trail stops.
    - **Data:** Fetched: the fund's campaign finance reports, state corporate records, nonprofit tax filings. On hand: independent expenditures, statements, campaign ads.
    - **Hard because:** chains of LLCs and nonprofits often end without an answer. The tool has to report that as a finding, not as a failure.

17. **"where does the Meridian protest stand? if GAO hasn't ruled, how likely is a sustain"**
    - **Goal:** Find out whether the award stands.
    - **A complete answer contains:** the protest's grounds and the docket history: agency report, comments, any corrective action, and the decision or dismissal with its date and reasoning. If nothing is final, it gives historical GAO sustain rates overall and for protests claiming an unduly restrictive or tailored requirement, and an estimate built from those rates. It also checks for any later suit at the Court of Federal Claims.
    - **Data:** On hand: the protest. Fetched: the GAO docket and decisions, annual GAO protest statistics, court records. Simulated if the protest is still open.
    - **Hard because:** GAO normally decides within 100 days. A protest filed 17 Nov 2025 should have been resolved by early 2026, so the right answer is probably a fact to fetch, not a forecast.

18. **"check her financial disclosures. any Halvorsen stock, Northgate funds, spouse income from any of these?"** (follows 1)
    - **Goal:** Find out whether Whitcombe has a personal financial stake beyond campaign money.
    - **A complete answer contains:** her holdings and their value ranges by year, transactions with dates, her spouse's employment and income sources, and liabilities. It checks for trades near the 21 May 2025 vote, the 6 Nov 2025 award and the protest. If Halvorsen is privately held, it covers indirect exposure through funds.
    - **Data:** Fetched: Senate financial disclosure reports and periodic transaction reports. On hand: career histories.
    - **Hard because:** value ranges are wide, fund holdings hide the underlying companies, and filings come in late or get amended.

19. **"For the sole-source authority in S. 2114 and the award that followed, who could have stopped it at each stage, and what did each of them actually do?"**
    - **Goal:** Find out where the outcome depended on one person and where it had broad support.
    - **A complete answer contains:** each stage, with who decides, who votes and who can block:
      - subcommittee markup
      - full committee
      - floor vote
      - appropriation
      - requirements and solicitation
      - source selection
      - protest

      For Whitcombe, Brandt, Yates, Arandia, Solheim, Kell, Okafor and Pike it gives their votes, amendments, co-sponsorships and recorded objections. For the agency stages it gives Calder and the board. It gives the margin at each vote. The reader needs to notice the stages where a single person's choice (setting the agenda, signing) counted for more than any vote.
    - **Data:** On hand: the stages of the award, votes, markups, co-sponsorships, documents.
    - **Hard because:** this covers many people across both congressional and agency stages. Procedural power leaves fewer records than votes, voice votes leave no tally, and the brief doesn't give Kell's or Okafor's party.

20. **"and if Whitcombe had recused from section 6?"** (follows 19)
    - **Goal:** Find out whether her role as chair, and not only her vote, made the difference.
    - **A complete answer contains:** the margins at markup and on the floor without her vote, and who would have chaired the markup in her place. It addresses whether that person would have included section 6 at all, using their past statements and votes. It covers Brandt's opposition and gives a range of outcomes with assumptions stated.
    - **Data:** Simulated from on-hand votes and statements. Fetched: committee rules on recusal and succession.
    - **Hard because:** votes don't capture agenda-setting power, and the substitute chair's preferences have to be inferred.

21. **"anyone else from Prescott Aeronautical?"**
    - **Goal:** Find personal ties that could explain access.
    - **A complete answer contains:** people at Halvorsen, Kestrel Row, OOL (including Calder, Voss and the board), Whitcombe's staff and Meridian who went to Prescott Aeronautical College, with graduation years. It marks overlap with Whitcombe's 1996 class, and separately covers overlap with her Air Force launch program office, 1999 to 2004. It estimates how many people in the aerospace industry attended the college, so the reader can judge whether the overlap is unusual.
    - **Data:** On hand: alumni directories, career histories, staff directories. Fetched: enrollment figures for the base rate.
    - **Hard because:** the question is vague, alumni directories are incomplete and common names collide. Without a base rate, coincidence looks like a connection.

22. **"Kestrel Row reported lobbying the Senate on S. 2114. find the matching meetings with Whitcombe's office. which quarters have nothing?"** (follows 13)
    - **Goal:** Find off-the-books contact, or confirm that the records match.
    - **A complete answer contains:** for each quarter where Kestrel Row reports Senate activity on the bill, calendar entries, emails and letters between Kestrel Row people and Whitcombe, Ferreira or other staff. It gives the quarters with reported activity and no matching record, and the reverse. It notes whether the gaps cluster around the May 2025 vote.
    - **Data:** On hand: filings, calendars, FOIA emails and letters, staff directories.
    - **Hard because:** the answer is mostly about absence. Filings usually say only "Senate", not which office, so matching is loose. Calendars may miss meetings held by staff.

23. **"how has Whitcombe explained the switch on sole source, over time"**
    - **Goal:** Find out whether her reasons stay consistent or change to fit events.
    - **A complete answer contains:** each relevant statement from 2019 to 2025, with date, venue and audience. It gives the reasons offered in each (cost, schedule, national security, Arizona jobs, reliability of "proven providers"), when each reason first appears, whether she ever addressed her 2019 position, and any mention of Halvorsen, Tucson or her time at the company. It also compares her campaign ads with her floor and hearing remarks.
    - **Data:** On hand: statements, campaign ads, press releases.
    - **Hard because:** reasons have to be pulled out of long transcripts, quotes need exact wording and dates, and interview transcripts may be partial.

24. **"is 35% on cadence normal? what do Halvorsen's and Meridian's actual launch records look like?"**
    - **Goal:** Judge whether the requirement has a defensible basis or was tailored.
    - **A complete answer contains:** launches per year for each company over recent years, with successes and failures, and which of their vehicles count under the final definition of cadence. It gives the weight cadence or similar factors received in past OOL solicitations and other agencies' launch buys, where 35% falls in that range, and how far each company is above or below the final threshold.
    - **Data:** Fetched: public launch licensing and launch records, past solicitations, federal procurement records. On hand: the draft and final solicitations.
    - **Hard because:** different solicitations define cadence differently, factors go by different names, and vehicle families complicate the counts.

25. **"Solheim's ethics referral. what does it allege, and what do our records back up or contradict?"**
    - **Goal:** Assess the referral claim by claim before reporting on it.
    - **A complete answer contains:** each allegation in the March 2026 referral, and for each, the records that support it, contradict it or say nothing. It marks claims that rest on data the tool does not hold, and says whether the referral involves Calder, Voss or Ferreira. It gives the referral's current status with the Ethics Committee.
    - **Data:** Fetched: the referral text if not on hand, and its status. On hand: contributions, filings, contacts, votes, statements, documents.
    - **Hard because:** each claim may need a different kind of record. The answer has to keep "unsupported" separate from "contradicted," and the referral may be only partly public.

## Questions grouped by information need

Some questions fall into more than one group.

- **Money in, by person and period.** Totals and individual payments, traced to their source and split by time or geography: 1, 2, 13, 14, 16, 18.
- **Order of events around a decision.** What happened before and after a vote, a solicitation change or an award, and whether the timing lines up: 2, 10, 11, 22.
- **Contact and co-presence.** Who met or communicated with whom, when and where, including physical presence in rooms and cities: 3, 9, 10, 15, 22.
- **Overlapping roles and past ties.** Career, reporting, alumni and client relationships that connect people on different sides: 4, 15, 21.
- **Changes in wording.** Differences between versions of a document, the origin of particular language, and how one person's stated reasons change over time: 5, 6, 23, 25.
- **Decision points and veto power.** Who could have changed the outcome at each stage, and what they did: 19, 20.
- **Counterfactuals and sensitivity.** Recomputing or modeling an outcome under different weights, people or events, with assumptions stated: 7, 8, 12, 17, 20.
- **Absence and uncertainty.** Answers where the main finding is a gap, a dead end or an unknown, which has to be kept apart from evidence of no activity: 3, 16, 17, 22, 25.
- **Outside benchmarks.** Facts about the wider world, used to judge whether something in the case is unusual: 11, 17, 21, 24.
