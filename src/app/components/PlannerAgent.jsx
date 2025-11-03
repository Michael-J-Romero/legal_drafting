'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { FiArrowLeft, FiSend } from 'react-icons/fi';

const TOOL_STATUSES = {
  pending: 'pending',
  running: 'running',
  success: 'success',
  error: 'error',
};

function useAutoScroll(ref, deps) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, deps);
}

function PlannerHeader({ onBack, status }) {
  return (
    <header className="app-header" role="banner">
      <div className="app-header-inner">
        <div className="app-header-left">
          <button
            type="button"
            className="app-back-button"
            onClick={onBack}
            aria-label="Back to main menu"
            title="Back to main menu"
          >
            <FiArrowLeft />
          </button>
          <div className="app-title">Planner Agent</div>
        </div>
        <div className="planner-status-text" role="status" aria-live="polite">
          {status}
        </div>
      </div>
    </header>
  );
}

function PlannerMessage({ role, content, streaming }) {
  const displayRole = role === 'user' ? 'You' : 'Agent';
  return (
    <div className={`planner-message planner-message-${role}`} data-streaming={streaming ? 'true' : 'false'}>
      <div className="planner-message-role">{displayRole}</div>
      <div className="planner-message-content">
        <ReactMarkdown linkTarget="_blank">{content}</ReactMarkdown>
      </div>
    </div>
  );
}

function ToolStep({ step }) {
  return (
    <div className={`planner-step planner-step-${step.status}`}>
      <div className="planner-step-header">
        <div className="planner-step-title">{step.label}</div>
        <div className="planner-step-status">{step.status}</div>
      </div>
      {step.details ? <div className="planner-step-details">{step.details}</div> : null}
    </div>
  );
}

function SourceCard({ source }) {
  return (
    <div className="planner-source-card">
      <div className="planner-source-title">{source.title}</div>
      <a href={source.url} target="_blank" rel="noreferrer" className="planner-source-link">
        {source.url}
      </a>
      {source.reason ? <div className="planner-source-reason">{source.reason}</div> : null}
    </div>
  );
}

export default function PlannerAgent({ onBack }) {
  const [messages, setMessages] = React.useState([]);
  const [inputValue, setInputValue] = React.useState('');
  const [isRunning, setIsRunning] = React.useState(false);
  const [status, setStatus] = React.useState('Ready');
  const [plan, setPlan] = React.useState(null);
  const [searches, setSearches] = React.useState([]);
  const [selections, setSelections] = React.useState([]);
  const [extractions, setExtractions] = React.useState([]);
  const [memos, setMemos] = React.useState([]);
  const [sources, setSources] = React.useState([]);
  const [errors, setErrors] = React.useState([]);
  const [steps, setSteps] = React.useState([]);
  const [streamingText, setStreamingText] = React.useState('');

  const chatRef = React.useRef(null);
  const abortRef = React.useRef(null);

  useAutoScroll(chatRef, [messages.length, streamingText]);

  const displayedMessages = React.useMemo(() => {
    return streamingText
      ? [...messages, { role: 'assistant', content: streamingText, streaming: true }]
      : messages;
  }, [messages, streamingText]);

  const upsertStep = React.useCallback((id, payload) => {
    setSteps((prev) => {
      const existingIndex = prev.findIndex((step) => step.id === id);
      if (existingIndex === -1) {
        return [
          ...prev,
          {
            id,
            label: payload.label,
            status: payload.status || TOOL_STATUSES.pending,
            details: payload.details || '',
          },
        ];
      }
      const next = [...prev];
      next[existingIndex] = {
        ...next[existingIndex],
        ...payload,
        status: payload.status || next[existingIndex].status,
        details: payload.details !== undefined ? payload.details : next[existingIndex].details,
      };
      return next;
    });
  }, []);

  const resetRunState = React.useCallback(() => {
    setPlan(null);
    setSearches([]);
    setSelections([]);
    setExtractions([]);
    setMemos([]);
    setSources([]);
    setErrors([]);
    setSteps([]);
    setStreamingText('');
  }, []);

  const handleEvent = React.useCallback(
    (event) => {
      switch (event.type) {
        case 'status':
          setStatus(event.message || '');
          break;
        case 'plan':
          setPlan(event.plan);
          upsertStep('plan', {
            label: 'Generate search plan',
            status: TOOL_STATUSES.success,
            details: event.plan?.focus_areas ? `Focus: ${event.plan.focus_areas.join(', ')}` : undefined,
          });
          break;
        case 'search-start':
          upsertStep(`search-${event.index}`, {
            label: `Search: ${event.query}`,
            status: TOOL_STATUSES.running,
          });
          break;
        case 'search-results':
          setSearches((prev) => {
            const next = [...prev.filter((entry) => entry.query !== event.query), event];
            return next;
          });
          upsertStep(`search-${event.index}`, {
            label: `Search: ${event.query}`,
            status: TOOL_STATUSES.success,
            details: `${event.results?.length || 0} results`,
          });
          break;
        case 'search-error':
          setErrors((prev) => [...prev, `Search error for "${event.query}": ${event.error}`]);
          upsertStep(`search-${event.index}`, {
            label: `Search: ${event.query}`,
            status: TOOL_STATUSES.error,
            details: event.error,
          });
          break;
        case 'selection':
          setSelections(event.selections || []);
          upsertStep('selection', {
            label: 'Select sources',
            status: TOOL_STATUSES.success,
            details: `${event.selections?.length || 0} chosen`,
          });
          break;
        case 'extractions':
          setExtractions(event.sources || []);
          upsertStep('browse', {
            label: 'Browse sources',
            status: TOOL_STATUSES.success,
            details: `${event.sources?.length || 0} pages captured`,
          });
          break;
        case 'browse-error':
          setErrors((prev) => [
            ...prev,
            event.url ? `${event.url}: ${event.error}` : event.error,
          ]);
          upsertStep('browse', {
            label: 'Browse sources',
            status: TOOL_STATUSES.error,
            details: event.error,
          });
          break;
        case 'memos':
          setMemos(event.memos || []);
          upsertStep('memos', {
            label: 'Summarize memos',
            status: TOOL_STATUSES.success,
            details: `${event.memos?.length || 0} memos`,
          });
          break;
        case 'final-delta':
          setStreamingText((prev) => prev + (event.delta || ''));
          break;
        case 'final-summary':
          setStreamingText('');
          setSources(event.sources || []);
          if (event.message) {
            setMessages((prev) => [...prev, { role: 'assistant', content: event.message }]);
          }
          upsertStep('final', {
            label: 'Compose answer',
            status: TOOL_STATUSES.success,
          });
          break;
        case 'error':
          setErrors((prev) => [...prev, event.error || 'Unknown error']);
          upsertStep('final', {
            label: 'Compose answer',
            status: TOOL_STATUSES.error,
            details: event.error,
          });
          setStreamingText('');
          setIsRunning(false);
          break;
        case 'aborted':
          setStatus('Run aborted');
          setStreamingText('');
          setIsRunning(false);
          break;
        case 'done':
          setStatus('Complete');
          setIsRunning(false);
          break;
        default:
          break;
      }
    },
    [upsertStep],
  );

  const handleSubmit = React.useCallback(
    async (event) => {
      event.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed || isRunning) return;

      const nextMessages = [...messages, { role: 'user', content: trimmed }];
      setMessages(nextMessages);
      setInputValue('');
      setIsRunning(true);
      setStatus('Starting run');
      resetRunState();

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: nextMessages }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const message = await response.text();
          throw new Error(message || 'Agent request failed');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newlineIndex = buffer.indexOf('\n');
          while (newlineIndex >= 0) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            if (line) {
              try {
                const eventPayload = JSON.parse(line);
                handleEvent(eventPayload);
              } catch (err) {
                console.error('Failed to parse agent event', err, line);
              }
            }
            newlineIndex = buffer.indexOf('\n');
          }
        }
      } catch (err) {
        if (controller.signal.aborted) {
          setIsRunning(false);
          return;
        }
        const message = err instanceof Error ? err.message : 'Agent request failed';
        setErrors((prev) => [...prev, message]);
        setIsRunning(false);
        setStatus('Error');
      } finally {
        abortRef.current = null;
      }
    },
    [handleEvent, inputValue, isRunning, messages, resetRunState],
  );

  const handleStop = React.useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      setStatus('Cancelling…');
    }
  }, []);

  return (
    <>
      <PlannerHeader onBack={onBack} status={status} />
      <div className="planner-layout">
        <div className="planner-panel planner-chat-panel">
          <h2>Chat</h2>
          <div className="planner-chat-log" ref={chatRef}>
            {displayedMessages.length === 0 ? (
              <div className="planner-placeholder">Ask a research question to start planning.</div>
            ) : (
              displayedMessages.map((message, index) => (
                <PlannerMessage key={index} {...message} />
              ))
            )}
          </div>
          {errors.length > 0 ? (
            <div className="planner-error-box">
              {errors.map((err, index) => (
                <div key={index}>{err}</div>
              ))}
            </div>
          ) : null}
          <form className="planner-composer" onSubmit={handleSubmit}>
            <textarea
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Describe the research you need…"
              rows={3}
              disabled={isRunning}
            />
            <div className="planner-composer-actions">
              {isRunning ? (
                <button type="button" className="ghost" onClick={handleStop}>
                  Stop
                </button>
              ) : null}
              <button type="submit" className="primary" disabled={!inputValue.trim() || isRunning}>
                <FiSend />
                <span>Run</span>
              </button>
            </div>
          </form>
        </div>
        <div className="planner-panel planner-inspector-panel">
          <h2>Run Inspector</h2>
          <div className="planner-section">
            <h3>Plan</h3>
            {plan ? (
              <div className="planner-plan">
                <div>
                  <strong>Queries</strong>
                  <ul>
                    {plan.queries?.map((query, index) => (
                      <li key={index}>{query}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong>Focus areas</strong>
                  <ul>
                    {plan.focus_areas?.map((area, index) => (
                      <li key={index}>{area}</li>
                    ))}
                  </ul>
                </div>
                {plan.cautions?.length ? (
                  <div>
                    <strong>Cautions</strong>
                    <ul>
                      {plan.cautions.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="planner-placeholder">Plan details will appear here.</div>
            )}
          </div>

          <div className="planner-section">
            <h3>Tool Steps</h3>
            {steps.length ? (
              <div className="planner-steps-list">
                {steps.map((step) => (
                  <ToolStep key={step.id} step={step} />
                ))}
              </div>
            ) : (
              <div className="planner-placeholder">No steps yet.</div>
            )}
          </div>

          <div className="planner-section">
            <h3>Search Results</h3>
            {searches.length ? (
              <div className="planner-search-results">
                {searches.map((entry, index) => (
                  <div key={`${entry.query}-${index}`} className="planner-search-card">
                    <div className="planner-search-query">{entry.query}</div>
                    <ol>
                      {(entry.results || []).slice(0, 5).map((result, resultIndex) => (
                        <li key={`${result.url}-${resultIndex}`}>
                          <div className="planner-search-title">{result.title}</div>
                          <a href={result.url} target="_blank" rel="noreferrer">
                            {result.url}
                          </a>
                          {result.snippet ? (
                            <div className="planner-search-snippet">{result.snippet}</div>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            ) : (
              <div className="planner-placeholder">Search hits will be listed here.</div>
            )}
          </div>

          <div className="planner-section">
            <h3>Selected Sources</h3>
            {selections.length ? (
              <div className="planner-sources-grid">
                {selections.map((item, index) => (
                  <SourceCard key={`${item.url}-${index}`} source={item} />
                ))}
              </div>
            ) : (
              <div className="planner-placeholder">Sources will be listed here after planning.</div>
            )}
          </div>

          <div className="planner-section">
            <h3>Final Citations</h3>
            {sources.length ? (
              <div className="planner-sources-grid">
                {sources.map((item, index) => (
                  <SourceCard key={`${item.url}-${index}`} source={item} />
                ))}
              </div>
            ) : (
              <div className="planner-placeholder">Citations appear once the answer is ready.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
