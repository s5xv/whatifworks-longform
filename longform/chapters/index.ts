import React from 'react';
import { Chapter01 } from './ch01';
import { Chapter02 } from './ch02';
import { Chapter03 } from './ch03';
import { Chapter04 } from './ch04';
import { Chapter05 } from './ch05';
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
  ch03: Chapter03,
  ch04: Chapter04,
  ch05: Chapter05,
};
