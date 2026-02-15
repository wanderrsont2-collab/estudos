import { FolderPlus, Plus } from 'lucide-react';
import { getRingColorStyle } from './shared';

interface SubjectAddTopicGroupProps {
  subjectColor: string;
  newGroupName: string;
  onNewGroupNameChange: (value: string) => void;
  onAddGroup: () => void;
  showStructuredImport: boolean;
  onToggleStructuredImport: () => void;
  structuredImportText: string;
  onStructuredImportTextChange: (value: string) => void;
  onHandleStructuredImport: () => void;
}

export function SubjectAddTopicGroup({
  subjectColor,
  newGroupName,
  onNewGroupNameChange,
  onAddGroup,
  showStructuredImport,
  onToggleStructuredImport,
  structuredImportText,
  onStructuredImportTextChange,
  onHandleStructuredImport,
}: SubjectAddTopicGroupProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 space-y-3">
      <h3 className="font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
        <FolderPlus size={18} style={{ color: subjectColor }} />
        Adicionar Topico
      </h3>
      <p className="text-xs text-gray-500 dark:text-slate-400">
        Crie topicos para organizar seus assuntos (ex: "Matematica Basica", "Geometria", "Algebra")
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={newGroupName}
          onChange={e => onNewGroupNameChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onAddGroup()}
          placeholder='Nome do topico (ex: "Matematica Basica")'
          className="flex-1 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-white dark:bg-slate-950 dark:text-slate-100"
          style={getRingColorStyle(subjectColor)}
        />
        <button
          onClick={onAddGroup}
          className="px-5 py-2.5 rounded-lg text-white font-medium text-sm hover:opacity-90 transition-opacity shrink-0 flex items-center gap-2"
          style={{ backgroundColor: subjectColor }}
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Criar</span>
        </button>
      </div>

      {/* ─── Structured Import ───────────── */}
      <button
        onClick={onToggleStructuredImport}
        className="text-sm hover:underline transition-colors flex items-center gap-1"
        style={{ color: subjectColor }}
      >
        {showStructuredImport ? 'Fechar importacao' : '\u{1F4CB} Importar estrutura completa (topicos + assuntos)'}
      </button>

      {showStructuredImport && (
        <div className="space-y-2 bg-gray-50 dark:bg-slate-950/40 rounded-lg p-4">
          <p className="text-xs text-gray-600 dark:text-slate-300">
            Use <code className="bg-gray-200 dark:bg-slate-800 px-1 rounded">#</code> para criar topicos e linhas simples para assuntos:
          </p>
          <textarea
            value={structuredImportText}
            onChange={e => onStructuredImportTextChange(e.target.value)}
            placeholder={`# Matematica Basica\nQuatro operacoes\nFracoes\nPotenciacao\n\n# Geometria\nAreas\nVolumes\nTriangulos`}
            className="w-full border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent h-40 resize-y font-mono bg-white dark:bg-slate-950 dark:text-slate-100"
            style={getRingColorStyle(subjectColor)}
          />
          <button
            onClick={onHandleStructuredImport}
            className="px-5 py-2.5 rounded-lg text-white font-medium text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
            style={{ backgroundColor: subjectColor }}
          >
            <Plus size={16} /> Importar Tudo
          </button>
        </div>
      )}
    </div>
  );
}
