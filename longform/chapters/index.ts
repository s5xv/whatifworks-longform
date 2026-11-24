import React from 'react';
import { Chapter01 } from './ch01';
import { Chapter02 } from './ch02';
import { WordTiming } from '../components/KineticCaptions';

export interface ChapterComponentProps {
  title?: string;
  skyColor?: string;
  fogColor?: string;
  audioPath?: string | null;
  wordsPath?: string | null;
  words?: WordTiming[];
}

export const CHAPTER_REGISTRY: Record<string, React.FC<ChapterComponentProps>> = {
  ch01: Chapter01,
  ch02: Chapter02,
};
