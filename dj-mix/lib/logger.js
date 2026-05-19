const state = {
  debugEnabled: false,
};

function stringifyScope(scope) {
  return String(scope || 'app').trim().toLowerCase().replace(/\s+/g, '-');
}

function normalizePayload(payload) {
  if (payload instanceof Error) {
    return {
      name: payload.name,
      message: payload.message,
      stack: payload.stack,
    };
  }

  return payload;
}

function emit(level, scope, event, payload) {
  const safeLevel = String(level || 'info').toLowerCase();
  const safeScope = stringifyScope(scope);
  const timestamp = new Date().toISOString();
  const head = `[dj-mix][${safeScope}][${safeLevel}]`;
  const body = {
    ts: timestamp,
    event: String(event || 'event'),
  };

  if (payload !== undefined) {
    body.payload = normalizePayload(payload);
  }

  if (safeLevel === 'debug') {
    console.debug(head, body);
    return;
  }
  if (safeLevel === 'info') {
    console.info(head, body);
    return;
  }
  if (safeLevel === 'warn') {
    console.warn(head, body);
    return;
  }

  console.error(head, body);
}

export function setDebugLoggingEnabled(enabled) {
  state.debugEnabled = Boolean(enabled);
}

export function isDebugLoggingEnabled() {
  return state.debugEnabled;
}

export function createLogger(scope) {
  return {
    debug(event, payload) {
      if (!state.debugEnabled) return;
      emit('debug', scope, event, payload);
    },
    info(event, payload) {
      if (!state.debugEnabled) return;
      emit('info', scope, event, payload);
    },
    warn(event, payload) {
      emit('warn', scope, event, payload);
    },
    error(event, payload) {
      emit('error', scope, event, payload);
    },
  };
}
