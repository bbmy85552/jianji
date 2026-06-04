import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  Trash2,
  Pencil,
  Upload,
  Globe,
  Lock,
  Users,
  Star,
  LayoutGrid,
  ListTree,
} from 'lucide-react';
import { api, asApiError, uploadFile } from '../../lib/api';
import { useUiStore } from '../../store/ui';
import { useAuthStore } from '../../store/auth';
import type { DocNode, DocTreeResponse } from '../../lib/types';
import { Modal } from '../../components/Modal';
import { DocTree, buildTree } from '../../components/docs/DocTree';

type Tab = 'mine' | 'public' | 'shared' | 'favorites';
type ViewLayout = 'grid' | 'tree';

export function DocsListPage() {
  const [tree, setTree] = useState<DocTreeResponse | null>(null);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('mine');
  const [layout, setLayout] = useState<ViewLayout>(
    () => (localStorage.getItem('docs.layout') as ViewLayout) || 'grid',
  );
  const [createOpen, setCreateOpen] = useState<{
    mode: 'create' | 'import';
    file?: File;
    parentId?: string | null;
  } | null>(null);
  const [createKind, setCreateKind] = useState<'PRIVATE' | 'PUBLIC'>('PRIVATE');
  const [createTitle, setCreateTitle] = useState('未命名文档');
  const navigate = useNavigate();
  const showToast = useUiStore((s) => s.showToast);
  const confirmDialog = useUiStore((s) => s.confirmDialog);
  const promptDialog = useUiStore((s) => s.promptDialog);
  const user = useAuthStore((s) => s.user);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('docs.layout', layout);
  }, [layout]);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<DocTreeResponse>('/docs/tree');
      setTree(data);
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitCreate = async () => {
    if (!createOpen) return;
    try {
      if (createOpen.mode === 'import' && createOpen.file) {
        const data = await uploadFile<{ doc: DocNode }>('/docs/import', createOpen.file, {
          workspaceKind: createKind,
        });
        showToast(`已导入：${data.doc.title}`, 'success');
        setCreateOpen(null);
        navigate(`/app/docs/${data.doc.id}`);
      } else {
        const { data } = await api.post<{ doc: DocNode }>('/docs', {
          workspaceKind: createKind,
          title: createTitle.trim() || '未命名文档',
          parentId: createOpen.parentId ?? null,
        });
        setCreateOpen(null);
        navigate(`/app/docs/${data.doc.id}`);
      }
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  };

  const moveDoc = async (doc: DocNode, newParentId: string | null) => {
    try {
      await api.patch(`/docs/${doc.id}`, { parentId: newParentId });
      await load();
      showToast('已移动文档', 'success');
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  };

  const rename = async (doc: DocNode) => {
    const t = await promptDialog({
      title: '重命名文档',
      message: '请输入新的文档标题：',
      defaultValue: doc.title,
      confirmText: '保存',
    });
    if (t === null) return;
    const title = t.trim();
    if (!title || title === doc.title) return;
    try {
      await api.patch(`/docs/${doc.id}`, { title });
      await load();
      showToast('已重命名', 'success');
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  };

  const remove = async (doc: DocNode) => {
    const ok = await confirmDialog({
      title: '删除文档',
      message: `确认删除文档「${doc.title}」？此操作不可恢复。`,
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/docs/${doc.id}`);
      await load();
      showToast('已删除', 'success');
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  };

  const list = (() => {
    if (!tree) return [];
    const raw =
      tab === 'mine'
        ? tree.mine
        : tab === 'public'
          ? tree.public
          : tab === 'shared'
            ? tree.shared
            : tree.favorites;
    if (!q) return raw;
    const kw = q.toLowerCase();
    return raw.filter((d) => d.title.toLowerCase().includes(kw));
  })();

  const treeNodes = useMemo(() => buildTree(list), [list]);
  const treeSupportsManage = tab === 'mine' || tab === 'public';
  const canDragMove = tab === 'mine' || (tab === 'public' && !!user?.role);

  const toggleFavorite = async (doc: DocNode) => {
    try {
      if (doc.isFavorite) await api.delete(`/docs/${doc.id}/favorite`);
      else await api.post(`/docs/${doc.id}/favorite`);
      await load();
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  };

  const isAdmin = user?.role === 'ADMIN';
  const canManage = (doc: DocNode) => {
    if (tab === 'mine') return true; // 自己的私人工作区
    if (tab === 'public') return isAdmin || doc.createdById === user?.id;
    return false; // shared 给我看的，不允许在列表内删除
  };

  return (
    <div className="py-6 sm:py-8 animate-fade-in-up">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl sm:text-[36px] font-serif font-bold text-text-primary mb-2">
            知识库
          </h1>
          <p className="text-text-secondary">私人空间用于个人沉淀；公共知识库面向所有注册用户。</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center bg-black/5 rounded-xl p-1 text-sm">
            <button
              onClick={() => setLayout('grid')}
              title="网格视图"
              className={`px-2 py-1.5 rounded-lg inline-flex items-center gap-1 transition-colors ${
                layout === 'grid'
                  ? 'bg-white shadow-sm text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <LayoutGrid size={14} /> 网格
            </button>
            <button
              onClick={() => setLayout('tree')}
              title="树形视图"
              className={`px-2 py-1.5 rounded-lg inline-flex items-center gap-1 transition-colors ${
                layout === 'tree'
                  ? 'bg-white shadow-sm text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <ListTree size={14} /> 树形
            </button>
          </div>
          <button
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-black/10 text-sm text-text-secondary hover:bg-black/5"
          >
            <Upload size={16} /> 导入文件
          </button>
          <button
            onClick={() => {
              setCreateKind(tab === 'public' ? 'PUBLIC' : 'PRIVATE');
              setCreateTitle('未命名文档');
              setCreateOpen({ mode: 'create' });
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-liquid-indigo text-white text-sm font-medium hover:bg-primary transition-colors shadow-md shadow-liquid-indigo/20"
          >
            <Plus size={16} /> 新建文档
          </button>
        </div>
      </header>

      <input
        ref={importInputRef}
        type="file"
        accept=".docx,.md,.markdown,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setCreateKind(tab === 'public' ? 'PUBLIC' : 'PRIVATE');
            setCreateOpen({ mode: 'import', file });
          }
          e.target.value = '';
        }}
      />

      <div className="flex items-center gap-1 mb-4 bg-black/5 rounded-xl p-1 w-fit text-sm">
        {([
          { v: 'mine', label: '我的知识库', icon: Lock },
          { v: 'public', label: '公共知识库', icon: Globe },
          { v: 'shared', label: '共享给我', icon: Users },
          { v: 'favorites', label: '我的收藏', icon: Star },
        ] as const).map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors ${
              tab === t.v ? 'bg-white shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <t.icon size={14} /> {t.label}
            <span className="text-xs text-text-secondary">
              {tree
                ? t.v === 'mine'
                  ? tree.mine.length
                  : t.v === 'public'
                    ? tree.public.length
                    : t.v === 'shared'
                      ? tree.shared.length
                      : tree.favorites.length
                : 0}
            </span>
          </button>
        ))}
      </div>

      <div className="relative max-w-md mb-6">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索标题…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-black/10 bg-white/80 text-sm outline-none focus:border-liquid-indigo focus:ring-2 focus:ring-liquid-indigo/15"
        />
      </div>

      {list.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-sm text-text-secondary text-center">
          {q
            ? '没有匹配的文档'
            : tab === 'mine'
              ? '私人知识库还没有内容，点击新建或导入开始记录'
              : tab === 'public'
                ? '公共知识库还没有内容，欢迎成为第一位贡献者'
                : tab === 'shared'
                  ? '暂时没有他人邀请你协作的文档'
                  : '还没有收藏任何文档，点击文档卡片上的星标即可收藏'}
        </div>
      ) : layout === 'tree' ? (
        <div className="glass-card rounded-2xl p-3">
          <DocTree
            tree={treeNodes}
            canManage={canManage}
            onSelect={(doc) => navigate(`/app/docs/${doc.id}`)}
            onCreateChild={
              treeSupportsManage
                ? (parent) => {
                    setCreateKind(tab === 'public' ? 'PUBLIC' : 'PRIVATE');
                    setCreateTitle('未命名文档');
                    setCreateOpen({
                      mode: 'create',
                      parentId: parent ? parent.id : null,
                    });
                  }
                : undefined
            }
            onRename={treeSupportsManage ? rename : undefined}
            onDelete={treeSupportsManage ? remove : undefined}
            onMove={canDragMove ? moveDoc : undefined}
          />
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {list.map((doc) => (
            <li key={doc.id} className="relative group">
              <button
                onClick={() => navigate(`/app/docs/${doc.id}`)}
                className="glass-card rounded-xl p-4 w-full text-left flex items-start gap-3 hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <div className="w-9 h-9 rounded-lg bg-liquid-indigo/10 text-liquid-indigo flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="min-w-0 flex-1 pr-10">
                  <div className="text-sm font-semibold text-text-primary truncate">{doc.title}</div>
                  <div className="text-xs text-text-secondary mt-1 truncate">
                    更新于 {new Date(doc.updatedAt).toLocaleString()}
                  </div>
                  {(tab === 'public' || tab === 'shared') && doc.createdBy && (
                    <div className="text-[11px] text-text-secondary mt-1 truncate">
                      上传者：{doc.createdBy.name}
                    </div>
                  )}
                </div>
              </button>
              <div className="absolute top-2 right-2 hidden group-hover:flex gap-0.5 bg-white/90 backdrop-blur rounded-lg border border-black/5 shadow-sm">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleFavorite(doc);
                  }}
                  className={`p-1.5 rounded-md ${
                    doc.isFavorite
                      ? 'text-amber-500 hover:bg-amber-50'
                      : 'text-text-secondary hover:text-amber-500 hover:bg-amber-50'
                  }`}
                  title={doc.isFavorite ? '取消收藏' : '收藏'}
                >
                  <Star size={14} fill={doc.isFavorite ? 'currentColor' : 'none'} />
                </button>
                {canManage(doc) && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        rename(doc);
                      }}
                      className="p-1.5 text-text-secondary hover:text-liquid-indigo hover:bg-liquid-indigo/5 rounded-md"
                      title="重命名"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(doc);
                      }}
                      className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-50 rounded-md"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
              {doc.isFavorite && (
                <span className="absolute top-2 left-2 text-amber-500 group-hover:hidden">
                  <Star size={14} fill="currentColor" />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!createOpen}
        title={createOpen?.mode === 'import' ? '导入到知识库' : '新建文档'}
        onClose={() => setCreateOpen(null)}
      >
        {createOpen && (
          <div className="space-y-3">
            {createOpen.mode === 'create' && (
              <div>
                <label className="text-xs text-text-secondary">文档标题</label>
                <input
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-black/10 bg-white"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-text-secondary">保存到</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCreateKind('PRIVATE')}
                  className={`text-left p-3 rounded-xl border ${
                    createKind === 'PRIVATE' ? 'border-liquid-indigo bg-liquid-indigo/5' : 'border-black/10'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Lock size={14} /> 我的私人知识库
                  </div>
                  <div className="text-xs text-text-secondary mt-1">仅自己可见</div>
                </button>
                <button
                  onClick={() => setCreateKind('PUBLIC')}
                  className={`text-left p-3 rounded-xl border ${
                    createKind === 'PUBLIC' ? 'border-liquid-indigo bg-liquid-indigo/5' : 'border-black/10'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Globe size={14} /> 公共知识库
                  </div>
                  <div className="text-xs text-text-secondary mt-1">
                    所有注册用户可查看，你将成为文档所有者
                  </div>
                </button>
              </div>
            </div>
            {createOpen.mode === 'import' && createOpen.file && (
              <div className="text-xs text-text-secondary border border-black/10 rounded p-2">
                文件：{createOpen.file.name}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCreateOpen(null)}
                className="px-3 py-1.5 rounded-lg border border-black/10 text-sm"
              >
                取消
              </button>
              <button
                onClick={submitCreate}
                className="px-4 py-1.5 rounded-lg bg-liquid-indigo text-white text-sm"
              >
                {createOpen.mode === 'import' ? '导入' : '创建'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
