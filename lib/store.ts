import { create } from 'zustand';
import { persist } from 'zustand/middleware';

  interface AnalysisData {
    inspectionId: string;
    imageFile?: File;
    image?: File | string | null;
    description?: string;
    location?: string;
    section?: string;
    subSection?: string;
    analysisResult?: any;
    timestamp?: number;
    selectedArrowColor?: string; // Store the selected arrow color
    annotations?: any[]; // Store annotation shapes for editable re-opening
    // estimated_costs: CostItem[];
  }

interface AnalysisState {
  analysisData: AnalysisData | null;
  setAnalysisData: (data: Omit<AnalysisData, 'timestamp'>) => void;
  updateAnalysisData: (data: Partial<AnalysisData> & { inspectionId: string }) => void;
  clearAnalysisData: () => void;
}

export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set) => ({
      analysisData: null,
      setAnalysisData: (data) => {
        // Convert File to data URL before storing
        const processedData = { ...data };
        if (data.image instanceof File) {
          const reader = new FileReader();
          reader.onload = () => {
            set({
              analysisData: {
                ...processedData,
                image: reader.result as string,
                timestamp: Date.now()
              }
            });
          };
          reader.readAsDataURL(data.image);
        } else {
          set({
            analysisData: {
              ...processedData,
              timestamp: Date.now()
            }
          });
        }
      },
      updateAnalysisData: (data) => set((state) => ({
        analysisData: state.analysisData 
          ? { ...state.analysisData, ...data, timestamp: Date.now() } 
          : { ...data, timestamp: Date.now() }
      })),
      clearAnalysisData: () => set({ analysisData: null }),
    }),
    {
      name: 'analysis-storage',
    }
  )
);