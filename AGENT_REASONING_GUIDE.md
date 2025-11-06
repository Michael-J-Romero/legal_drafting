# Agent Reasoning & Inner Dialogue Guide

This guide explains the enhanced agent capabilities that make your chat act more like GitHub Copilot Agent or ChatGPT Deep Research with **iterative reasoning**.

## Overview

The planning agent demonstrates advanced reasoning capabilities with transparent "inner dialogue" and structured thinking processes. The reasoning approach adapts based on the AI model being used to provide optimal performance.

## Model-Specific Behavior

### Standard Models (GPT-4o, GPT-4 Turbo, GPT-3.5)

These models use an **explicit multi-phase approach** with visible reasoning steps, making the thought process transparent through structured phases.

### Reasoning Models (o1, o1-preview, o1-mini)

These models leverage **native reasoning capabilities** and work more efficiently with:
- Streamlined prompts that don't force specific phases
- Higher turn limits (50 vs 25) to accommodate internal reasoning
- Natural integration of research and tool usage
- More efficient token usage
- Elimination of "max turns exceeded" errors

The system automatically detects your selected model and applies the appropriate strategy.

## Key Features (Standard Models)

### 1. Iterative Reasoning Process

The agent makes its thought process visible through **five distinct phases** with automatic iteration:

#### 🤔 **THINKING Phase**
- **Purpose**: Planning and analysis
- **What you see**: 
  - Problem breakdown
  - Approach planning
  - Decision-making rationale
  - Assumption questioning
- **Example**: "To answer this question, I need to: 1) Understand X, 2) Research Y, 3) Compare Z. My approach will be..."

#### 🔍 **RESEARCH Phase**
- **Purpose**: Data gathering and exploration
- **What you see**:
  - Search queries being executed
  - URLs being browsed
  - Reasons for each research step
  - Key findings as they're discovered
- **Example**: "Searching for 'latest AI developments' to get current information... Found 5 sources, examining URLs A and B..."

#### 🧐 **REFLECTION Phase** (NEW - Critical for Iteration)
- **Purpose**: Self-assessment and gap analysis
- **What you see**:
  - Confidence level (0-100%)
  - Information gaps identified
  - Logic hole detection
  - Decision to research more or proceed
  - New relevant angles discovered
- **Example**: "Confidence: 65%. Missing information: Need more on recent developments from 2024. Potential issues: Sources conflict on timeline. Need more research: Yes, searching for 2024-specific data..."
- **Iteration**: If confidence < 85% or gaps exist, agent returns to RESEARCH phase

#### 💡 **SYNTHESIS Phase**
- **Purpose**: Analysis and pattern recognition (only after sufficient confidence)
- **What you see**:
  - Information organization
  - Pattern identification
  - Connection between findings
  - Credibility assessment
  - Final logic hole check
- **Example**: "Based on my research: Theme 1 emerges from sources A and C. Theme 2 contradicts earlier findings but is resolved by source D..."

#### ✅ **ANSWER Phase**
- **Purpose**: Final comprehensive response
- **What you see**:
  - Structured, clear answer
  - Proper citations with URLs
  - Final confidence level
  - Acknowledgment of any remaining limitations
- **Example**: "Based on comprehensive research across 8 sources (Confidence: 92%), here's what I found... [structured response with citations]"

### 2. Visual Indicators

Each phase is color-coded in the UI for easy navigation:
- **Yellow background**: Thinking/Planning
- **Blue background**: Research/Data gathering
- **Pink background**: Reflection/Confidence checking (NEW)
- **Purple background**: Synthesis/Analysis
- **Green background**: Final answer/Conclusion

### 3. Iterative Loop

The agent **automatically iterates** between RESEARCH and REFLECTION phases:
- After each research action, the agent reflects on confidence and gaps
- If confidence < 85% or information gaps exist, it returns to RESEARCH
- This loop continues until the agent is confident it has a solid answer
- You'll see multiple RESEARCH → REFLECTION cycles for complex queries
- The agent will note when new relevant information is discovered mid-research

### 4. Inner Dialogue

The agent demonstrates human-like reasoning by:
- **Questioning assumptions**: "Should I focus on recent data or historical trends?"
- **Considering alternatives**: "I could search for X, but Y might be more relevant because..."
- **Being transparent about uncertainty**: "The sources conflict on this point, suggesting..."
- **Explaining decisions**: "I'm choosing to browse this URL because it's from a reputable source..."
- **Assessing confidence**: "Confidence: 70% - I need more information on aspect X"
- **Identifying gaps**: "Missing: Recent data from 2024, technical specifications"
- **Detecting logic holes**: "This conclusion assumes X, but I haven't verified that yet"

## How to Use

### Best Practices for Queries

**✅ Good Queries** (trigger full reasoning):
- "Research the latest developments in AI agents and explain the key trends"
- "Compare different approaches to state management in React and recommend the best option for large apps"
- "Analyze the current state of quantum computing and its practical applications"

**❌ Less Optimal Queries** (may get simpler responses):
- "What is React?" (too simple, doesn't need research)
- "Hello" (conversational, no research needed)
- "Yes" (context-dependent, no reasoning needed)

### Tips for Best Results

1. **Ask complex questions** that require research and analysis
2. **Request comparisons** to trigger multi-source research
3. **Ask for explanations** to see the reasoning process
4. **Include "research"** in your query to signal you want deep analysis
5. **Follow up** to see the agent build on previous reasoning

## Example Interaction

**User**: "Research the latest developments in AI agents and explain how they differ from traditional chatbots"

**Agent Response** (structured):

🤔 **THINKING:**
```
This question requires me to:
1. Define what AI agents are vs traditional chatbots
2. Research recent developments in AI agents
3. Identify key differentiating factors
4. Provide concrete examples

My approach: First, I'll search for recent AI agent developments, then browse promising sources for detailed technical information, and finally synthesize the findings into a clear comparison.
```

🔍 **RESEARCH:**
```
Searching for "AI agents 2024 developments autonomous" to find current information...
Found 5 relevant sources from tech blogs and research papers.

BROWSING_URL: https://example.com/ai-agents-2024
Key findings:
- AI agents now have multi-step reasoning capabilities
- Tool use and function calling are standard features
- Agents can plan and execute complex tasks autonomously
...
```

💡 **SYNTHESIS:**
```
After analyzing 8 sources, three major themes emerge:

1. Autonomy: Modern AI agents can break down tasks and execute multi-step plans without constant human intervention, unlike chatbots that respond to each prompt independently.

2. Tool Integration: Agents access external tools (search, browsing, code execution) while chatbots primarily rely on training data.

3. Reasoning Transparency: Advanced agents show their thought process (like what you're seeing now), making decisions auditable.
...
```

✅ **ANSWER:**
```
# AI Agents vs Traditional Chatbots: Key Differences

Based on comprehensive research, here are the main distinctions:

## 1. Task Execution
- **AI Agents**: Autonomous multi-step task completion with planning
- **Traditional Chatbots**: Single-turn responses to prompts

## 2. Tool Use
- **AI Agents**: Integrate external tools (web search, databases, APIs)
- **Traditional Chatbots**: Limited to knowledge in training data

## 3. Reasoning
- **AI Agents**: Show explicit reasoning and planning
- **Traditional Chatbots**: Direct answer generation

[Additional sections with citations...]

Sources:
- [Example Source 1](url1)
- [Example Source 2](url2)
...
```

## Technical Implementation

### For Developers

The enhanced reasoning is implemented through:

1. **Structured Prompting**: The agent instructions use Chain-of-Thought prompting with explicit phase markers
2. **Response Parsing**: The UI parses emoji markers (🤔, 🔍, 💡, ✅) to identify and style each phase
3. **Visual Rendering**: Each phase gets distinct styling based on its type

Key files:
- `/src/app/api/agent/route.ts` - Agent instructions and streaming logic
- `/src/app/planning-agent/page.tsx` - UI with parsing and visual rendering

### Customization

You can customize the reasoning process by:
1. **Modifying agent instructions** in `route.ts` to add/remove phases
2. **Adjusting visual styles** in `page.tsx` to change colors or layout
3. **Adding new phase types** by extending the parsing logic

## Troubleshooting

**Q: The agent isn't showing structured phases**
- Make sure you're asking research-oriented questions
- Simple queries may not trigger the full reasoning process
- Try adding "research" or "analyze" to your query

**Q: Some phases are missing**
- Not all queries require all phases
- The agent adapts its response structure to the question
- Simple follow-ups may skip to the ANSWER phase

**Q: The formatting looks wrong**
- Ensure the agent is using the exact emoji markers (🤔, 🔍, 💡, ✅)
- Check that the markers are followed by "**THINKING:**", etc.
- The parsing is case-insensitive but requires the exact format

## Benefits

This structured approach provides:

1. **Transparency**: See exactly how the agent reaches conclusions
2. **Trustworthiness**: Verify the agent's reasoning and sources
3. **Educational**: Learn research methodologies from the agent's process
4. **Debuggability**: Identify where in the reasoning chain issues occur
5. **Reproducibility**: Follow the same research steps independently

## Future Enhancements

Potential improvements being considered:
- Collapsible sections for each phase
- Phase timing/duration indicators
- Ability to interrupt and redirect during THINKING phase
- Conversation branching based on different research directions
- Export reasoning process as a report

## Feedback

This is a new feature designed to make AI agents more transparent and useful. Your feedback helps improve it!

Common requests we're tracking:
- Better mobile display of phases
- Ability to hide certain phases
- Phase-specific controls (e.g., "research more" button in RESEARCH phase)
- Integration with note-taking tools
