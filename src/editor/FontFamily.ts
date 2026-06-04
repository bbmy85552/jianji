import { Extension } from '@tiptap/core';
import '@tiptap/extension-text-style';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontFamily: {
      setFontFamily: (family: string | null) => ReturnType;
      unsetFontFamily: () => ReturnType;
    };
  }
}

export const FontFamily = Extension.create({
  name: 'fontFamily',
  addOptions() {
    return { types: ['textStyle'] as string[] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontFamily?.replace(/['"]+/g, '') || null,
            renderHTML: (attrs: Record<string, string | null>) =>
              attrs.fontFamily ? { style: `font-family: ${attrs.fontFamily}` } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontFamily:
        (family: string | null) =>
        ({ chain }: any) =>
          chain().setMark('textStyle', { fontFamily: family }).run(),
      unsetFontFamily:
        () =>
        ({ chain }: any) =>
          chain().setMark('textStyle', { fontFamily: null }).removeEmptyTextStyle().run(),
    } as any;
  },
});
