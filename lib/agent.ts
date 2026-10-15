import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import type { FunctionDeclaration } from "@google/genai";
import { searchFlights, rankOffers, formatOffer, type FlightOffer } from "./flights";
import {
  getOrCreateIncident,
  updateIncident,
  addMessage,
  getRecentMessages,
  type Incident,
} from "./db";

function getAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY");
  return new GoogleGenAI({ apiKey: key });
}

const searchFlightsDecl: FunctionDeclaration = {
  name: "search_flights",
  description: "Search for flight options when the user needs alternative transportation after a disruption.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      destination: { type: Type.STRING, description: "Destination city or airport code" },
      origin: { type: Type.STRING, description: "Origin city or airport code (optional)" },
      date: { type: Type.STRING, description: "Travel date YYYY-MM-DD (optional)" },
    },
    required: ["destination"],
  },
};

export async function runAgent(userId: string, userText: string): Promise<string> {
  const incident = await getOrCreateIncident(userId);
  await addMessage(incident.id, "user", userText);

  // Hard confirmation gate — application enforces this, not the model
  if (incident.status === "AWAITING_CONFIRMATION") {
    const affirmative = /\b(yes|yeah|yep|confirm|book|take|go ahead|do it)\b/i.test(userText);
    if (affirmative && incident.selected_offer) {
      await updateIncident(incident.id, { status: "CONFIRMED" });
      await addMessage(incident.id, "system", "User confirmed booking");
      return formatConfirmationSuccess(incident.selected_offer as FlightOffer);
    }
    if (/\b(no|cancel|stop|nevermind)\b/i.test(userText)) {
      await updateIncident(incident.id, { status: "OPTIONS_FOUND", selected_offer: null });
      return "Okay, cancelled that selection. What would you like to do next?";
    }
  }

  const history = await getRecentMessages(incident.id);
  const systemPrompt = buildSystemPrompt(incident);

  const contents = [
    { role: "user" as const, parts: [{ text: systemPrompt }] },
    ...history.map((m) => ({
      role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
      parts: [{ text: m.content }],
    })),
    { role: "user" as const, parts: [{ text: userText }] },
  ];

  const ai = getAI();
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    contents,
    config: {
      tools: [{ functionDeclarations: [searchFlightsDecl] }],
      toolConfig: {
        functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
      },
    },
  });

  const functionCall = response.functionCalls?.[0];
  if (functionCall?.name === "search_flights") {
    const args = (functionCall.args || {}) as { destination: string; origin?: string; date?: string };
    const offers = rankOffers(await searchFlights(args));
    const selected = offers[0];

    await updateIncident(incident.id, {
      status: "OPTIONS_FOUND",
      context: { ...incident.context, lastSearch: args },
      selected_offer: selected,
    });

    // Move to confirmation waiting after showing options
    await updateIncident(incident.id, { status: "AWAITING_CONFIRMATION" });

    const summary = offers.map(formatOffer).join("\n\n");
    const reply = `Here are the best options I found:\n\n${summary}\n\nReply “take the best” or “yes” to proceed with the top option.`;
    await addMessage(incident.id, "assistant", reply);
    return reply;
  }

  const text = response.text || "I'm on it. Can you tell me where you're trying to get to?";
  await addMessage(incident.id, "assistant", text);

  if (/cancel|cancelled|disrupted|stranded/i.test(userText) && incident.status === "OPEN") {
    await updateIncident(incident.id, { status: "UNDERSTANDING", type: "flight_disruption" });
  }

  return text;
}

function buildSystemPrompt(incident: Incident): string {
  return `You are RELAY, a calm, competent personal incident-response agent reachable via iMessage.
Current incident status: ${incident.status}
Incident type: ${incident.type || "unknown"}

Rules:
- Never claim you booked or paid for anything unless the application state is CONFIRMED.
- When the user needs flights, call the search_flights tool.
- After showing options, wait for explicit confirmation.
- Keep replies short, clear, and actionable.
- If information is missing (destination, date, origin), ask for it.
- You are helping with travel disruptions, lost items, delays, etc.`;
}

function formatConfirmationSuccess(offer: FlightOffer): string {
  return `Confirmed (demo mode).

Selected:
${formatOffer(offer)}

In a full production version this would revalidate the offer and complete the booking.
For this free contest build, no real purchase was made.
What else do you need help with?`;
}
