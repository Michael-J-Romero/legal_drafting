import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { OpenAIEmbeddings } from '@langchain/openai';
import { encoding_for_model } from 'tiktoken';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string | number | Date;
}

interface ResearchDocument {
  content: string;
  metadata: {
    source?: string;
    type: 'search_result' | 'browsed_content' | 'reflection' | 'synthesis';
    timestamp: number;
    confidence?: number;
  };
  embedding?: number[];
}

/**
 * Context Manager for efficient token usage and context retrieval
 * Uses LangChain for document chunking and semantic similarity
 */
export class ContextManager {
  private documents: ResearchDocument[] = [];
  private textSplitter: RecursiveCharacterTextSplitter;
  private embeddings: OpenAIEmbeddings;
  private maxContextTokens: number;
  
  constructor(maxContextTokens: number = 4000) { // Reduced from 8000 to be more conservative
    this.maxContextTokens = maxContextTokens;
    
    // Initialize text splitter for chunking large documents
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800, // Reduced from 1000
      chunkOverlap: 150, // Reduced from 200
      separators: ['\n\n', '\n', '. ', '! ', '? ', ', ', ' ', ''],
    });
    
    // Initialize OpenAI embeddings for semantic search
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small', // Efficient embedding model
    });
  }
  
  /**
   * Add research findings to the context
   */
  async addResearchDocument(doc: ResearchDocument): Promise<void> {
    try {
      // Generate embedding for semantic search
      const embedding = await this.embeddings.embedQuery(doc.content);
      this.documents.push({ ...doc, embedding });
    } catch (error) {
      console.error('Error generating embedding:', error);
      // Store without embedding as fallback
      this.documents.push(doc);
    }
  }
  
  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magA * magB);
  }
  
  /**
   * Retrieve relevant context for a query using semantic search
   */
  async getRelevantContext(query: string, maxChunks: number = 5): Promise<string> {
    if (this.documents.length === 0) {
      return '';
    }
    
    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddings.embedQuery(query);
      
      // Calculate similarities and sort
      const scored = this.documents
        .filter(doc => doc.embedding) // Only docs with embeddings
        .map(doc => ({
          doc,
          score: this.cosineSimilarity(queryEmbedding, doc.embedding!),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, maxChunks);
      
      // Combine relevant chunks
      return scored
        .map((item, idx) => {
          const source = item.doc.metadata.source ? ` [${item.doc.metadata.source}]` : '';
          const type = item.doc.metadata.type;
          return `[Context ${idx + 1} - ${type}]${source}:\n${item.doc.content.substring(0, 800)}${item.doc.content.length > 800 ? '...' : ''}`;
        })
        .join('\n\n');
    } catch (error) {
      console.error('Error in semantic search:', error);
      // Fallback to recent documents
      return this.documents
        .slice(-maxChunks)
        .map((doc, idx) => `[Context ${idx + 1}]:\n${doc.content.substring(0, 500)}`)
        .join('\n\n');
    }
  }
  
  /**
   * Summarize conversation history efficiently
   */
  summarizeConversation(messages: ConversationMessage[]): string {
    // For very long conversations, only keep the last 2 messages (previously 3)
    const recentMessages = messages.slice(-2);
    return recentMessages
      .map(m => {
        // Truncate individual messages to max 300 chars (reduced from 500)
        const content = m.content.substring(0, 300);
        return `${m.role === 'user' ? 'User' : 'Assistant'}: ${content}${m.content.length > 300 ? '...' : ''}`;
      })
      .join('\n\n');
  }
  
  /**
   * Count tokens in text (for GPT-4o)
   */
  countTokens(text: string): number {
    try {
      const encoder = encoding_for_model('gpt-4o');
      const tokens = encoder.encode(text);
      encoder.free();
      return tokens.length;
    } catch (error) {
      // Fallback: rough estimate (1 token ≈ 4 characters)
      return Math.ceil(text.length / 4);
    }
  }
  
  /**
   * Get optimized context that fits within token limit
   */
  async getOptimizedContext(query: string, conversationHistory: ConversationMessage[]): Promise<{
    relevantResearch: string;
    conversationSummary: string;
    totalTokens: number;
  }> {
    console.log(`[CTX-MGR] getOptimizedContext called with ${conversationHistory.length} messages`);
    
    const conversationSummary = this.summarizeConversation(conversationHistory);
    console.log(`[CTX-MGR] Conversation summary: ${conversationSummary.length} chars`);
    
    const relevantResearch = await this.getRelevantContext(query, 3); // Reduced from 5 to 3
    console.log(`[CTX-MGR] Relevant research (3 chunks): ${relevantResearch.length} chars`);
    
    const totalTokens = this.countTokens(conversationSummary + relevantResearch);
    console.log(`[CTX-MGR] Total tokens before optimization: ${totalTokens}`);
    
    // If still too large, reduce research chunks further
    if (totalTokens > this.maxContextTokens) {
      console.log(`[CTX-MGR] Context too large (${totalTokens} > ${this.maxContextTokens}), reducing to 2 chunks`);
      const reducedResearch = await this.getRelevantContext(query, 2); // Reduced from 3 to 2
      const reducedTokens = this.countTokens(conversationSummary + reducedResearch);
      console.log(`[CTX-MGR] Reduced research (2 chunks): ${reducedResearch.length} chars, ${reducedTokens} tokens`);
      
      // If STILL too large, just use conversation summary
      if (reducedTokens > this.maxContextTokens) {
        console.log(`[CTX-MGR] Still too large (${reducedTokens} > ${this.maxContextTokens}), dropping research and truncating summary`);
        const truncatedSummary = conversationSummary.substring(0, 1000);
        const finalTokens = this.countTokens(truncatedSummary);
        console.log(`[CTX-MGR] Final context: ${truncatedSummary.length} chars, ${finalTokens} tokens`);
        return {
          relevantResearch: '',
          conversationSummary: truncatedSummary, // Hard truncate
          totalTokens: finalTokens,
        };
      }
      
      console.log(`[CTX-MGR] Final optimized context: ${reducedTokens} tokens`);
      return {
        relevantResearch: reducedResearch,
        conversationSummary,
        totalTokens: reducedTokens,
      };
    }
    
    console.log(`[CTX-MGR] Context within limits: ${totalTokens} tokens`);
    return {
      relevantResearch,
      conversationSummary,
      totalTokens,
    };
  }
  
  /**
   * Extract and store research findings from agent response
   */
  extractResearchFindings(response: string): void {
    // Extract content from different phases
    const researchMatches = response.match(/🔍\s*\*\*RESEARCH:\*\*(.*?)(?=🧐|💡|✅|$)/s);
    const reflectionMatches = response.match(/🧐\s*\*\*REFLECTION:\*\*(.*?)(?=🔍|💡|✅|$)/s);
    const synthesisMatches = response.match(/💡\s*\*\*SYNTHESIS:\*\*(.*?)(?=✅|$)/s);
    
    if (researchMatches && researchMatches[1]) {
      this.addResearchDocument({
        content: researchMatches[1].trim(),
        metadata: {
          type: 'search_result',
          timestamp: Date.now(),
        },
      }).catch(err => console.error('Failed to add research:', err));
    }
    
    if (reflectionMatches && reflectionMatches[1]) {
      const confidenceMatch = reflectionMatches[1].match(/Confidence:\s*(\d+)%/);
      this.addResearchDocument({
        content: reflectionMatches[1].trim(),
        metadata: {
          type: 'reflection',
          timestamp: Date.now(),
          confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : undefined,
        },
      }).catch(err => console.error('Failed to add reflection:', err));
    }
    
    if (synthesisMatches && synthesisMatches[1]) {
      this.addResearchDocument({
        content: synthesisMatches[1].trim(),
        metadata: {
          type: 'synthesis',
          timestamp: Date.now(),
        },
      }).catch(err => console.error('Failed to add synthesis:', err));
    }
  }
  
  /**
   * Get statistics about current context
   */
  getStats(): {
    documentCount: number;
    totalTokensEstimate: number;
  } {
    const allContent = this.documents.map(d => d.content).join('\n');
    return {
      documentCount: this.documents.length,
      totalTokensEstimate: this.countTokens(allContent),
    };
  }
  
  /**
   * Clear context (useful for new conversations)
   */
  clear(): void {
    this.documents = [];
  }
}
