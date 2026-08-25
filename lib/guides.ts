export type GuideSection = { heading: string; paragraphs: string[]; bullets?: string[] };

export type BuyerGuide = {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  searchIntent: string;
  readTime: string;
  updated: string;
  sections: GuideSection[];
  sources: { label: string; href: string }[];
  related: string[];
};

const sbaPlan = { label: "U.S. Small Business Administration: Buy an existing business or franchise", href: "https://www.sba.gov/business-guide/plan-your-business/buy-existing-business-or-franchise" };
const sbaLoans = { label: "U.S. Small Business Administration: 7(a) loan program", href: "https://www.sba.gov/funding-programs/loans/7a-loans" };
const irsEIN = { label: "Internal Revenue Service: Employer identification numbers", href: "https://www.irs.gov/businesses/small-businesses-self-employed/employer-id-numbers" };
const ftcFranchise = { label: "Federal Trade Commission: Franchise Rule compliance guide", href: "https://www.ftc.gov/business-guidance/resources/franchise-rule-compliance-guide" };

export const buyerGuides: BuyerGuide[] = [
  {
    slug: "how-to-buy-a-business",
    title: "How to Buy a Small Business: A Beginner’s Step-by-Step Guide",
    shortTitle: "How to buy a business",
    description: "A practical 12-step guide to finding, evaluating, financing, and purchasing an existing small business for the first time.",
    searchIntent: "Complete beginner guide",
    readTime: "14 min read",
    updated: "August 25, 2026",
    sections: [
      { heading: "1. Define the business you can realistically own", paragraphs: ["Begin with your available cash, desired income, location, transferable skills, and the number of hours you can commit. A profitable company can still be a poor fit if it depends on expertise, licenses, travel, or owner involvement you cannot provide."], bullets: ["Set an affordable purchase-price range and reserve cash for working capital.", "Choose industries you understand or can learn with qualified support.", "Decide whether you want an owner-operated, manager-run, local, or remote business."] },
      { heading: "2. Find businesses and screen the basic facts", paragraphs: ["Review broker listings, direct-owner opportunities, industry networks, and local advisers. Treat every advertisement as an introduction—not verified financial evidence. Compare asking price, revenue, seller’s discretionary earnings or EBITDA, location, reason for sale, customer concentration, and the owner’s role."], bullets: ["Confirm what is included in the sale.", "Record the source and date for every important number.", "Reject opportunities that conflict with your non-negotiable requirements."] },
      { heading: "3. Contact the seller and protect confidential information", paragraphs: ["A broker or seller will usually ask about your background, available funds, and acquisition criteria before releasing sensitive information. Read an NDA carefully before signing it. Understand what is confidential, how long the restriction lasts, and whether it limits contact with employees, customers, or suppliers."] },
      { heading: "4. Understand the financial story", paragraphs: ["Request at least three years of tax returns, profit-and-loss statements, balance sheets, and cash-flow information, plus current year-to-date results. Reconcile the records and separate documented earnings from proposed adjustments. Look for trends, one-time items, working-capital needs, debt, deferred maintenance, and revenue that may disappear after closing."], bullets: ["Compare tax returns with internal statements and bank activity.", "Test add-backs instead of accepting them automatically.", "Calculate normalized cash flow, debt-service coverage, and a downside case."] },
      { heading: "5. Value the business and plan financing", paragraphs: ["Use more than one valuation method. Small owner-operated companies are often discussed as a multiple of normalized seller’s discretionary earnings; larger companies may be evaluated using EBITDA, assets, or discounted cash flow. The correct multiple depends on quality, risk, growth, transferability, and comparable transactions—not a universal rule.", "Financing may combine buyer cash, an SBA-backed loan, seller financing, conventional debt, or outside equity. Model the loan payment, working capital, closing costs, and a reasonable personal reserve before submitting an offer."] },
      { heading: "6. Submit an LOI and complete due diligence", paragraphs: ["A letter of intent usually records the proposed price, structure, financing assumptions, exclusivity, timeline, and major conditions while leaving most terms nonbinding. After acceptance, due diligence should verify financial, legal, tax, operational, commercial, technology, employee, insurance, and environmental matters relevant to the company."], bullets: ["Assign every request an owner, due date, and status.", "Document unresolved issues and their possible financial impact.", "Use qualified legal, accounting, insurance, and lending advisers where appropriate."] },
      { heading: "7. Negotiate, close, and prepare the transition", paragraphs: ["Resolve whether the transaction is an asset or equity purchase, finalize working-capital and inventory treatment, document seller financing, confirm licenses and third-party consents, and agree on transition assistance. Do not wait until closing day to plan access to banking, payroll, vendors, systems, customers, and employees.", "The purchase is the start of ownership. Build a 30-, 60-, and 90-day plan that protects cash, service quality, employee trust, and customer relationships."] },
    ],
    sources: [sbaPlan, sbaLoans, irsEIN],
    related: ["business-due-diligence-checklist", "how-to-value-a-small-business", "how-to-finance-a-business-purchase"],
  },
  {
    slug: "buying-a-business-for-beginners",
    title: "Buying a Business for Beginners: What First-Time Buyers Should Know",
    shortTitle: "Beginner’s starting guide",
    description: "Learn what buying an existing business involves, how long it can take, who helps, and the mistakes first-time buyers should avoid.",
    searchIntent: "First-time buyer basics",
    readTime: "9 min read",
    updated: "August 25, 2026",
    sections: [
      { heading: "Buying is a process, not one decision", paragraphs: ["A business purchase moves through search, initial screening, confidentiality, financial review, valuation, financing, an offer, due diligence, definitive agreements, closing, and transition. Some steps overlap, and a buyer should be prepared to stop when important facts cannot be verified."], bullets: ["Listings are marketing materials, not proof.", "Cash flow and transferability matter more than revenue alone.", "Your ability to operate the company is part of the investment decision."] },
      { heading: "Know your buying range before searching", paragraphs: ["Your range is not simply the cash in your account. Consider the likely down payment, lender requirements, professional fees, closing costs, working capital, planned improvements, and a personal reserve. Avoid committing every available dollar to the purchase price."] },
      { heading: "Build a small adviser team", paragraphs: ["A transaction may require a business attorney, accountant, lender, insurance adviser, and industry specialist. Brokers facilitate many transactions, but understand whom each professional represents and how each is paid."] },
      { heading: "Use a consistent screening scorecard", paragraphs: ["Compare opportunities using the same criteria: earnings quality, customer concentration, recurring revenue, owner dependence, employee stability, capital expenditure, legal exposure, growth, and personal fit. Consistency reduces the chance that an exciting listing overrides your original goals."] },
      { heading: "Common first-time buyer mistakes", paragraphs: ["Frequent problems include trusting unverified add-backs, underestimating working capital, ignoring lease or licensing issues, assuming employees will stay, skipping a downside model, and focusing on closing rather than the first 100 days of ownership."] },
    ],
    sources: [sbaPlan, sbaLoans],
    related: ["how-to-buy-a-business", "questions-to-ask-when-buying-a-business", "how-much-money-do-you-need-to-buy-a-business"],
  },
  {
    slug: "business-due-diligence-checklist",
    title: "Business Due Diligence Checklist for Buyers",
    shortTitle: "Due diligence checklist",
    description: "A structured checklist for verifying a small business’s financial, legal, operational, commercial, employee, and technology information.",
    searchIntent: "Due diligence template",
    readTime: "12 min read",
    updated: "August 25, 2026",
    sections: [
      { heading: "Financial records", paragraphs: ["Request enough evidence to reconcile reported earnings and understand cash needs."], bullets: ["Three to five years of tax returns, income statements, balance sheets, and cash-flow statements.", "Current year-to-date statements and the comparable prior-year period.", "Bank statements, accounts receivable and payable aging, inventory, debt, and capital-expenditure history.", "A schedule and support for every proposed owner add-back or normalization."] },
      { heading: "Legal, ownership, and tax", paragraphs: ["Have qualified advisers confirm the seller’s authority to transact and identify obligations that could follow the assets or entity."], bullets: ["Formation documents, ownership records, permits, licenses, contracts, leases, liens, litigation, claims, and regulatory correspondence.", "Federal, state, payroll, and sales-tax filings and notices.", "Intellectual property, privacy obligations, and required third-party consents."] },
      { heading: "Operations and commercial quality", paragraphs: ["Determine whether the company’s revenue and operating capability will transfer after the owner exits."], bullets: ["Top customers and suppliers, contract terms, concentration, churn, pipeline, pricing, and competitive position.", "Employee roster, compensation, tenure, benefits, classification, key-person risk, and retention concerns.", "Equipment condition, facilities, maintenance, insurance claims, systems, cybersecurity, and business continuity."] },
      { heading: "Turn findings into decisions", paragraphs: ["A checklist is useful only when exceptions affect the deal. Assign each item a status, evidence source, reviewer, and due date. Classify unresolved issues as informational, a closing condition, a price or structure adjustment, a post-close action, or a reason to withdraw."] },
      { heading: "What the checklist cannot replace", paragraphs: ["The scope changes by industry, state, transaction structure, and company size. Use legal, tax, accounting, environmental, insurance, lending, and technical professionals when the issue requires licensed or specialized judgment."] },
    ],
    sources: [sbaPlan, irsEIN],
    related: ["how-to-buy-a-business", "questions-to-ask-when-buying-a-business", "asset-purchase-vs-stock-purchase"],
  },
  {
    slug: "how-to-value-a-small-business",
    title: "How to Value a Small Business Before You Buy It",
    shortTitle: "Small-business valuation",
    description: "Understand SDE, EBITDA, valuation multiples, asset value, working capital, and the risks that change what a small business may be worth.",
    searchIntent: "Business valuation explanation",
    readTime: "10 min read",
    updated: "August 25, 2026",
    sections: [
      { heading: "Start with normalized earnings", paragraphs: ["Seller’s discretionary earnings generally begins with pre-tax profit and adds back one owner’s compensation, interest, depreciation and amortization, and supportable nonrecurring or discretionary expenses. EBITDA is more common when the company supports a professional management structure. Neither measure should include unsupported adjustments."], bullets: ["Trace the starting profit to financial statements and tax returns.", "Require documentation for every add-back.", "Deduct the market cost of management if the buyer will not replace the owner."] },
      { heading: "Apply a multiple that reflects risk", paragraphs: ["A multiple is a shorthand for expected return, growth, and risk. Recurring revenue, diversified customers, clean records, stable employees, low owner dependence, and defensible market position can support a stronger result. Concentration, volatile earnings, deferred investment, legal exposure, and weak transferability can reduce it."] },
      { heading: "Cross-check with other methods", paragraphs: ["Compare the earnings approach with asset value, comparable transactions where reliable data exists, and a cash-flow model. Asset-heavy or distressed companies may be driven more by adjusted net assets. A forecast is only as reliable as its assumptions."] },
      { heading: "Price is not the whole deal", paragraphs: ["Working capital, inventory, assumed debt, seller notes, earnouts, real estate, transaction costs, and tax structure can materially change economics. Define what is included and model the cash required at closing separately from the headline price."] },
      { heading: "Use a downside case", paragraphs: ["Recalculate value and debt coverage if revenue falls, margins compress, a major customer leaves, or the owner must be replaced at market compensation. A purchase should not depend on a perfect first year."] },
    ],
    sources: [sbaPlan, sbaLoans],
    related: ["how-to-finance-a-business-purchase", "how-much-money-do-you-need-to-buy-a-business", "business-due-diligence-checklist"],
  },
  {
    slug: "how-to-finance-a-business-purchase",
    title: "How to Finance a Business Purchase",
    shortTitle: "Business acquisition financing",
    description: "Compare SBA-backed lending, conventional loans, seller financing, buyer equity, and outside investors when purchasing a small business.",
    searchIntent: "Acquisition financing options",
    readTime: "9 min read",
    updated: "August 25, 2026",
    sections: [
      { heading: "Common sources of acquisition capital", paragraphs: ["Many purchases use a combination of buyer equity and debt. Options may include an SBA-backed loan made by a participating lender, a conventional bank loan, seller financing, outside equity, or—in limited circumstances—specialized financing structures."], bullets: ["Buyer equity shows commitment and reduces borrowed funds.", "Seller financing can align incentives but must be documented carefully.", "Outside equity reduces debt but shares ownership and control."] },
      { heading: "What lenders evaluate", paragraphs: ["A lender typically evaluates historical cash flow, debt-service capacity, the buyer’s experience and credit, collateral where applicable, the business plan, purchase terms, and the quality of financial records. Requirements vary by lender and program."] },
      { heading: "Model the complete cash need", paragraphs: ["Include the down payment, lender and professional fees, working capital, inventory adjustments, repairs, technology, insurance, deposits, and personal reserves. A deal can be financeable yet still leave the new owner undercapitalized."] },
      { heading: "Prepare a lender-ready package", paragraphs: ["Organize buyer financial information, resume, acquisition criteria, seller statements and tax returns, purchase agreement or LOI, debt schedule, projections with assumptions, and an explanation of management and transition plans. Keep reported figures consistent across every document."] },
      { heading: "Compare terms, not just rates", paragraphs: ["Review amortization, maturity, collateral, guarantees, covenants, prepayment terms, required reserves, closing conditions, and permitted seller financing. Ask each lender to explain the expected timeline and documents."] },
    ],
    sources: [sbaLoans, sbaPlan],
    related: ["sba-loan-to-buy-a-business", "how-much-money-do-you-need-to-buy-a-business", "how-to-value-a-small-business"],
  },
  {
    slug: "sba-loan-to-buy-a-business",
    title: "Using an SBA 7(a) Loan to Buy a Business",
    shortTitle: "SBA loans for acquisitions",
    description: "A plain-language overview of how SBA 7(a) financing may be used for a business acquisition and what buyers should prepare.",
    searchIntent: "SBA acquisition loan",
    readTime: "8 min read",
    updated: "August 25, 2026",
    sections: [
      { heading: "What an SBA 7(a) loan is", paragraphs: ["The SBA does not ordinarily lend the acquisition money directly. It provides a guaranty to approved lenders under program rules. Eligible uses can include changes of ownership, working capital, equipment, and real estate, subject to the lender’s approval and current SBA requirements."] },
      { heading: "Eligibility is only the beginning", paragraphs: ["The business and transaction must meet program requirements, but the lender also makes a credit decision. Expect review of repayment ability, equity injection, buyer qualifications, purchase terms, valuation, projections, and available collateral under applicable rules."] },
      { heading: "Documents buyers should prepare", paragraphs: ["Prepare personal financial statements, tax returns, a resume, ownership information, a business plan, projections and assumptions, purchase documents, and requested information about affiliates. The seller typically provides historical business financials, tax returns, debt, contracts, and operational information."] },
      { heading: "Questions to ask participating lenders", paragraphs: ["Ask about acquisition experience, expected equity contribution, treatment of seller notes, valuation process, collateral and guarantee requirements, estimated timeline, fees, and the specific documents needed for an initial assessment."] },
      { heading: "Verify current requirements", paragraphs: ["SBA rules and lender practices change. Confirm current terms directly with the SBA and participating lender before relying on any estimate or structuring a transaction."] },
    ],
    sources: [sbaLoans, sbaPlan],
    related: ["how-to-finance-a-business-purchase", "how-much-money-do-you-need-to-buy-a-business", "how-to-buy-a-business"],
  },
  {
    slug: "questions-to-ask-when-buying-a-business",
    title: "Questions to Ask When Buying a Business",
    shortTitle: "Questions for sellers and brokers",
    description: "Use these questions to understand why a business is for sale, how it earns money, what depends on the owner, and which risks require verification.",
    searchIntent: "Seller interview questions",
    readTime: "8 min read",
    updated: "August 25, 2026",
    sections: [
      { heading: "Reason for sale and transaction expectations", paragraphs: ["Ask why the owner is selling now, what a successful transaction looks like, what is included, whether real estate is involved, what transition support is available, and whether the seller would consider financing. Verify important answers through documents and third parties."] },
      { heading: "Customers, revenue, and competition", paragraphs: ["Ask how customers are acquired and retained, which relationships depend on the owner, whether contracts are transferable, how pricing is set, why customers leave, what has changed recently, and how concentrated revenue is among the largest customers."] },
      { heading: "Operations and employees", paragraphs: ["Ask what the owner does each week, who makes critical decisions, which employees are essential, what positions are open, which licenses are required, what maintenance has been deferred, and which systems or informal processes could fail during transition."] },
      { heading: "Financial performance", paragraphs: ["Ask what explains revenue and margin trends, how add-backs were calculated, which expenses may rise under new ownership, what working capital is normally required, whether inventory is current, and what major capital spending is expected."] },
      { heading: "Turn answers into follow-up requests", paragraphs: ["Record each answer, its source, and the evidence needed. A confident verbal answer is not a substitute for contracts, statements, filings, customer data, or other appropriate verification."] },
    ],
    sources: [sbaPlan],
    related: ["business-due-diligence-checklist", "nda-when-buying-a-business", "letter-of-intent-business-purchase"],
  },
  {
    slug: "letter-of-intent-business-purchase",
    title: "Letter of Intent for a Business Purchase: What Buyers Should Understand",
    shortTitle: "Business purchase LOI",
    description: "Learn what a letter of intent commonly covers, which provisions may be binding, and what buyers should settle before due diligence.",
    searchIntent: "LOI overview",
    readTime: "8 min read",
    updated: "August 25, 2026",
    sections: [
      { heading: "Purpose of an LOI", paragraphs: ["A letter of intent records the parties’ current understanding before they invest heavily in diligence and definitive documents. It can surface disagreements about economics, structure, timing, and access early, but it is not a substitute for a purchase agreement."] },
      { heading: "Terms commonly addressed", paragraphs: ["An LOI may cover price, asset or equity structure, included and excluded items, working capital, financing assumptions, seller notes or earnouts, transition support, due-diligence access, closing conditions, target dates, and responsibility for expenses."] },
      { heading: "Binding and nonbinding provisions", paragraphs: ["Some provisions may be expressly binding even when the proposed acquisition is not. Confidentiality, exclusivity, access, expenses, governing law, and publicity are common examples. Labels alone may not resolve every legal question, so obtain transaction counsel before signing."] },
      { heading: "Avoid false precision", paragraphs: ["State assumptions behind the price, including the earnings period, cash and debt treatment, inventory, working capital, and expected transaction form. If a material fact remains unknown, identify it as a diligence item or condition rather than silently assuming the best outcome."] },
      { heading: "Prepare for the next phase", paragraphs: ["Attach or promptly issue a prioritized diligence request list, establish a secure document process, assign advisers, and agree on communication. Exclusivity time should match the work realistically required."] },
    ],
    sources: [sbaPlan],
    related: ["nda-when-buying-a-business", "asset-purchase-vs-stock-purchase", "business-due-diligence-checklist"],
  },
  {
    slug: "nda-when-buying-a-business",
    title: "NDA When Buying a Business: A Buyer’s Practical Guide",
    shortTitle: "NDA for a business purchase",
    description: "Understand why sellers require confidentiality agreements and what buyers should review before receiving sensitive business information.",
    searchIntent: "Acquisition NDA overview",
    readTime: "7 min read",
    updated: "August 25, 2026",
    sections: [
      { heading: "Why sellers use NDAs", paragraphs: ["A potential sale can expose customer, employee, supplier, pricing, financial, and strategic information. An NDA sets rules for using and protecting that information while the buyer evaluates the opportunity."] },
      { heading: "Terms to review", paragraphs: ["Review the definition of confidential information, permitted purpose, who may receive it, security expectations, compelled-disclosure process, return or destruction duties, duration, remedies, and exclusions for information already known or independently developed."] },
      { heading: "Contact restrictions", paragraphs: ["Many sellers prohibit contacting employees, customers, suppliers, landlords, or other parties without permission. Follow the agreed communication process; an unauthorized call can damage the business and the transaction."] },
      { heading: "Share only with authorized advisers", paragraphs: ["Confirm whether the NDA permits disclosure to lenders, attorneys, accountants, investors, and other representatives, and whether you are responsible for their compliance. Use secure storage and limit access to people who need the information."] },
      { heading: "Get legal advice when needed", paragraphs: ["Non-solicitation, standstill, residual-knowledge, broad indemnity, or unusual remedy provisions may create obligations beyond ordinary confidentiality. A business attorney can explain how the document applies to your circumstances."] },
    ],
    sources: [sbaPlan],
    related: ["questions-to-ask-when-buying-a-business", "letter-of-intent-business-purchase", "business-due-diligence-checklist"],
  },
  {
    slug: "asset-purchase-vs-stock-purchase",
    title: "Asset Purchase vs. Stock Purchase for a Small Business",
    shortTitle: "Asset vs. equity purchase",
    description: "A beginner-friendly explanation of how asset and equity business purchases differ in ownership, liabilities, contracts, taxes, and closing mechanics.",
    searchIntent: "Deal structure comparison",
    readTime: "9 min read",
    updated: "August 25, 2026",
    sections: [
      { heading: "Asset purchase", paragraphs: ["In an asset transaction, the buyer acquires specified assets and assumes specified liabilities. The parties must identify equipment, inventory, contracts, intellectual property, records, permits, and other transferred items. Some contracts, licenses, and relationships may require consent or cannot be transferred automatically."] },
      { heading: "Equity purchase", paragraphs: ["In an equity transaction, the buyer acquires ownership interests in the legal entity. The entity generally continues to own its assets and remain party to its contracts, but change-of-control provisions may still apply. The buyer also inherits the entity’s history and needs careful diligence and contractual protection."] },
      { heading: "Liability and operational continuity", paragraphs: ["Asset purchases may help define assumed obligations, but they do not eliminate every possible successor, tax, employment, environmental, or other liability. Equity purchases may preserve continuity but can carry unknown obligations. The real result depends on law, facts, documentation, and industry rules."] },
      { heading: "Tax and purchase-price allocation", paragraphs: ["Structure affects buyer basis, seller tax consequences, depreciation and amortization, and reporting. Asset transactions usually require an allocation of purchase price among transferred categories. Both parties should obtain tax advice before agreeing to economics that depend on structure."] },
      { heading: "Choose structure with advisers", paragraphs: ["Compare legal exposure, contracts, licenses, tax effects, financing, administrative work, and negotiation leverage. Do not select a structure from a generic rule of thumb."] },
    ],
    sources: [sbaPlan, irsEIN],
    related: ["letter-of-intent-business-purchase", "business-due-diligence-checklist", "how-to-buy-a-business"],
  },
  {
    slug: "how-much-money-do-you-need-to-buy-a-business",
    title: "How Much Money Do You Need to Buy a Business?",
    shortTitle: "Estimate your buying budget",
    description: "Estimate the down payment, closing costs, working capital, reserves, and debt coverage involved in purchasing an existing business.",
    searchIntent: "Business purchase budget",
    readTime: "8 min read",
    updated: "August 25, 2026",
    sections: [
      { heading: "Separate purchase price from cash required", paragraphs: ["The asking price is not the same as the cash you need. Your closing requirement may include equity contribution, professional and lender fees, working-capital adjustments, inventory, deposits, insurance, repairs, technology, and initial payroll. Keep a separate personal reserve."] },
      { heading: "Estimate debt capacity", paragraphs: ["Debt capacity depends on verified normalized cash flow and lender requirements. Calculate annual principal and interest and compare it with cash flow available for debt service. Then repeat the calculation using a downside case rather than assuming growth begins immediately."] },
      { heading: "Plan for working capital", paragraphs: ["A profitable business can run short of cash because customers pay slowly, inventory must be purchased, payroll arrives before collections, or seasonal expenses peak. Review monthly patterns and define the normal level of working capital included at closing."] },
      { heading: "Budget for professional work", paragraphs: ["Depending on complexity, buyers may need legal, accounting, quality-of-earnings, valuation, environmental, insurance, technology, licensing, and lender support. Estimate these costs before signing an LOI with an unrealistic closing budget."] },
      { heading: "Use ranges before lender review", paragraphs: ["Online calculators are planning tools, not loan approvals. Use conservative ranges to decide which opportunities merit attention, then obtain current requirements and terms from lenders and qualified advisers."] },
    ],
    sources: [sbaLoans, sbaPlan],
    related: ["how-to-finance-a-business-purchase", "sba-loan-to-buy-a-business", "how-to-value-a-small-business"],
  },
];

export function getGuide(slug: string) {
  return buyerGuides.find((guide) => guide.slug === slug);
}
