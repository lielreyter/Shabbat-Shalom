import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ShabbatModePersistedState,
  ShabbatModeState,
  ShabbatModeStatus,
} from "./shabbatModeTypes";

const STATE_STORAGE_KEY = "shabbatMode:state";
// Local state is the source of truth during Shabbat, survives restarts.

const defaultState: ShabbatModePersistedState = {
  state: {
    status: ShabbatModeStatus.INACTIVE,
    startedAt: null,
    endedAt: null,
    brokenAt: null,
  },
  weekId: null,
  streakBroken: false,
  updatedAtIso: new Date(0).toISOString(),
};

let cachedState: ShabbatModePersistedState = { ...defaultState };

const parseState = (raw: string): ShabbatModePersistedState => {
  const parsed = JSON.parse(raw) as ShabbatModePersistedState;
  return {
    state: {
      status: parsed.state.status,
      startedAt: parsed.state.startedAt ? new Date(parsed.state.startedAt) : null,
      endedAt: parsed.state.endedAt ? new Date(parsed.state.endedAt) : null,
      brokenAt: parsed.state.brokenAt ? new Date(parsed.state.brokenAt) : null,
    },
    weekId: parsed.weekId ?? null,
    streakBroken: Boolean(parsed.streakBroken),
    updatedAtIso: parsed.updatedAtIso ?? new Date(0).toISOString(),
  };
};

const serializeState = (
  state: ShabbatModePersistedState
): ShabbatModePersistedState => ({
  ...state,
  state: {
    ...state.state,
    startedAt: state.state.startedAt,
    endedAt: state.state.endedAt,
    brokenAt: state.state.brokenAt,
  },
});

const persistState = async (
  nextState: ShabbatModePersistedState
): Promise<void> => {
  cachedState = nextState;
  await AsyncStorage.setItem(
    STATE_STORAGE_KEY,
    JSON.stringify(serializeState(nextState))
  );
};

export const loadShabbatModeState =
  async (): Promise<ShabbatModePersistedState> => {
    const raw = await AsyncStorage.getItem(STATE_STORAGE_KEY);
    if (!raw) {
      cachedState = { ...defaultState };
      return cachedState;
    }
    try {
      cachedState = parseState(raw);
      return cachedState;
    } catch {
      cachedState = { ...defaultState };
      return cachedState;
    }
  };

export const getCurrentState = (): ShabbatModeState => cachedState.state;

export const getCurrentWeekId = (): string | null => cachedState.weekId;

export const isStreakBroken = (): boolean => cachedState.streakBroken;

export const setActiveState = async (weekId: string): Promise<void> => {
  const now = new Date();
  await persistState({
    state: {
      status: ShabbatModeStatus.ACTIVE,
      startedAt: now,
      endedAt: null,
      brokenAt: null,
    },
    weekId,
    streakBroken: false,
    updatedAtIso: now.toISOString(),
  });
};

export const setInactiveState = async (): Promise<void> => {
  const now = new Date();
  await persistState({
    state: {
      status: ShabbatModeStatus.INACTIVE,
      startedAt: cachedState.state.startedAt,
      endedAt: now,
      brokenAt: cachedState.state.brokenAt,
    },
    weekId: cachedState.weekId,
    streakBroken: cachedState.streakBroken,
    updatedAtIso: now.toISOString(),
  });
};

export const setBrokenState = async (): Promise<void> => {
  const now = new Date();
  await persistState({
    state: {
      status: ShabbatModeStatus.BROKEN,
      startedAt: cachedState.state.startedAt,
      endedAt: null,
      brokenAt: now,
    },
    weekId: cachedState.weekId,
    streakBroken: true,
    updatedAtIso: now.toISOString(),
  });
};
