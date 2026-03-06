import { SystemState } from '../types';

const STORAGE_KEY = 'hmi_system_state';

export const getSystemState = (): SystemState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse stored state:', e);
    }
  }
  
  // Default state
  return {
    L1: { media: 'Option 1', product: 'Option 1', qc: 'Yes' },
    L2: { media: 'Option 1', product: 'Option 1', qc: 'No' },
    L3: { media: 'Option 1', product: 'Option 1', qc: 'Yes' },
    L4: { media: 'Option 1', product: 'Option 1', qc: 'No' },
  };
};

export const setSystemState = (state: SystemState): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  // Dispatch storage event for cross-tab/screen communication
  window.dispatchEvent(new StorageEvent('storage', {
    key: STORAGE_KEY,
    newValue: JSON.stringify(state),
  }));
};
