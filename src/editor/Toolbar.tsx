import { useCallback, useState } from 'react';
import { useUiStore } from '../store/ui';
import {
  Bold,
  Italic,
  Underline as UIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  ListChecks,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Highlighter,
  Undo,
  Redo,
  Table as TableIcon,
  Quote,
  Code,
  Image as ImageIcon,
  Paperclip,
  Upload,
  Superscript as SuperIcon,
  Subscript as SubIcon,
  Search,
} from 'lucide-react';
import type { Editor } from '@tiptap/react';

export interface EditorToolbarHandlers {
  onUploadImage?: () => void;
  onUploadAttachment?: () => void;
  onImportFile?: () => void;
  onOpenFind?: () => void;
}

interface ToolbarProps {
  editor: Editor | null;
  fontFamilies: string[];
  handlers?: EditorToolbarHandlers;
}

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '30px', '36px'];
const LINE_HEIGHTS = ['1.0', '1.15', '1.5', '1.75', '2.0', '2.5'];
const PRESET_COLORS = [
  '#1b1b1d',
  '#5e5ce6',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#94a3b8',
];
const HIGHLIGHTS = ['#FEF3C7', '#FCE7F3', '#DBEAFE', '#DCFCE7', '#E0E7FF', '#F3F4F6'];

function ToolButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`h-8 min-w-8 px-2 rounded-md flex items-center justify-center text-sm transition-colors ${
        active
          ? 'bg-liquid-indigo/15 text-liquid-indigo'
          : 'text-text-secondary hover:bg-black/5 hover:text-text-primary'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-black/10 mx-1" />;
}

export function EditorToolbar({ editor, fontFamilies, handlers }: ToolbarProps) {
  const [showColor, setShowColor] = useState(false);
  const [showHL, setShowHL] = useState(false);
  const promptDialog = useUiStore((s) => s.promptDialog);

  const setLink = useCallback(async () => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = await promptDialog({
      title: '插入链接',
      message: '请输入链接地址（留空可移除现有链接）：',
      defaultValue: previous ?? '',
      placeholder: 'https://...',
      confirmText: '确定',
    });
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor, promptDialog]);

  if (!editor) return null;

  return (
    <div className="editor-toolbar no-print sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-12 px-4 sm:px-6 lg:px-12 pt-2 pb-2 bg-paper-white/95 backdrop-blur border-b border-black/5">
      <div className="flex flex-wrap items-center gap-1">
        <ToolButton title="撤销" onClick={() => editor.chain().focus().undo().run()}>
          <Undo size={16} />
        </ToolButton>
        <ToolButton title="重做" onClick={() => editor.chain().focus().redo().run()}>
          <Redo size={16} />
        </ToolButton>

        <Divider />

        <select
          className="h-8 px-2 text-sm rounded-md bg-white border border-black/10 text-text-secondary hover:text-text-primary"
          onChange={(e) => {
            const value = e.target.value;
            if (value === 'p') editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: Number(value) as 1 | 2 | 3 }).run();
          }}
          value={
            editor.isActive('heading', { level: 1 })
              ? '1'
              : editor.isActive('heading', { level: 2 })
                ? '2'
                : editor.isActive('heading', { level: 3 })
                  ? '3'
                  : 'p'
          }
          title="段落样式"
        >
          <option value="p">正文</option>
          <option value="1">标题 1</option>
          <option value="2">标题 2</option>
          <option value="3">标题 3</option>
        </select>

        <select
          className="h-8 px-2 text-sm rounded-md bg-white border border-black/10 text-text-secondary hover:text-text-primary"
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') editor.chain().focus().unsetFontFamily().run();
            else editor.chain().focus().setFontFamily(v).run();
          }}
          defaultValue=""
          title="字体"
        >
          <option value="">默认字体</option>
          {fontFamilies.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f}
            </option>
          ))}
        </select>

        <select
          className="h-8 px-2 text-sm rounded-md bg-white border border-black/10 text-text-secondary hover:text-text-primary"
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') editor.chain().focus().unsetFontSize().run();
            else editor.chain().focus().setFontSize(v).run();
          }}
          defaultValue=""
          title="字号"
        >
          <option value="">字号</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <Divider />

        <ToolButton title="加粗" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={16} />
        </ToolButton>
        <ToolButton title="斜体" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={16} />
        </ToolButton>
        <ToolButton
          title="下划线"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UIcon size={16} />
        </ToolButton>
        <ToolButton title="删除线" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough size={16} />
        </ToolButton>
        <ToolButton
          title="上标"
          active={editor.isActive('superscript')}
          onClick={() =>
            (editor.chain().focus() as unknown as {
              toggleSuperscript: () => { run: () => boolean };
            })
              .toggleSuperscript()
              .run()
          }
        >
          <SuperIcon size={16} />
        </ToolButton>
        <ToolButton
          title="下标"
          active={editor.isActive('subscript')}
          onClick={() =>
            (editor.chain().focus() as unknown as {
              toggleSubscript: () => { run: () => boolean };
            })
              .toggleSubscript()
              .run()
          }
        >
          <SubIcon size={16} />
        </ToolButton>

        <div className="relative">
          <ToolButton title="字体颜色" onClick={() => setShowColor((s) => !s)}>
            <span className="w-4 h-4 rounded border" style={{ background: editor.getAttributes('textStyle').color ?? '#1b1b1d' }} />
          </ToolButton>
          {showColor && (
            <div className="absolute top-9 left-0 z-20 p-2 bg-white border border-black/10 rounded-lg shadow-lg flex gap-1.5 flex-wrap w-40">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className="w-6 h-6 rounded border border-black/10"
                  style={{ background: c }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().setColor(c).run();
                    setShowColor(false);
                  }}
                />
              ))}
              <button
                className="text-xs text-text-secondary mt-1 w-full"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().unsetColor().run();
                  setShowColor(false);
                }}
              >
                清除颜色
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <ToolButton title="背景高亮" active={editor.isActive('highlight')} onClick={() => setShowHL((s) => !s)}>
            <Highlighter size={16} />
          </ToolButton>
          {showHL && (
            <div className="absolute top-9 left-0 z-20 p-2 bg-white border border-black/10 rounded-lg shadow-lg flex gap-1.5 flex-wrap w-44">
              {HIGHLIGHTS.map((c) => (
                <button
                  key={c}
                  className="w-6 h-6 rounded border border-black/10"
                  style={{ background: c }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().toggleHighlight({ color: c }).run();
                    setShowHL(false);
                  }}
                />
              ))}
              <button
                className="text-xs text-text-secondary mt-1 w-full"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().unsetHighlight().run();
                  setShowHL(false);
                }}
              >
                清除高亮
              </button>
            </div>
          )}
        </div>

        <Divider />

        <ToolButton
          title="左对齐"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft size={16} />
        </ToolButton>
        <ToolButton
          title="居中"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter size={16} />
        </ToolButton>
        <ToolButton
          title="右对齐"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight size={16} />
        </ToolButton>
        <ToolButton
          title="两端对齐"
          active={editor.isActive({ textAlign: 'justify' })}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        >
          <AlignJustify size={16} />
        </ToolButton>

        <select
          className="h-8 px-2 text-sm rounded-md bg-white border border-black/10 text-text-secondary hover:text-text-primary"
          onChange={(e) => {
            const v = e.target.value;
            if (v === '')
              (editor.chain().focus() as unknown as {
                unsetLineHeight: () => { run: () => boolean };
              })
                .unsetLineHeight()
                .run();
            else
              (editor.chain().focus() as unknown as {
                setLineHeight: (v: string) => { run: () => boolean };
              })
                .setLineHeight(v)
                .run();
          }}
          defaultValue=""
          title="行高"
        >
          <option value="">行高</option>
          {LINE_HEIGHTS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>

        <Divider />

        <ToolButton title="无序列表" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={16} />
        </ToolButton>
        <ToolButton title="有序列表" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={16} />
        </ToolButton>
        <ToolButton
          title="任务列表"
          active={editor.isActive('taskList')}
          onClick={() => (editor.chain().focus() as unknown as { toggleTaskList: () => { run: () => boolean } }).toggleTaskList().run()}
        >
          <ListChecks size={16} />
        </ToolButton>

        <Divider />

        <ToolButton title="标题 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 size={16} />
        </ToolButton>
        <ToolButton title="标题 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={16} />
        </ToolButton>
        <ToolButton title="标题 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 size={16} />
        </ToolButton>
        <ToolButton title="引用" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={16} />
        </ToolButton>
        <ToolButton title="代码块" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code size={16} />
        </ToolButton>

        <Divider />

        <ToolButton title="链接" active={editor.isActive('link')} onClick={setLink}>
          <LinkIcon size={16} />
        </ToolButton>

        <ToolButton
          title="插入 3x3 表格"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TableIcon size={16} />
        </ToolButton>

        {handlers?.onUploadImage && (
          <ToolButton title="插入图片" onClick={handlers.onUploadImage}>
            <ImageIcon size={16} />
          </ToolButton>
        )}
        {handlers?.onUploadAttachment && (
          <ToolButton title="插入附件" onClick={handlers.onUploadAttachment}>
            <Paperclip size={16} />
          </ToolButton>
        )}
        {handlers?.onImportFile && (
          <ToolButton title="导入 docx / md" onClick={handlers.onImportFile}>
            <Upload size={16} />
          </ToolButton>
        )}
        {handlers?.onOpenFind && (
          <ToolButton title="查找替换 (Ctrl+F)" onClick={handlers.onOpenFind}>
            <Search size={16} />
          </ToolButton>
        )}
      </div>
    </div>
  );
}
