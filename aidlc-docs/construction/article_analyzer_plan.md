# Article Analyzer Domain Model - Planning Document

**Feature**: AI-Powered Article Visibility Analyzer
**Created**: 2025-10-20
**Status**: Planning Phase

---

## Clarifying Questions

Before proceeding with the domain model design, I need clarification on the following:

### [Question 1] User Stories and Epics
Should I first create user stories/epics for the Article Analyzer feature, or should I extract/derive them from the reference document `DOMAIN_MODEL_ARTICLE_ANALYZER.md`?

**[Answer]**
I recommend extracting/deriving user stories and epics from the reference document `DOMAIN_MODEL_ARTICLE_ANALYZER.md`. This ensures alignment with the overall vision and requirements outlined in the document.

### [Question 2] Scope and Unit Breakdown
What should be the scope for this domain model? Options:
- A) Full Article Analyzer feature in a single domain model
- B) Break into smaller units (e.g., Unit 1: Submission & Scraping, Unit 2: AI Analysis, Unit 3: Results Display)

**[Answer]**
I recommend breaking the Article Analyzer feature into smaller units. This modular approach allows for easier development, testing, and maintenance. Each unit can focus on a specific aspect of the feature, making it more manageable.

### [Question 3] Main Page Route
Should the main page route be:
- A) `/` (root/homepage of datagum.ai)
- B) `/analyze` (as described in the reference document)

**[Answer]**
root/homepage of datagum.ai (`/`) is recommended for the main page route. This provides a more user-friendly and memorable URL for users accessing the Article Analyzer feature.

### [Question 4] Deployment Target
Confirm deployment target:
- Cloudflare Workers (via @opennextjs/cloudflare) - as currently configured
- Is this correct?

**[Answer]**
yes

### [Question 5] Background Job Processing
For background job processing (article scraping, AI analysis), which approach:
- A) Cloudflare Queues (recommended for Cloudflare Workers)
- B) Simple database-based queue with polling
- C) Cloudflare Cron Triggers

**[Answer]**
I recommend using Cloudflare Queues (Option A) for background job processing. This approach is well-suited for Cloudflare Workers and can efficiently handle the asynchronous nature of tasks like article scraping and AI analysis.

---

## Implementation Plan

### Phase 1: Requirements & Design
- [x] Get answers to clarifying questions above
- [x] Extract/create user stories from reference document
- [x] Define epics and stories in `planning/epics_and_user_stories.md`
- [x] Identify core components and their responsibilities

**Phase 1 Complete**: 2025-10-20
- Created 7 epics with 25 user stories
- Broke down into 6 logical units for modular development
- All questions answered and approach confirmed

### Phase 2: Domain Model Creation
- [x] Design domain components (entities, services, utilities)
- [x] Define component attributes and data structures
- [x] Define component behaviors and methods
- [x] Document component interactions and workflows
- [x] Write domain models to `aidlc-docs/construction/model_unit*.md` files

**Phase 2 Complete**: 2025-10-20
- Created 6 comprehensive domain model files (one per unit)
- Defined 30+ components across all units
- Documented data flows, interactions, and behaviors
- Included deployment considerations for Cloudflare Workers
- No code generation - pure domain model design

**Domain Models Created**:
1. `model_unit1_submission_validation.md` - URL submission and validation (6 components)
2. `model_unit2_article_scraping.md` - Content extraction (6 components)
3. `model_unit3_question_generation.md` - AI question generation (5 components)
4. `model_unit4_search_testing.md` - AI search visibility testing (6 components)
5. `model_unit5_results_display.md` - Results UI and API (7 components)
6. `model_unit6_job_processing.md` - Background job orchestration (5 components)

### Phase 3: Documentation
- [ ] Create database schema definition (Drizzle ORM format)
- [ ] Document API endpoint contracts
- [ ] Define service interfaces
- [ ] Document error handling strategies
- [ ] Add deployment considerations

### Phase 4: Status Tracking
- [ ] Update epic/story status to "in-progress"
- [ ] Create changelog entry

---

## Domain Model Scope (To be filled after Q&A)

### Components to Model
- [ ] Article Submission Component
- [ ] Article Scraper Service
- [ ] Question Generator Service
- [ ] AI Search Tester Service
- [ ] Background Job Processor
- [ ] Results Aggregation Service
- [ ] API Layer (Submit, Results endpoints)
- [ ] Frontend Components (Landing Page, Results Page)

### Data Structures
- [ ] Submission entity
- [ ] Analysis Result entity
- [ ] Job entity
- [ ] Citation and Source structures

### Business Logic Flows
- [ ] URL submission and validation flow
- [ ] Rate limiting logic
- [ ] Background job execution flow
- [ ] Results polling and aggregation flow
- [ ] Error handling and retry logic

---

## Notes
- Following AI DLC Domain Modelling guidelines from `AI DLC/Day2/Prompt-06-DomainModel.md`
- Reference document: `DOMAIN_MODEL_ARTICLE_ANALYZER.md` (comprehensive implementation guide)
- Tech stack: Next.js 15, Cloudflare Workers, Neon PostgreSQL, Drizzle ORM
- No architectural diagrams or code generation - domain model design only

---

## Next Steps
1. Wait for user to answer clarifying questions above
2. Upon receiving answers, proceed with domain model creation
3. Update this plan file with progress checkboxes
