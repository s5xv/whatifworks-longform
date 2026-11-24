import { useEffect, useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';
import { WordTiming } from './KineticCaptions';

export function useChapterWords(wordsPath?: string | null): WordTiming[] {
  const [words, setWords] = useState<WordTiming[]>([]);
  const [handle] = useState(() => (wordsPath ? delayRender(`Loading ${wordsPath}`) : null));

  useEffect(() => {
    if (!wordsPath || handle === null) {
      return;
    }
    let cancelled = false;
    fetch(staticFile(wordsPath))
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setWords(data as WordTiming[]);
        }
      })
      .catch(() => {
        if (!cancelled) setWords([]);
      })
      .finally(() => {
        continueRender(handle);
      });
    return () => {
      cancelled = true;
    };
  }, [wordsPath, handle]);

  return words;
}
