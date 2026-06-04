import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CharacterCount from '@tiptap/extension-character-count';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { FontSize } from './FontSize';
import { FontFamily } from './FontFamily';
import { LineHeight } from './LineHeight';
import { FindReplacePanel } from './FindReplacePanel';
import { EditorToolbar, type EditorToolbarHandlers } from './Toolbar';

interface Props {
  initialContent: string;
  onChange: (json: string) => void;
  fontFamilies: string[];
  editable?: boolean;
  handlers?: EditorToolbarHandlers;
}

export interface RichEditorRef {
  editor: TiptapEditor | null;
  setContent: (content: string) => void;
}

export const RichEditor = forwardRef<RichEditorRef, Props>(function RichEditor(
  { initialContent, onChange, fontFamilies, editable = true, handlers },
  ref,
) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const initialContentInput = useMemo(() => {
    if (!initialContent) return '';
    if (initialContent.trim().startsWith('{')) {
      try {
        return JSON.parse(initialContent);
      } catch {
        return initialContent;
      }
    }
    return initialContent;
  }, [initialContent]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { target: '_blank' } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ inline: false, allowBase64: false, HTMLAttributes: { class: 'doc-image' } }),
      TaskList.configure({ HTMLAttributes: { class: 'doc-tasklist' } }),
      TaskItem.configure({ nested: true, HTMLAttributes: { class: 'doc-taskitem' } }),
      CharacterCount.configure(),
      Superscript,
      Subscript,
      FontSize,
      FontFamily,
      LineHeight,
    ],
    content: initialContentInput,
    editable,
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getHTML());
      setCounts({
        characters: editor.storage.characterCount?.characters() ?? 0,
        words: editor.storage.characterCount?.words() ?? 0,
      });
    },
  });
  const [counts, setCounts] = useState({ characters: 0, words: 0 });
  const [findOpen, setFindOpen] = useState(false);

  useEffect(() => {
    if (!editor) return;
    setCounts({
      characters: editor.storage.characterCount?.characters() ?? 0,
      words: editor.storage.characterCount?.words() ?? 0,
    });
  }, [editor]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!editable) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        const target = e.target as HTMLElement | null;
        const inEditor = target?.closest?.('.rich-editor');
        if (!inEditor) return;
        e.preventDefault();
        setFindOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editable]);

  useImperativeHandle(
    ref,
    () => ({
      editor,
      setContent(content: string) {
        if (!editor) return;
        const v = content.trim().startsWith('{')
          ? (() => {
              try {
                return JSON.parse(content);
              } catch {
                return content;
              }
            })()
          : content;
        editor.commands.setContent(v, true);
      },
    }),
    [editor],
  );

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  const toolbarHandlers: EditorToolbarHandlers = {
    ...handlers,
    onOpenFind: () => setFindOpen(true),
  };

  return (
    <div className="rich-editor">
      <EditorToolbar editor={editor} fontFamilies={fontFamilies} handlers={toolbarHandlers} />
      <EditorContent editor={editor} className="ProseMirror-host" />
      <div className="editor-status no-print text-xs text-text-secondary mt-2 px-1 flex items-center justify-end gap-3">
        <span>{counts.words} 词</span>
        <span>{counts.characters} 字符</span>
      </div>
      <FindReplacePanel editor={editor} open={findOpen} onClose={() => setFindOpen(false)} />
    </div>
  );
});
