export interface Inspection {
  _id?: string;
  id?: string;
  name: string;
  status: string;
  date: Date | string;
  headerImage?: string; // URL for the report header image
  headerText?: string; // Text to display on header image
}

export interface Defect {
  _id?: string;
  id?: string;
  inspection_id: string;
  image_url: string;
  location: string;
  section: string;
  subsection: string;
  defect_description: string;
  material_names: string[];
  material_total_cost: number;
  labor_type: string;
  labor_rate: number;
  hours_required: number;
  recommendation: string;
  isThreeSixty?: boolean; // 360° photo flag
  additional_images?: Array<{ url: string; location: string; isThreeSixty?: boolean }>; // Multiple location photos (supports 360)
  base_cost?: number; // Base cost (AI-calculated from first image)
}