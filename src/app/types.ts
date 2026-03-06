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

export const MEDIA_OPTIONS = ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5'];

export const PRODUCT_OPTIONS = [
  'Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5',
  'Option 6', 'Option 7', 'Option 8', 'Option 9', 'Option 10',
  'Option 11', 'Option 12', 'Option 13', 'Option 14', 'Option 15'
];
