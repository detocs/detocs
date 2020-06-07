// Copy of react-id-generator's useId that uses Preact hooks
// https://github.com/Tomekmularczyk/react-id-generator
/*
MIT License

Copyright (c) 2019 Tomek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
import { useRef, useEffect } from 'preact/hooks';

import nextId from '@util/next-id';

const getIds = (count: number, prefix?: string): string[] => {
  const ids = [];
  for (let i = 0; i < count; i++) {
    ids.push(nextId(prefix));
  }
  return ids;
};

function usePrevious(value: unknown): unknown {
  const ref = useRef<unknown>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

export default function useId(count = 1, prefix?: string): string[] {
  const idsListRef = useRef<string[]>([]);
  const prevCount = usePrevious(count);
  const prevPrefix = usePrevious(prefix);

  if (count !== prevCount || prevPrefix !== prefix) {
    idsListRef.current = getIds(count, prefix);
  }

  return idsListRef.current;
}

