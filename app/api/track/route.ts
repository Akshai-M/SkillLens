import { ensureStudent, recordEvents, type TrackPayload } from "@/lib/analytics/record";
import { getSession } from "@/lib/session";

const MAX_BODY_BYTES = 16 * 1024;

/** Receives batched activity events from the student-side tracker (sent with navigator.sendBeacon). */
export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  let payload: TrackPayload;
  try {
    payload = JSON.parse(text) as TrackPayload;
  } catch {
    return new Response(null, { status: 400 });
  }

  try {
    // Sessions created before analytics existed carry no student ID; resolve it from the email.
    const studentId = session.id ?? (await ensureStudent(session.email, session.name));
    await recordEvents(studentId, payload, request.headers.get("user-agent"));
  } catch (error) {
    console.error("[analytics] failed to record events", error);
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
