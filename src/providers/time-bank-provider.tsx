import { createContext, PropsWithChildren, useContext, useRef, useState } from 'react';

import {
  availableSeconds, BankAction, bankReducer, createDemoBank, LedgerEntry,
  RequestDraft, reservedSeconds, TimeBankTask, validateRequest,
} from '@/lib/time-bank-model';

export { formatDuration, formatTaskDate, TASK_STATUS } from '@/lib/time-bank-model';
export type { TimeBankTask } from '@/lib/time-bank-model';

type TimeBankContextValue = {
  confirmedSeconds: number;
  availableSeconds: number;
  reservedSeconds: number;
  tasks: TimeBankTask[];
  ledger: LedgerEntry[];
  watchConnected: boolean;
  createRequest: (draft: RequestDraft) => string;
  acceptTask: (taskId: string) => void;
  advanceTask: (taskId: string) => void;
  confirmTask: (taskId: string, partner?: boolean) => void;
  cancelTask: (taskId: string) => void;
  setWatchConnected: (connected: boolean) => void;
};

const TimeBankContext = createContext<TimeBankContextValue | null>(null);

export function TimeBankProvider({ children }: PropsWithChildren) {
  const [bank, setBank] = useState(createDemoBank);
  const bankRef = useRef(bank);
  const nextId = useRef(0);
  const [watchConnected, setWatchConnected] = useState(false);
  const dispatch = (action: BankAction) => {
    const next = bankReducer(bankRef.current, action);
    bankRef.current = next;
    setBank(next);
  };
  const createRequest = (draft: RequestDraft) => {
    validateRequest(draft, availableSeconds(bankRef.current));
    const id = `request-${Date.now()}-${++nextId.current}`;
    dispatch({
      type: 'request',
      task: {
        ...draft, title: draft.title.trim(), description: draft.description.trim(), location: draft.location.trim(),
        id, direction: 'receive', state: 'open', memberName: 'Your community',
        memberConfirmed: false, partnerConfirmed: false,
      },
    });
    return id;
  };

  return (
    <TimeBankContext.Provider value={{
      confirmedSeconds: bank.confirmedSeconds,
      availableSeconds: availableSeconds(bank),
      reservedSeconds: reservedSeconds(bank),
      tasks: bank.tasks,
      ledger: bank.ledger,
      watchConnected,
      createRequest,
      acceptTask: (taskId) => dispatch({ type: 'accept', taskId, at: new Date().toISOString() }),
      advanceTask: (taskId) => dispatch({ type: 'advance', taskId, at: new Date().toISOString() }),
      confirmTask: (taskId, partner = false) => dispatch({ type: partner ? 'confirm-partner' : 'confirm-member', taskId, at: new Date().toISOString() }),
      cancelTask: (taskId) => dispatch({ type: 'cancel', taskId, at: new Date().toISOString() }),
      setWatchConnected,
    }}>
      {children}
    </TimeBankContext.Provider>
  );
}

export function useTimeBank() {
  const context = useContext(TimeBankContext);
  if (!context) throw new Error('useTimeBank must be used inside TimeBankProvider.');
  return context;
}
