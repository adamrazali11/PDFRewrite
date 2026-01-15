
export enum EditorMode {
  VIEW = 'VIEW',
  ADD = 'ADD'
}

export type TextAlign = 'left' | 'center' | 'right';

export interface Modification {
  id: string;
  pageIndex: number;
  x: number; // PDF coordinates (points)
  y: number; // PDF coordinates (points)
  width: number;
  height: number;
  type: 'edit' | 'add';
  text: string;
  originalText?: string;
  fontSize: number;
  fontName: string;
  isBold: boolean;
  isItalic: boolean;
  textAlign: TextAlign;
}

export interface PDFState {
  file: File | null;
  numPages: number;
  currentPage: number;
  zoom: number;
  modifications: Modification[];
}
