# Hierarchical Path System for Notes

## Overview
Notes now support a hierarchical path structure that provides precise location tracking within the information hierarchy. This allows notes to reference exact locations in a case, document, or evidence structure.

## Path Structure

### Format
Paths use dot notation to create hierarchical references:
```
category.subcategory.item.property
```

### Examples

#### Case Paths
```typescript
"case.jurisdiction.court.location.address"
"case.jurisdiction.court.name"
"case.parties.plaintiff.name"
"case.parties.plaintiff.contact.email"
"case.parties.defendant.name"
"case.parties.defendant.attorney"
```

#### Event Paths
```typescript
"case.events.hearings.motion_to_compel.title"
"case.events.hearings.motion_to_compel.date"
"case.events.hearings.motion_to_compel.summary"
"case.events.hearings.motion_to_compel.outcome"
"case.events.depositions.witness_smith.date"
"case.events.depositions.witness_smith.location"
```

#### Document Paths
```typescript
"document.motion_to_compel.title"
"document.motion_to_compel.date_filed"
"document.motion_to_compel.summary"
"document.motion_to_compel.page_count"
"document.contract.parties"
"document.contract.effective_date"
"document.contract.terms.payment"
```

#### Evidence Paths
```typescript
"evidence.bank_statements.date"
"evidence.bank_statements.amount"
"evidence.bank_statements.description"
"evidence.contracts.parties"
"evidence.contracts.date_signed"
"evidence.emails.from"
"evidence.emails.to"
"evidence.emails.date"
"evidence.emails.subject"
```

## Path References

Notes can reference other notes via their paths, creating a knowledge graph.

### Example with References
```typescript
{
  path: {
    path: "evidence.bank_statements.belongs_to",
    segments: ["evidence", "bank_statements", "belongs_to"],
    references: [
      "case.parties.plaintiff",
      "case.parties.defendant.company"
    ]
  },
  content: "Bank statements belong to plaintiff John Smith and defendant company ABC Corp"
}
```

### Document Draft References
```typescript
{
  path: {
    path: "document.motion_to_compel.drafts",
    segments: ["document", "motion_to_compel", "drafts"],
    references: [
      "document.motion_to_compel.draft_v1",
      "document.motion_to_compel.draft_v2",
      "document.motion_to_compel.draft_v3"
    ]
  }
}
```

## Complete Examples

### Example 1: Court Hearing
```json
{
  "id": "note-123",
  "content": "Motion to Compel hearing scheduled for March 15, 2024 at 2:00 PM in Courtroom 5A",
  "category": "dates",
  "path": {
    "path": "case.events.hearings.motion_to_compel.date",
    "segments": ["case", "events", "hearings", "motion_to_compel", "date"]
  },
  "context": {
    "who": ["Court", "Parties"],
    "what": "Motion to Compel hearing",
    "when": "March 15, 2024 at 2:00 PM",
    "where": "Courtroom 5A"
  }
}
```

### Example 2: Party Information
```json
{
  "id": "note-124",
  "content": "Plaintiff: John Smith, represented by Attorney Jane Doe",
  "category": "people",
  "path": {
    "path": "case.parties.plaintiff.name",
    "segments": ["case", "parties", "plaintiff", "name"]
  },
  "context": {
    "who": ["John Smith", "Jane Doe"],
    "what": "Plaintiff and attorney information"
  }
}
```

### Example 3: Evidence with References
```json
{
  "id": "note-125",
  "content": "Bank statements from Chase Bank dated January 2024, showing transfers totaling $50,000",
  "category": "other",
  "path": {
    "path": "evidence.bank_statements.amount",
    "segments": ["evidence", "bank_statements", "amount"],
    "references": [
      "case.parties.plaintiff.name",
      "case.events.hearings.motion_to_compel"
    ]
  },
  "context": {
    "what": "Financial evidence",
    "when": "January 2024",
    "where": "Chase Bank"
  }
}
```

### Example 4: Document Information
```json
{
  "id": "note-126",
  "content": "Motion to Compel Discovery filed on February 1, 2024",
  "category": "documents",
  "path": {
    "path": "document.motion_to_compel.date_filed",
    "segments": ["document", "motion_to_compel", "date_filed"]
  },
  "context": {
    "what": "Legal motion filing",
    "when": "February 1, 2024"
  }
}
```

## Path Naming Conventions

### Use Underscores
- Convert spaces to underscores: `"motion to compel"` → `"motion_to_compel"`
- Use lowercase: `"Motion to Compel"` → `"motion_to_compel"`

### Be Specific
```typescript
// Good
"case.events.hearings.motion_to_compel.date"

// Too generic
"case.events.date"
```

### Use Hierarchies
```typescript
// Good - shows hierarchy
"case.parties.plaintiff.contact.email"

// Bad - flat structure
"plaintiff_email"
```

## API Integration

### analyze-document API
The API now generates paths automatically:

```typescript
POST /api/analyze-document
{
  "text": "Motion to Compel...",
  "fileName": "motion_to_compel.pdf"
}

// Response includes paths:
{
  "notes": [
    {
      "content": "Hearing date: March 15, 2024",
      "path": {
        "path": "case.events.hearings.motion_to_compel.date",
        "segments": ["case", "events", "hearings", "motion_to_compel", "date"]
      }
    }
  ]
}
```

## UI Display

### Notes View
Paths are displayed in blue monospace font:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Motion to Compel hearing on March 15, 2024

Path: case.events.hearings.motion_to_compel.date
References: case.parties.plaintiff, case.jurisdiction.court

Who: Court, Parties
What: Motion to Compel hearing
When: March 15, 2024 at 2:00 PM
Where: Courtroom 5A
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Benefits

### 1. Precise Location Tracking
Know exactly where information belongs in the hierarchy.

### 2. Cross-Referencing
Notes can reference other notes via paths, creating relationships.

### 3. Queryable Structure
Easy to find all notes related to a specific path:
```typescript
notes.filter(n => n.path?.path.startsWith("case.parties.plaintiff"))
```

### 4. Knowledge Graph
Build a complete knowledge graph from note relationships.

### 5. Backward Compatible
Legacy notes with only `context` still work. New notes get both.

## Use Cases

### Case Management
```
case.
├── jurisdiction.
│   ├── court.name
│   ├── court.location
│   └── judge.name
├── parties.
│   ├── plaintiff.name
│   ├── plaintiff.attorney
│   ├── defendant.name
│   └── defendant.attorney
└── events.
    ├── hearings.
    │   ├── motion_to_compel.date
    │   └── motion_to_compel.outcome
    └── depositions.
        └── witness_smith.date
```

### Document Analysis
```
document.contract.
├── title
├── date_signed
├── parties.[plaintiff, defendant]
├── terms.
│   ├── payment
│   ├── duration
│   └── termination
└── exhibits.[exhibit_a, exhibit_b]
```

### Evidence Tracking
```
evidence.
├── bank_statements.
│   ├── date
│   ├── amount
│   └── belongs_to → [case.parties.plaintiff]
├── contracts.
│   ├── parties
│   └── date_signed
└── emails.
    ├── from
    ├── to
    └── date
```

## Future Enhancements

1. **Visual Path Browser**: Navigate notes as a tree structure
2. **Auto-linking**: Automatically create references between related notes
3. **Path Validation**: Ensure paths follow consistent structure
4. **Path Templates**: Predefined path structures for different case types
5. **Path Search**: Search notes by path patterns
6. **Path Export**: Export note hierarchy as JSON/XML
