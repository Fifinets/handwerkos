import { EntryType } from './types';

export const PROJECT_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-900', border: 'border-blue-500', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-100', text: 'text-emerald-900', border: 'border-emerald-500', dot: 'bg-emerald-500' },
  { bg: 'bg-orange-100', text: 'text-orange-900', border: 'border-orange-500', dot: 'bg-orange-500' },
  { bg: 'bg-purple-100', text: 'text-purple-900', border: 'border-purple-500', dot: 'bg-purple-500' },
  { bg: 'bg-pink-100', text: 'text-pink-900', border: 'border-pink-500', dot: 'bg-pink-500' },
  { bg: 'bg-teal-100', text: 'text-teal-900', border: 'border-teal-500', dot: 'bg-teal-500' },
  { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-500', dot: 'bg-amber-500' },
  { bg: 'bg-indigo-100', text: 'text-indigo-900', border: 'border-indigo-500', dot: 'bg-indigo-500' },
  { bg: 'bg-rose-100', text: 'text-rose-900', border: 'border-rose-500', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-100', text: 'text-cyan-900', border: 'border-cyan-500', dot: 'bg-cyan-500' },
] as const;

export type ProjectColor = typeof PROJECT_COLORS[number];

export const VACATION_COLOR = { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-400', dot: 'bg-amber-400' } as const;
export const SICK_COLOR = { bg: 'bg-red-100', text: 'text-red-900', border: 'border-red-400', dot: 'bg-red-400' } as const;

export const ENTRY_TYPE_STYLES: Record<EntryType, { active: string; label: string }> = {
  project: { active: 'border-blue-500 bg-blue-50 text-blue-700', label: 'Projekt' },
  vacation: { active: 'border-amber-500 bg-amber-50 text-amber-700', label: 'Urlaub' },
  sick: { active: 'border-red-500 bg-red-50 text-red-700', label: 'Krank' },
};
