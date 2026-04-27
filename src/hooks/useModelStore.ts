import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ModelStore {
  modelName: string;
  setModelName: (modelName: string) => void;
}

export const useModelStore = create<ModelStore>()(
  persist(
    (set) => ({
      modelName: process.env.MODEL_NAME || 'gemini-3.1-pro-preview',
      setModelName: (modelName) => set({ modelName }),
    }),
    {
      name: 'model-selection-storage',
    }
  )
);