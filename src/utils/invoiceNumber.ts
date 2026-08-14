const STORAGE_KEY = "positivogroup:invoiceCounter";

interface CounterState {
  year: number;
  next: number;
}

function readCounter(): CounterState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CounterState;
  } catch {
    // localStorage no disponible o valor corrupto: se reinicia el contador
  }
  return { year: new Date().getFullYear() % 100, next: 1 };
}

function writeCounter(state: CounterState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage no disponible: el contador no persiste entre sesiones
  }
}

export function nextInvoiceNumber(): string {
  const currentYear = new Date().getFullYear() % 100;
  let counter = readCounter();

  if (counter.year !== currentYear) {
    counter = { year: currentYear, next: 1 };
  }

  const numero = `PG ${String(counter.next).padStart(4, "0")}/${String(
    currentYear,
  ).padStart(2, "0")}`;

  writeCounter({ year: currentYear, next: counter.next + 1 });

  return numero;
}
