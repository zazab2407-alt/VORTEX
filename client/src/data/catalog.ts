import type { ColorOption } from '../types';

/** Options shown in the shop filters. Products themselves come from the API. */
export const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'];
export const FILTER_COLORS: ColorOption[] = [
  { name: 'Black', hex: '#0A0A0A' }, { name: 'White', hex: '#F5F5F5' }, { name: 'Orange', hex: '#FF5A1F' },
  { name: 'Grey', hex: '#6B7280' }, { name: 'Navy', hex: '#1E293B' }, { name: 'Olive', hex: '#4D5A3F' }, { name: 'Sand', hex: '#D6C7A8' },
];
