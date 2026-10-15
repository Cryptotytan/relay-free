export interface FlightOffer {
  id: string;
  airline: string;
  flightNumber: string;
  priceUsd: number;
  stops: number;
  departure: string;
  arrival: string;
  duration: string;
  label?: "BEST" | "FASTEST" | "CHEAPEST";
}

const DEMO_OFFERS: FlightOffer[] = [
  {
    id: "demo-ns204",
    airline: "Northstar Airways",
    flightNumber: "NS 204",
    priceUsd: 329,
    stops: 1,
    departure: "08:10",
    arrival: "16:40",
    duration: "8h 30m",
    label: "BEST",
  },
  {
    id: "demo-at881",
    airline: "Atlas Air",
    flightNumber: "AT 881",
    priceUsd: 412,
    stops: 1,
    departure: "06:05",
    arrival: "14:15",
    duration: "8h 10m",
    label: "FASTEST",
  },
  {
    id: "demo-sb402",
    airline: "Skybridge",
    flightNumber: "SB 402",
    priceUsd: 287,
    stops: 1,
    departure: "12:25",
    arrival: "21:55",
    duration: "9h 30m",
    label: "CHEAPEST",
  },
];

export async function searchFlights(_params: {
  origin?: string;
  destination: string;
  date?: string;
}): Promise<FlightOffer[]> {
  const mode = process.env.FLIGHT_MODE || "demo";
  if (mode === "demo") {
    return DEMO_OFFERS.map((o) => ({ ...o }));
  }
  // Duffel can be added later; for now fall back to demo
  return DEMO_OFFERS.map((o) => ({ ...o }));
}

export function rankOffers(offers: FlightOffer[]): FlightOffer[] {
  return [...offers].sort((a, b) => {
    if (a.label === "BEST") return -1;
    if (b.label === "BEST") return 1;
    return a.priceUsd - b.priceUsd;
  });
}

export function formatOffer(offer: FlightOffer): string {
  return `${offer.label || "OPTION"} — ${offer.airline} ${offer.flightNumber}
$${offer.priceUsd} · ${offer.stops} stop(s)
${offer.departure} → ${offer.arrival} (${offer.duration})`;
}
