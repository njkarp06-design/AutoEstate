import Database from "better-sqlite3";

export type RunStatus = "completed" | "in_progress";

export type Run = {
  id: string;
  source: string;
  displayName: string | null;
  chatId: string | null;
  startedAt: number; // epoch seconds
  status: RunStatus;
  messageCount: number;
  title: string | null;
  estimatedCostUsd: number | null;
};

export type RunMessage = {
  role: string;
  content: string;
  timestamp: number;
};

export type RunDetail = Run & {
  messages: RunMessage[];
};

type SessionRow = {
  id: string;
  source: string;
  display_name: string | null;
  chat_id: string | null;
  started_at: number;
  message_count: number;
  title: string | null;
  estimated_cost_usd: number | null;
  has_reply: number;
};

// Messaging-platform sessions are persistent chat threads that rarely (if
// ever) get a formal end_reason/ended_at - unlike CLI sessions, they don't
// "close." So "status" here means "has the agent replied yet," not whether
// the underlying Hermes session object has ended.
const SESSION_SELECT = `
  SELECT
    s.id, s.source, s.display_name, s.chat_id, s.started_at,
    s.message_count, s.title, s.estimated_cost_usd,
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.session_id = s.id
        AND m.role = 'assistant'
        AND m.content IS NOT NULL AND TRIM(m.content) != ''
    ) AS has_reply
  FROM sessions s
`;

function openDb() {
  const path = process.env.HERMES_STATE_DB_PATH;
  if (!path) {
    throw new Error(
      "HERMES_STATE_DB_PATH is not set - add it to reporting-app/.env.local"
    );
  }
  return new Database(path, { readonly: true, fileMustExist: true });
}

function rowToRun(row: SessionRow): Run {
  return {
    id: row.id,
    source: row.source,
    displayName: row.display_name,
    chatId: row.chat_id,
    startedAt: row.started_at,
    status: row.has_reply ? "completed" : "in_progress",
    messageCount: row.message_count,
    title: row.title,
    estimatedCostUsd: row.estimated_cost_usd,
  };
}

/** Real agent runs only - excludes CLI/dev-testing sessions. */
export function getRuns(): Run[] {
  const db = openDb();
  try {
    const rows = db
      .prepare(
        `${SESSION_SELECT}
         WHERE s.source IN ('whatsapp', 'telegram')
         ORDER BY s.started_at DESC`
      )
      .all() as SessionRow[];
    return rows.map(rowToRun);
  } finally {
    db.close();
  }
}

export function getRun(id: string): RunDetail | null {
  const db = openDb();
  try {
    const row = db
      .prepare(`${SESSION_SELECT} WHERE s.id = ?`)
      .get(id) as SessionRow | undefined;
    if (!row) return null;

    const messages = db
      .prepare(
        `SELECT role, content, timestamp FROM messages
         WHERE session_id = ?
           AND role IN ('user', 'assistant')
           AND content IS NOT NULL AND TRIM(content) != ''
         ORDER BY timestamp ASC`
      )
      .all(id) as RunMessage[];

    return { ...rowToRun(row), messages };
  } finally {
    db.close();
  }
}
