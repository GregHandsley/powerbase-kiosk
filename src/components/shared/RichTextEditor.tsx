import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { useEffect, useMemo } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing...',
  maxLength,
}: RichTextEditorProps) {
  // Memoize extensions to prevent duplicate registration in React strict mode
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    ],
    []
  );

  const editor = useEditor({
    extensions,
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-invert max-w-none focus:outline-none min-h-[150px] px-3 py-2 text-sm text-slate-200',
      },
    },
  });

  // Update editor content when value prop changes externally
  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  const textContent = editor.getText().trim();
  const textLength = textContent.length;

  return (
    <div className="rich-text-editor-wrapper">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-slate-800 border border-slate-700 rounded-t-md flex-wrap">
        {/* Headings */}
        <div className="flex items-center gap-1 border-r border-slate-700 pr-2 mr-1">
          <button
            type="button"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${
              editor.isActive('heading', { level: 1 })
                ? 'bg-indigo-600 text-white'
                : 'text-slate-300'
            }`}
            title="Heading 1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h7"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${
              editor.isActive('heading', { level: 2 })
                ? 'bg-indigo-600 text-white'
                : 'text-slate-300'
            }`}
            title="Heading 2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h12M4 12h12M4 18h7"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${
              editor.isActive('heading', { level: 3 })
                ? 'bg-indigo-600 text-white'
                : 'text-slate-300'
            }`}
            title="Heading 3"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h8M4 12h8M4 18h7"
              />
            </svg>
          </button>
        </div>

        {/* Text formatting */}
        <div className="flex items-center gap-1 border-r border-slate-700 pr-2 mr-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${
              editor.isActive('bold')
                ? 'bg-indigo-600 text-white'
                : 'text-slate-300'
            }`}
            title="Bold"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6zM6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${
              editor.isActive('italic')
                ? 'bg-indigo-600 text-white'
                : 'text-slate-300'
            }`}
            title="Italic"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${
              editor.isActive('underline')
                ? 'bg-indigo-600 text-white'
                : 'text-slate-300'
            }`}
            title="Underline"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 19h14M5 5h14"
              />
            </svg>
          </button>
        </div>

        {/* Lists */}
        <div className="flex items-center gap-1 border-r border-slate-700 pr-2 mr-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${
              editor.isActive('bulletList')
                ? 'bg-indigo-600 text-white'
                : 'text-slate-300'
            }`}
            title="Bullet List"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${
              editor.isActive('orderedList')
                ? 'bg-indigo-600 text-white'
                : 'text-slate-300'
            }`}
            title="Numbered List"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
              />
            </svg>
          </button>
        </div>

        {/* Link */}
        <div className="flex items-center gap-1 border-r border-slate-700 pr-2 mr-1">
          <button
            type="button"
            onClick={() => {
              const url = window.prompt('Enter URL:');
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }}
            className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${
              editor.isActive('link')
                ? 'bg-indigo-600 text-white'
                : 'text-slate-300'
            }`}
            title="Insert Link"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </button>
        </div>

        {/* Clear formatting */}
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().clearNodes().unsetAllMarks().run()
          }
          className="p-1.5 rounded hover:bg-slate-700 transition-colors text-slate-300"
          title="Clear Formatting"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Editor */}
      <div className="relative bg-slate-950 border border-slate-700 border-t-0 rounded-b-md">
        <EditorContent editor={editor} />
        {placeholder && !editor.getText().trim() && (
          <div className="absolute top-2 left-2 pointer-events-none text-slate-500 text-sm">
            {placeholder}
          </div>
        )}
      </div>

      {/* Character count */}
      {maxLength && (
        <div className="mt-1 text-xs text-slate-500 text-right">
          {textLength}/{maxLength}
        </div>
      )}

      <style>{`
        .rich-text-editor-wrapper .ProseMirror {
          outline: none;
          min-height: 150px;
          padding: 0.75rem;
        }
        .rich-text-editor-wrapper .ProseMirror p {
          margin-bottom: 0.5rem;
        }
        .rich-text-editor-wrapper .ProseMirror p:last-child {
          margin-bottom: 0;
        }
        .rich-text-editor-wrapper .ProseMirror h1 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          color: rgb(241 245 249);
        }
        .rich-text-editor-wrapper .ProseMirror h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 0.75rem;
          margin-bottom: 0.5rem;
          color: rgb(241 245 249);
        }
        .rich-text-editor-wrapper .ProseMirror h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-top: 0.75rem;
          margin-bottom: 0.5rem;
          color: rgb(241 245 249);
        }
        .rich-text-editor-wrapper .ProseMirror ul,
        .rich-text-editor-wrapper .ProseMirror ol {
          margin-left: 1.5rem;
          margin-bottom: 0.5rem;
          padding-left: 1.5rem;
        }
        .rich-text-editor-wrapper .ProseMirror ul {
          list-style-type: disc;
        }
        .rich-text-editor-wrapper .ProseMirror ol {
          list-style-type: decimal;
        }
        .rich-text-editor-wrapper .ProseMirror li {
          margin-bottom: 0.25rem;
          display: list-item;
        }
        .rich-text-editor-wrapper .ProseMirror a {
          color: rgb(129 140 248);
          text-decoration: underline;
        }
        .rich-text-editor-wrapper .ProseMirror a:hover {
          color: rgb(165 180 252);
        }
        .rich-text-editor-wrapper .ProseMirror strong {
          font-weight: 600;
        }
        .rich-text-editor-wrapper .ProseMirror em {
          font-style: italic;
        }
        .rich-text-editor-wrapper .ProseMirror u {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
