import type {
  DiaryEntry,
  ExerciseEntry,
  Meal,
  UserProfile,
} from '../types';

interface WebState {
  profile: UserProfile | null;
  meals: Meal[];
  exercises: ExerciseEntry[];
  diaries: DiaryEntry[];
}

const STORAGE_KEY = 'fitlens:web-state:v1';
const emptyState: WebState = {
  profile: null,
  meals: [],
  exercises: [],
  diaries: [],
};

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readState(): WebState {
  if (!canUseStorage()) return { ...emptyState };
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...emptyState };
  try {
    return { ...emptyState, ...JSON.parse(raw) };
  } catch {
    return { ...emptyState };
  }
}

function writeState(state: WebState): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * 串行化写操作的 Promise 队列。
 *
 * 背景：localStorage 的读-改-写不是原子操作。当多个 saveMeal / saveExercise
 * 并发执行时，每个都会先 readState() 拿到一份旧快照，再各自 concat/filter 后
 * writeState()。后写入的会覆盖先写入的，导致同批并发写入丢数据。
 *
 * 这里用一个 promise 链把所有写操作排成串行队列，每个任务等前一个完成后再
 * 读取最新状态并写入，从而避免读-改-写竞态。读取操作（load*）不进队列，
 * 直接读取当前持久化值即可。
 */
let writeChain: Promise<unknown> = Promise.resolve();

/**
 * 把一个（同步读-改-写的）写任务排入串行队列。
 * fn 内部应执行 readState -> writeState。
 */
function enqueueWrite<T>(fn: () => T): Promise<T> {
  const run = writeChain.then(fn, fn);
  // 链尾始终保持 resolved，避免一次失败拖垮后续写入
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function saveProfile(profile: UserProfile): Promise<UserProfile> {
  return enqueueWrite(() => {
    const state = readState();
    const existingId = state.profile?.id ?? 1;
    const saved = { ...profile, id: profile.id ?? existingId };
    writeState({ ...state, profile: saved });
    return saved;
  });
}

export async function loadProfile(): Promise<UserProfile | null> {
  return readState().profile;
}

export async function saveMeal(meal: Meal): Promise<void> {
  return enqueueWrite(() => {
    const state = readState();
    writeState({
      ...state,
      meals: [...state.meals.filter((m) => m.id !== meal.id), meal],
    });
  });
}

export async function deleteMealDb(id: string): Promise<void> {
  return enqueueWrite(() => {
    const state = readState();
    writeState({ ...state, meals: state.meals.filter((m) => m.id !== id) });
  });
}

export async function loadAllMeals(): Promise<Meal[]> {
  return readState().meals;
}

export async function saveExercise(exercise: ExerciseEntry): Promise<void> {
  return enqueueWrite(() => {
    const state = readState();
    writeState({
      ...state,
      exercises: [...state.exercises.filter((x) => x.id !== exercise.id), exercise],
    });
  });
}

export async function deleteExerciseDb(id: string): Promise<void> {
  return enqueueWrite(() => {
    const state = readState();
    writeState({ ...state, exercises: state.exercises.filter((x) => x.id !== id) });
  });
}

export async function loadAllExercises(): Promise<ExerciseEntry[]> {
  return readState().exercises;
}

export async function upsertDiaryDb(diary: DiaryEntry): Promise<void> {
  return enqueueWrite(() => {
    const state = readState();
    writeState({
      ...state,
      diaries: [...state.diaries.filter((d) => d.date !== diary.date), diary],
    });
  });
}

export async function deleteDiaryDb(id: string): Promise<void> {
  return enqueueWrite(() => {
    const state = readState();
    writeState({ ...state, diaries: state.diaries.filter((d) => d.id !== id) });
  });
}

export async function loadAllDiaries(): Promise<DiaryEntry[]> {
  return readState().diaries;
}
