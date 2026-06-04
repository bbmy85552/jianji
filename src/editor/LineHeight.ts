import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (value: string | null) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
  }
}

export interface LineHeightOptions {
  types: string[];
}

export const LineHeight = Extension.create<LineHeightOptions>({
  name: 'lineHeight',

  addOptions() {
    return {
      types: ['paragraph', 'heading', 'listItem', 'taskItem'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el: HTMLElement) => {
              const value = el.style.lineHeight?.trim();
              return value || null;
            },
            renderHTML: (attrs: Record<string, string | null>) => {
              if (!attrs.lineHeight) return {};
              return { style: `line-height: ${attrs.lineHeight}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (value: string | null) =>
        ({ commands, state }: any) => {
          if (!value) return false;
          const types = this.options.types;
          return types
            .map((type) => commands.updateAttributes(type, { lineHeight: value }))
            .some(Boolean);
        },
      unsetLineHeight:
        () =>
        ({ commands }: any) => {
          const types = this.options.types;
          return types
            .map((type) => commands.resetAttributes(type, 'lineHeight'))
            .some(Boolean);
        },
    } as any;
  },
});
