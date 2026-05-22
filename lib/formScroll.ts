import { useCallback, useRef } from 'react';
import type { ScrollView, View } from 'react-native';
import type { EmailEntry } from './clientContact';

export type ClientFormFieldErrors = {
  firstName?: string;
  name?: string;
  emails?: Record<string, string>;
};

export function emailFieldScrollKey(entryKey: string): string {
  return `email:${entryKey}`;
}

export function clientFormErrorScrollKeys(
  errors: ClientFormFieldErrors,
  emailEntries: EmailEntry[],
): string[] {
  const keys: string[] = [];
  if (errors.firstName) keys.push('firstName');
  if (errors.name) keys.push('name');
  if (errors.emails) {
    for (const entry of emailEntries) {
      if (errors.emails[entry.key]) {
        keys.push(emailFieldScrollKey(entry.key));
        break;
      }
    }
  }
  return keys;
}

export function useFormScrollToError() {
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const fieldRefs = useRef(new Map<string, View>());

  const registerField = useCallback(
    (key: string) => (node: View | null) => {
      if (node) fieldRefs.current.set(key, node);
      else fieldRefs.current.delete(key);
    },
    [],
  );

  const scrollToFirstError = useCallback((keys: readonly string[], offset = 24) => {
    const run = () => {
      const scroll = scrollRef.current;
      const content = contentRef.current;
      if (!scroll || !content) return;

      for (const key of keys) {
        const field = fieldRefs.current.get(key);
        if (!field) continue;

        field.measureLayout(
          content,
          (_x, y) => {
            scroll.scrollTo({ y: Math.max(0, y - offset), animated: true });
          },
          () => {},
        );
        return;
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });
  }, []);

  return { scrollRef, contentRef, registerField, scrollToFirstError };
}
