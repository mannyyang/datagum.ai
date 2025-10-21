# AI-Driven Development Life Cycle (AIDLC) Prompt Usage Instructions

## Overview
This document provides instructions on how and when to use each separated prompt in the AIDLC workflow. Each prompt is designed for specific phases of the development lifecycle and should be executed in sequence.

## Workflow Structure

### Day 1: Foundation & Discovery
**Purpose**: Establish project foundation, understand current state, and define vision

#### Prompt-01-Discovery.md
**When to Use**: Start of any new project engagement
**Prerequisites**: None
**Purpose**: Conduct technical inventory and understand customer's current SDLC environment
**Key Outputs**: 
- `/planning/discovery.md` - Complete technical inventory
- MCP integration opportunities identified
**Next Step**: Prompt-02-Project_Init.md

#### Prompt-02-Project_Init.md  
**When to Use**: After discovery is complete
**Prerequisites**: `/planning/discovery.md` exists
**Purpose**: Initialize git repository and extract project management details
**Key Outputs**:
- Git repository initialized with remote origin
- `/planning/project_management.md` - PM system configuration
- Initial commit created
**Next Step**: Prompt-03-Visioning.md

#### Prompt-03-Visioning.md
**When to Use**: After project initialization
**Prerequisites**: Project repository setup complete
**Purpose**: Define business vision and use cases through collaborative discovery
**Key Outputs**:
- `/planning/vision-usecase.md` - Clear vision statement and business outcomes
**Next Step**: Day 2 prompts

### Day 2: Inception & Planning
**Purpose**: Transform vision into actionable user stories and development units

#### Prompt-03-Inception.md
**When to Use**: After vision is established
**Prerequisites**: `/planning/vision-usecase.md` exists
**Purpose**: Convert business intent into well-defined user stories and epics
**Key Outputs**:
- `/aidlc-docs/inception/epics_and_user_stories.md` - Complete user stories with acceptance criteria
**Next Step**: Prompt-04-Stories2Units.md

#### Prompt-04-Stories2Units.md
**When to Use**: After user stories are created
**Prerequisites**: `/aidlc-docs/inception/epics_and_user_stories.md` exists with In-Scope stories
**Purpose**: Group cohesive stories into bounded contexts/development units
**Key Outputs**:
- Individual unit files in `/aidlc-docs/inception/units/` folder
- Stories status updated to "Planned"
**Next Step**: Prompt-04-SyncToPMS.md (optional)

#### Prompt-04-SyncToPMS.md
**When to Use**: When central project management system integration is required
**Prerequisites**: 
- `/aidlc-docs/inception/epics_and_user_stories.md` exists
- `/planning/project_management.md` configured
**Purpose**: Synchronize local stories/epics with central PM system
**Key Outputs**:
- `/planning/pm_system_sync.md` - Sync tracking document
- Central PM system updated
**Next Step**: Prompt-05-DomainModel.md

#### Prompt-05-DomainModel.md
**When to Use**: For each unit of work (can be done in parallel by teams)
**Prerequisites**: Unit files exist in `/aidlc-docs/inception/units/`
**Purpose**: Create domain models for specific units
**Key Outputs**:
- `model_[unit-name].md` files in `/aidlc-docs/construction/`
- Epic/story status updated to "In-Progress"

**MANDATORY: SME Review Process**

Before proceeding to Domain-to-Code, each domain model MUST be reviewed by Subject Matter Experts (SMEs). Create a review checklist for each domain:

**SME Review Requirements**:
1. **Data Models Review**:
   - [ ] Entity definitions and attributes are accurate
   - [ ] Data types and constraints are appropriate
   - [ ] Relationships between entities are correct
   - [ ] Business rules are properly captured

2. **Interface Contracts Review**:
   - [ ] API endpoints match business requirements
   - [ ] Input/output data structures are complete
   - [ ] Error handling scenarios are defined
   - [ ] Integration points with other domains are clear

3. **Business Logic Review**:
   - [ ] Domain behaviors align with business processes
   - [ ] Validation rules are comprehensive
   - [ ] Workflow states and transitions are accurate

**SME Sign-off Document**: Create `/aidlc-docs/construction/sme_review_[domain-name].md` with:
- SME name and role
- Review date
- Specific items reviewed (data models, interfaces, business logic)
- Approval status and signature
- Any concerns or modifications required

**Next Step**: Only proceed to Day 3-4 prompts after SME approval

### Day 3-4: Construction & Implementation
**Purpose**: Transform SME-approved domain models into production-ready code and infrastructure

**CRITICAL GATE**: All domain models must have SME sign-off before proceeding

#### Prompt-06-DomainToCode.md
**When to Use**: After all domain models are completed and approved
**Prerequisites**: 
- All `model_*.md` files exist in `/aidlc-docs/construction/`
- Models have been human-verified
- `/planning/discovery.md` for environment details
**Purpose**: Create production AWS CDK infrastructure from domain models

**CRITICAL: Domain-Specific Customization Required**

Before using this prompt, you MUST customize it for your specific domain:

1. **Update Plan File Path**: Change `all_domain_to_code_plan.md` to `domain_to_code_plan_[DOMAIN_NAME].md`
   - Example: `domain_to_code_plan_user_management.md`

2. **Specify Target Domain Models**: Replace the generic "all files prefixed with model_" with specific model files
   - Example: "Refer to model_user_management.md and model_authentication.md in aidlc-docs/construction/"

3. **Reference Specific Unit Stories**: Add reference to the specific unit file
   - Example: "Reference user stories from aidlc-docs/inception/units/unit-1-user-management.md"

4. **Update Epic/Story Comments**: Ensure the prompt specifies which epic/story IDs to reference in code comments
   - Example: "Always reference Epic-001 and Stories US-001 through US-005 in all related code files"

**Customization Template**:
```
Task: Refer to [SPECIFIC_MODEL_FILES] in the aidlc-docs/construction/ folder. Reference user stories from [SPECIFIC_UNIT_FILE]. You will expertly evaluate the [DOMAIN_NAME] domain model to understand interconnections and dependencies for AWS deployment. Always reference [SPECIFIC_EPIC_IDS] and [SPECIFIC_STORY_IDS] in all related code files.
```

**Key Outputs**:
- Complete AWS CDK stacks for backend infrastructure
- `/aidlc-docs/construction/ux_spec.md` - Frontend requirements
- Production-quality code with testing suites
- Working, tested deployment
**Next Step**: Prompt-07-UIToCode.md (if frontend required)

#### Prompt-07-UIToCode.md
**When to Use**: When frontend/UX development is required
**Prerequisites**: 
- `/aidlc-docs/construction/ux_spec.md` exists
- Backend infrastructure is deployed and tested
**Purpose**: Create production frontend/UX hosted on AWS
**Key Outputs**:
- Complete frontend application
- User manual for training
- Production-quality UX with testing suites

## Critical Success Factors

### Planning Requirements
- **ALWAYS** create plan files with checkboxes before execution
- Use `[Question]` and `[Answer]` tags for clarifications
- Get approval before proceeding with execution
- Mark completed steps in plan files

### Quality Standards
- **PRODUCTION QUALITY**: All code must be production-ready
- **NO MOCK DATA**: Use real data unless explicitly requested
- **TESTING REQUIRED**: Create testing suites mapping to requirements
- **MCP INTEGRATION**: Always use available MCP servers for guidance

### File Organization
```
/planning/                    # Discovery and project setup
/aidlc-docs/inception/       # User stories and units
/aidlc-docs/construction/    # Domain models and specs
```

### Status Tracking
- Stories progress: Not Started → In-Scope → Planned → In-Progress → Complete
- Always update `/aidlc-docs/inception/epics_and_user_stories.md` with current status

## Execution Guidelines

### Sequential Dependencies
1. **Day 1 must complete fully** before Day 2
2. **Domain models must be human-approved** before Prompt-06
3. **Backend must be deployed/tested** before Prompt-07

### Parallel Execution Opportunities
- Multiple teams can work on different units simultaneously (Prompt-05)
- Domain modeling can happen in parallel after units are defined
- **Domain-to-Code can be executed in parallel** by different teams using customized versions of Prompt-06 for each domain

### Environment Considerations
- Reference `/planning/discovery.md` for deployment environments
- Use preferred languages identified in discovery
- Maintain separation between frontend and backend structures

## Common Pitfalls to Avoid
- Skipping the planning phase for any prompt
- Making assumptions without using `[Question]`/`[Answer]` tags
- Proceeding without human approval of domain models
- Using mock data in production code
- Forgetting to update story statuses
- Not testing each component before moving forward

## Success Validation
Each prompt should result in:
- ✅ Plan file created and approved
- ✅ All deliverables produced as specified
- ✅ Quality standards met (production-ready, tested)
- ✅ Status tracking updated
- ✅ Prerequisites satisfied for next prompt