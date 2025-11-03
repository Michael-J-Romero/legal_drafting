'use client';

import React from 'react';
import {
  FiArrowLeft,
  FiSend,
  FiStopCircle,
  FiExternalLink,
  FiSearch,
  FiMonitor,
  FiImage,
  FiFileText,
} from 'react-icons/fi';

const INITIAL_ASSISTANT_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Hi! I can help with deep web research. Share a complex question and I will search, browse, and summarize with citations.',
};

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function PlannerAgent({ onBack }) {
  const [messages, setMessages] = React.useState([INITIAL_ASSISTANT_MESSAGE]);
  const [inputValue, setInputValue] = React.useState('');
  const [isRunning, setIsRunning] = React.useState(false);
  const [runError, setRunError] = React.useState('');
  const [steps, setSteps] = React.useState([]);
  const [sources, setSources] = React.useState([]);
  const [screenshots, setScreenshots] = React.useState([]);
  const [statusLog, setStatusLog] = React.useState([]);

  const abortControllerRef = React.useRef(null);
  const activeRunIdRef = React.useRef(null);
  const sourcesMapRef = React.useRef(new Map());
  const screenshotsMapRef = React.useRef(new Map());
  const chatScrollRef = React.useRef(null);
  const bottomAnchorRef = React.useRef(null);

  React.useEffect(() => {
    if (bottomAnchorRef.current) {
      bottomAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, steps]);

  const updateStep = React.useCallback((callId, updater) => {
    setSteps((prev) => {
      const existingIndex = prev.findIndex((step) => step.callId === callId);
      if (existingIndex === -1) {
        const next = [...prev, updater(undefined)];
        return next;
      }
      const next = [...prev];
      next[existingIndex] = updater(next[existingIndex]);
      return next;
    });
  }, []);

  const registerSource = React.useCallback((entry) => {
    if (!entry || !entry.url) {
      return;
    }
    const map = sourcesMapRef.current;
    const existing = map.get(entry.url);
    if (!existing) {
      map.set(entry.url, entry);
    } else {
      map.set(entry.url, { ...existing, ...entry });
    }
    setSources(Array.from(map.values()));
  }, []);

  const registerScreenshot = React.useCallback((entry) => {
    if (!entry || !entry.data) {
      return;
    }
    const key = `${entry.callId || 'shot'}-${entry.url || 'page'}`;
    const map = screenshotsMapRef.current;
    if (!map.has(key)) {
      map.set(key, entry);
    } else {
      map.set(key, { ...map.get(key), ...entry });
    }
    setScreenshots(Array.from(map.values()));
  }, []);

  const appendStatus = React.useCallback((status) => {
    setStatusLog((prev) => [status, ...prev].slice(0, 20));
  }, []);

  const handleEvent = React.useCallback(
    (event, runId) => {
      const currentRunId = runId || activeRunIdRef.current;
      switch (event.type) {
        case 'assistant-delta': {
          if (!currentRunId || !event.delta) break;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === currentRunId
                ? { ...message, content: `${message.content || ''}${event.delta}` }
                : message,
            ),
          );
          break;
        }
        case 'assistant-message': {
          if (!currentRunId) break;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === currentRunId
                ? { ...message, content: event.content || message.content || '', streaming: false }
                : message,
            ),
          );
          break;
        }
        case 'tool-call': {
          if (!event.callId) break;
          updateStep(event.callId, (existing) => ({
            callId: event.callId,
            name: event.name || existing?.name || 'tool',
            status: event.status || existing?.status || 'pending',
            args: event.args ?? existing?.args,
            preview: existing?.preview,
            output: existing?.output,
            startedAt: existing?.startedAt || new Date().toISOString(),
            completedAt: existing?.completedAt,
          }));
          break;
        }
        case 'tool-result': {
          if (!event.callId) break;
          updateStep(event.callId, (existing = {}) => ({
            callId: event.callId,
            name: event.name || existing.name || 'tool',
            status: 'completed',
            args: existing.args,
            preview: event.preview || existing.preview,
            output: event.output ?? existing.output,
            startedAt: existing.startedAt || new Date().toISOString(),
            completedAt: new Date().toISOString(),
          }));
          if (Array.isArray(event.output?.results)) {
            event.output.results.forEach((item) => {
              registerSource({
                id: item.url,
                url: item.url,
                title: item.title,
                snippet: item.snippet,
                origin: event.name,
                toolCallId: event.callId,
              });
            });
          }
          break;
        }
        case 'tool-error': {
          if (!event.callId) break;
          updateStep(event.callId, (existing = {}) => ({
            callId: event.callId,
            name: event.name || existing.name || 'tool',
            status: 'error',
            args: existing.args,
            preview: existing.preview,
            output: { error: event.error },
            startedAt: existing.startedAt || new Date().toISOString(),
            completedAt: new Date().toISOString(),
          }));
          break;
        }
        case 'source': {
          registerSource(event.source);
          break;
        }
        case 'final-sources': {
          if (Array.isArray(event.sources)) {
            const map = sourcesMapRef.current;
            event.sources.forEach((source) => {
              if (source?.url) {
                const existing = map.get(source.url);
                map.set(source.url, { ...existing, ...source });
              }
            });
            setSources(Array.from(map.values()));
          }
          break;
        }
        case 'screenshot': {
          registerScreenshot(event);
          break;
        }
        case 'status': {
          appendStatus({
            id: createId('status'),
            level: event.level || 'info',
            message: event.message || '',
            at: new Date().toISOString(),
          });
          break;
        }
        case 'error': {
          setRunError(event.message || 'Planner agent error');
          setIsRunning(false);
          break;
        }
        case 'done': {
          if (!currentRunId) break;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === currentRunId ? { ...message, streaming: false } : message,
            ),
          );
          break;
        }
        default:
          break;
      }
    },
    [appendStatus, registerScreenshot, registerSource, updateStep],
  );

  const startPlannerRun = React.useCallback(
    async (payload, runId, controller) => {
      try {
        const response = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Planner request failed (${response.status})`);
        }

        if (!response.body) {
          throw new Error('Planner response stream unavailable');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            if (!line) continue;
            try {
              const event = JSON.parse(line);
              handleEvent(event, runId);
            } catch (error) {
              // ignore malformed chunk
            }
          }
        }
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer.trim());
            handleEvent(event, runId);
          } catch (error) {
            // ignore trailing garbage
          }
        }
      } catch (error) {
        if (controller.signal.aborted) {
          handleEvent({ type: 'status', level: 'info', message: 'Run cancelled by user.' }, runId);
        } else {
          handleEvent({ type: 'error', message: error?.message || 'Planner run failed.' }, runId);
        }
      } finally {
        activeRunIdRef.current = null;
        abortControllerRef.current = null;
        setIsRunning(false);
      }
    },
    [handleEvent],
  );

  const handleSubmit = React.useCallback(
    (event) => {
      event.preventDefault();
      if (isRunning) return;
      const trimmed = inputValue.trim();
      if (!trimmed) return;

      const runId = createId('assistant');
      const userMessage = { id: createId('user'), role: 'user', content: trimmed };
      const assistantMessage = { id: runId, role: 'assistant', content: '', streaming: true };

      const payloadMessages = [...messages, userMessage].map(({ role, content }) => ({ role, content }));

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setInputValue('');
      setRunError('');
      setIsRunning(true);
      setSteps([]);
      setSources([]);
      setScreenshots([]);
      sourcesMapRef.current = new Map();
      screenshotsMapRef.current = new Map();
      activeRunIdRef.current = runId;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      startPlannerRun({ messages: payloadMessages }, runId, controller);
    },
    [inputValue, isRunning, messages, startPlannerRun],
  );

  const handleStop = React.useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return (
    <>
      <PlannerHeader onBack={onBack} isRunning={isRunning} onStop={handleStop} />
      <div className="planner-layout">
        <section className="planner-chat" ref={chatScrollRef}>
          <div className="planner-messages">
            {messages.map((message) => (
              <PlannerMessage key={message.id} message={message} />
            ))}
            {runError && (
              <div className="planner-error" role="alert">
                {runError}
              </div>
            )}
            <div ref={bottomAnchorRef} />
          </div>
          <form className="planner-composer" onSubmit={handleSubmit}>
            <textarea
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Ask for multi-step research..."
              rows={3}
              disabled={isRunning}
            />
            <div className="planner-composer-actions">
              {isRunning ? (
                <button type="button" className="planner-stop" onClick={handleStop}>
                  <FiStopCircle /> Stop
                </button>
              ) : (
                <button type="submit" className="planner-send">
                  <FiSend /> Run research
                </button>
              )}
            </div>
          </form>
        </section>
        <aside className="planner-side">
          <div className="planner-panel">
            <header className="planner-panel-header">
              <FiMonitor />
              <span>Run inspector</span>
            </header>
            <div className="planner-panel-body">
              {steps.length === 0 ? (
                <div className="planner-empty">No tool calls yet.</div>
              ) : (
                <ol className="planner-steps">
                  {steps.map((step) => (
                    <li key={step.callId} className={`planner-step planner-step-${step.status}`}>
                      <div className="planner-step-header">
                        <strong>{step.name}</strong>
                        <span className="planner-step-status">{step.status}</span>
                      </div>
                      {step.args && (
                        <div className="planner-step-field">
                          <label>Args</label>
                          <code>{JSON.stringify(step.args)}</code>
                        </div>
                      )}
                      {step.preview && (
                        <div className="planner-step-field">
                          <label>Preview</label>
                          <code>{step.preview}</code>
                        </div>
                      )}
                      {step.output && step.status === 'completed' && (
                        <details className="planner-step-field">
                          <summary>Output</summary>
                          <pre>{JSON.stringify(step.output, null, 2)}</pre>
                        </details>
                      )}
                      {step.output?.error && (
                        <div className="planner-step-error-text">{step.output.error}</div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <div className="planner-panel">
            <header className="planner-panel-header">
              <FiSearch />
              <span>Sources & media</span>
            </header>
            <div className="planner-panel-body">
              {sources.length === 0 && screenshots.length === 0 ? (
                <div className="planner-empty">Sources will appear here once gathered.</div>
              ) : (
                <>
                  {sources.length > 0 && (
                    <ul className="planner-sources">
                      {sources.map((source) => (
                        <li key={source.url}>
                          <div className="planner-source-title">
                            <FiExternalLink />
                            <a href={source.url} target="_blank" rel="noreferrer">
                              {source.title || source.url}
                            </a>
                          </div>
                          {source.snippet && <p>{source.snippet}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {screenshots.length > 0 && (
                    <div className="planner-screenshots">
                      <div className="planner-screenshot-heading">
                        <FiImage /> Screenshots
                      </div>
                      <div className="planner-screenshot-grid">
                        {screenshots.map((shot) => (
                          <figure key={`${shot.callId}-${shot.url}`}>
                            <img src={`data:image/png;base64,${shot.data}`} alt={shot.url || 'Screenshot'} />
                            <figcaption>
                              <a href={shot.url} target="_blank" rel="noreferrer">
                                {shot.url}
                              </a>
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {statusLog.length > 0 && (
            <div className="planner-panel">
              <header className="planner-panel-header">
                <FiFileText />
                <span>Status log</span>
              </header>
              <div className="planner-panel-body planner-status-log">
                <ul>
                  {statusLog.map((status) => (
                    <li key={status.id} className={`status-${status.level}`}>
                      <span>{status.message}</span>
                      <time>{new Date(status.at).toLocaleTimeString()}</time>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function PlannerHeader({ onBack, isRunning, onStop }) {
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
        {isRunning && (
          <div className="app-header-actions">
            <button type="button" className="planner-stop" onClick={onStop}>
              <FiStopCircle /> Stop run
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function PlannerMessage({ message }) {
  const roleClass = message.role === 'user' ? 'planner-message-user' : 'planner-message-assistant';
  const content = message.content && message.content.trim().length > 0 ? message.content : null;
  return (
    <div className={`planner-message ${roleClass}`}>
      <div className="planner-message-role">{message.role === 'user' ? 'You' : 'Planner'}</div>
      <div className="planner-message-content">
        {content ? (
          <div className="planner-markdown">{content}</div>
        ) : (
          <div className="planner-message-loading">{message.streaming ? 'Working…' : 'Waiting for output…'}</div>
        )}
      </div>
    </div>
  );
}
