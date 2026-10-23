export type TaskState = 'open' | 'accepted' | 'in-progress' | 'awaiting-confirmation' | 'completed' | 'cancelled';

export type TimeBankTask = {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  memberName: string;
  startsAt: string;
  durationSeconds: number;
  direction: 'give' | 'receive';
  state: TaskState;
  memberConfirmed: boolean;
  partnerConfirmed: boolean;
};

export type LedgerEntry = {
  id: string;
  taskId?: string;
  postedAt: string;
  title: string;
  counterparty: string;
  seconds: number;
  status: 'posted' | 'reserved';
};

export type BankState = {
  confirmedSeconds: number;
  tasks: TimeBankTask[];
  ledger: LedgerEntry[];
};

export type RequestDraft = {
  title: string;
  description: string;
  category: string;
  location: string;
  startsAt: string;
  durationSeconds: number;
};

export type BankAction =
  | { type: 'request'; task: TimeBankTask }
  | { type: 'accept' | 'advance' | 'confirm-member' | 'confirm-partner' | 'cancel'; taskId: string; at: string };

export function reservedSeconds(bank: BankState) {
  return bank.tasks
    .filter((task) => task.direction === 'receive' && !['completed', 'cancelled'].includes(task.state))
    .reduce((total, task) => total + task.durationSeconds, 0);
}

export function availableSeconds(bank: BankState) {
  return bank.confirmedSeconds - reservedSeconds(bank);
}

export function validateRequest(draft: RequestDraft, available: number, now = Date.now()) {
  if (draft.title.trim().length < 3) throw new Error('Describe the task with a title of at least 3 characters.');
  if (!draft.description.trim()) throw new Error('Add a short description of the help you need.');
  if (!draft.category.trim()) throw new Error('Choose a task category.');
  if (!draft.location.trim()) throw new Error('Add a meeting area.');
  if (!Number.isSafeInteger(draft.durationSeconds) || draft.durationSeconds < 900 || draft.durationSeconds > 14400 || draft.durationSeconds % 900 !== 0) {
    throw new Error('Choose a duration between 15 minutes and 4 hours, in 15-minute steps.');
  }
  if (!Number.isFinite(Date.parse(draft.startsAt)) || Date.parse(draft.startsAt) <= now) {
    throw new Error('Choose a valid date and time in the future.');
  }
  if (draft.durationSeconds > available) throw new Error('You do not have enough available time for this request.');
}

export function parseRequestDate(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim()) || !/^\d{2}:\d{2}$/.test(time.trim())) {
    throw new Error('Enter the date as YYYY-MM-DD and time as HH:MM (24-hour time).');
  }
  const [year, month, day] = date.trim().split('-').map(Number);
  const [hour, minute] = time.trim().split(':').map(Number);
  const startsAt = new Date(year, month - 1, day, hour, minute);
  if (startsAt.getFullYear() !== year || startsAt.getMonth() !== month - 1 || startsAt.getDate() !== day || startsAt.getHours() !== hour || startsAt.getMinutes() !== minute) {
    throw new Error('Choose a valid calendar date and time.');
  }
  return startsAt.toISOString();
}

export function bankReducer(bank: BankState, action: BankAction): BankState {
  if (action.type === 'request') {
    if (bank.tasks.some((task) => task.id === action.task.id)) return bank;
    validateRequest(action.task, availableSeconds(bank));
    if (action.task.direction !== 'receive' || action.task.state !== 'open' || action.task.memberConfirmed || action.task.partnerConfirmed) {
      throw new Error('New requests must be open and unconfirmed.');
    }
    return { ...bank, tasks: [...bank.tasks, action.task] };
  }

  const task = bank.tasks.find((candidate) => candidate.id === action.taskId);
  if (!task) throw new Error('This task is no longer available.');
  let updated = { ...task };
  switch (action.type) {
    case 'accept':
      if (task.state === 'accepted') return bank;
      if (task.state !== 'open') throw new Error('Only open requests can be accepted.');
      updated.state = 'accepted';
      if (task.direction === 'receive') updated.memberName = 'Demo helper';
      break;
    case 'advance':
      if (task.state !== 'accepted' && task.state !== 'in-progress') throw new Error('This task is not ready to start or finish.');
      updated.state = task.state === 'accepted' ? 'in-progress' : 'awaiting-confirmation';
      break;
    case 'confirm-member':
    case 'confirm-partner':
      if (task.state === 'completed') return bank;
      if (task.state !== 'awaiting-confirmation') throw new Error('Finish the task before confirming its time.');
      updated[action.type === 'confirm-member' ? 'memberConfirmed' : 'partnerConfirmed'] = true;
      if (updated.memberConfirmed && updated.partnerConfirmed) updated.state = 'completed';
      break;
    case 'cancel':
      if (task.state === 'cancelled') return bank;
      if (task.state !== 'open' || task.direction !== 'receive') throw new Error('Only your open requests can be cancelled in this demo.');
      updated.state = 'cancelled';
      break;
  }
  const tasks = bank.tasks.map((candidate) => candidate.id === task.id ? updated : candidate);
  if (updated.state !== 'completed' || bank.ledger.some((entry) => entry.id === `ledger-${task.id}`)) {
    return { ...bank, tasks };
  }
  const seconds = task.direction === 'give' ? task.durationSeconds : -task.durationSeconds;
  return {
    tasks,
    confirmedSeconds: bank.confirmedSeconds + seconds,
    ledger: [{
      id: `ledger-${task.id}`, taskId: task.id, postedAt: action.at,
      title: task.title, counterparty: updated.memberName, seconds, status: 'posted',
    }, ...bank.ledger],
  };
}

export function createDemoBank(now = new Date()): BankState {
  const scheduled = (days: number, hour: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    date.setHours(hour, 0, 0, 0);
    return date.toISOString();
  };
  const task = (id: string, title: string, category: string, location: string, memberName: string, days: number, hour: number, durationSeconds: number, state: TaskState): TimeBankTask => ({
    id, title, category, location, memberName, startsAt: scheduled(days, hour),
    durationSeconds, state, direction: 'give', memberConfirmed: false, partnerConfirmed: false,
    description: 'Agree on the arrangements together before starting. The duration shown is the time proposed for this demo exchange.',
  });
  return {
    confirmedSeconds: 15600,
    tasks: [
      task('task-groceries', 'Grocery collection', 'Errand', 'Sha Tin Market', 'Mrs Wong', 1, 14, 2700, 'accepted'),
      task('task-phone', 'Set up a new phone', 'Technology', 'Lek Yuen Estate', 'Mr Chan', 2, 10, 3600, 'open'),
      task('task-garden', 'Water balcony plants', 'Home', 'City One', 'Auntie Mei', 3, 9, 1800, 'open'),
      task('task-walk', 'Companion walk', 'Company', 'Sha Tin Park', 'Daniel', 4, 16, 2700, 'open'),
    ],
    ledger: [
      { id: 'opening', postedAt: now.toISOString(), title: 'Sample opening balance', counterparty: 'Demo only', seconds: 11400, status: 'posted' },
      { id: 'library', postedAt: now.toISOString(), title: 'Library book return', counterparty: 'Mrs Wong', seconds: 2400, status: 'posted' },
      { id: 'window', postedAt: now.toISOString(), title: 'Window cleaning', counterparty: 'Ah Ming', seconds: -3600, status: 'posted' },
      { id: 'clinic', postedAt: now.toISOString(), title: 'Clinic accompaniment', counterparty: 'Mr Ho', seconds: 5400, status: 'posted' },
    ],
  };
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(Math.abs(seconds) / 60);
  const hours = Math.floor(minutes / 60);
  if (!hours) return `${minutes}m`;
  return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
}

export function formatTaskDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export const TASK_STATUS: Record<TaskState, string> = {
  open: 'Waiting for a helper', accepted: 'Upcoming', 'in-progress': 'In progress',
  'awaiting-confirmation': 'Waiting for confirmation', completed: 'Completed', cancelled: 'Cancelled',
};
