export interface LineData {
  media: string;
  product: string;
  qc: 'Yes' | 'No';
}

export interface SystemState {
  L1: LineData;
  L2: LineData;
  L3: LineData;
  L4: LineData;
}
export interface OptionItem {
  id: number;
  name: string;
}
