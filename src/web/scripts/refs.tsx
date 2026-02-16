import { Ref } from 'preact';

export function mergeRefs<T>(...refs: (Ref<T> | null | undefined)[]): Ref<T> {
  return (element) => refs.forEach(ref => {
    if (typeof ref === 'function') {
      ref(element);
    } else if (ref) {
      ref.current = element;
    }
  });
}
