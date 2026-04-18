import { create } from "zustand";

interface ReviewFileState {
  notes: string;
  checklistById: Record<string, boolean>;
}

interface InspectorReviewStore {
  reviewStateByThreadId: Record<string, Record<string, ReviewFileState>>;
  setNotes: (threadId: string, filePath: string, notes: string) => void;
  setChecklistItem: (threadId: string, filePath: string, itemId: string, checked: boolean) => void;
}

function ensureFileState(
  reviewStateByThreadId: InspectorReviewStore["reviewStateByThreadId"],
  threadId: string,
  filePath: string,
): ReviewFileState {
  return (
    reviewStateByThreadId[threadId]?.[filePath] ?? {
      notes: "",
      checklistById: {},
    }
  );
}

export const useInspectorReviewStore = create<InspectorReviewStore>()((set) => ({
  reviewStateByThreadId: {},
  setNotes: (threadId, filePath, notes) =>
    set((state) => ({
      reviewStateByThreadId: {
        ...state.reviewStateByThreadId,
        [threadId]: {
          ...state.reviewStateByThreadId[threadId],
          [filePath]: {
            ...ensureFileState(state.reviewStateByThreadId, threadId, filePath),
            notes,
          },
        },
      },
    })),
  setChecklistItem: (threadId, filePath, itemId, checked) =>
    set((state) => {
      const existing = ensureFileState(state.reviewStateByThreadId, threadId, filePath);
      return {
        reviewStateByThreadId: {
          ...state.reviewStateByThreadId,
          [threadId]: {
            ...state.reviewStateByThreadId[threadId],
            [filePath]: {
              ...existing,
              checklistById: {
                ...existing.checklistById,
                [itemId]: checked,
              },
            },
          },
        },
      };
    }),
}));
