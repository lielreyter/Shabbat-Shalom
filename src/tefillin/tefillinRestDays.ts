type HebcalHolidayItem = {
  title?: string;
  date?: string;
  category?: string;
  yomtov?: boolean;
};

type HebcalHolidayResponse = {
  items?: HebcalHolidayItem[];
};

const restDateCache = new Map<number, Set<string>>();

const titleIsTefillinRestHoliday = (title: string): boolean => {
  const normalized = title.toLowerCase();
  return [
    "rosh hashana",
    "yom kippur",
    "sukkot i",
    "sukkot ii",
    "shmini atzeret",
    "simchat torah",
    "pesach i",
    "pesach ii",
    "pesach vii",
    "pesach viii",
    "chol hamoed pesach",
    "chol hamoed sukkot",
    "shavuot i",
    "shavuot ii",
  ].some((holiday) => normalized.includes(holiday));
};

const loadHebcalRestDatesForYear = async (year: number): Promise<Set<string>> => {
  const cached = restDateCache.get(year);
  if (cached) return cached;

  const params = new URLSearchParams({
    v: "1",
    cfg: "json",
    year: String(year),
    maj: "on",
    min: "off",
    mod: "off",
    nx: "off",
    ss: "off",
    mf: "off",
    c: "off",
    geo: "none",
  });
  const response = await fetch(`https://www.hebcal.com/hebcal?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Could not load Jewish holiday calendar.");
  }

  const data = (await response.json()) as HebcalHolidayResponse;
  const restDates = new Set<string>();
  for (const item of data.items ?? []) {
    if (!item.date) continue;
    const date = item.date.slice(0, 10);
    const title = item.title ?? "";
    if (item.yomtov === true || titleIsTefillinRestHoliday(title)) {
      restDates.add(date);
    }
  }
  restDateCache.set(year, restDates);
  return restDates;
};

export const isTefillinRestDate = async (dateStr: string): Promise<boolean> => {
  const date = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  if (date.getUTCDay() === 6) return true;

  try {
    const restDates = await loadHebcalRestDatesForYear(date.getUTCFullYear());
    return restDates.has(dateStr);
  } catch {
    // If Hebcal is unreachable, still preserve the always-known Shabbat rule.
    return false;
  }
};

export const previousTefillinEligibleDate = async (dateStr: string): Promise<string | null> => {
  let cursor = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(cursor.getTime())) return null;

  for (let i = 0; i < 21; i++) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const candidate = cursor.toISOString().slice(0, 10);
    if (!(await isTefillinRestDate(candidate))) {
      return candidate;
    }
  }

  return null;
};
