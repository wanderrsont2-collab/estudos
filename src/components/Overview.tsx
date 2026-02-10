import { Subject } from '../types';
import {
  getOverallStats, getSubjectStats, getUpcomingDeadlines,
  getPriorityStats, getDeadlineInfo, PRIORITY_CONFIG, getAllTopics,
  getReviewsDue,
} from '../store';
import { getReviewStatus } from '../fsrs';
import {
  BarChart3, BookOpen, CheckCircle2, FileQuestion, Target, TrendingUp,
  Calendar, AlertTriangle, Clock, Flag, Brain, ArrowRight,
} from 'lucide-react';

interface OverviewProps {
  subjects: Subject[];
  onSelectSubject: (id: string) => void;
  onOpenReviews: () => void;
}

function ProgressBar({ value, color, height = 'h-3' }: { value: number; color: string; height?: string }) {
  return (
    <div className={`w-full bg-gray-200 rounded-full ${height} overflow-hidden`}>
      <div
        className={`${height} rounded-full transition-all duration-700 ease-out`}
        style={{ width: `${Math.min(value * 100, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function formatPercent(v: number) {
  return `${Math.round(v * 100)}%`;
}

export function Overview({ subjects, onSelectSubject, onOpenReviews }: OverviewProps) {
  const overall = getOverallStats(subjects);
  const deadlines = getUpcomingDeadlines(subjects);
  const priorityStats = getPriorityStats(subjects);
  const reviewsDue = getReviewsDue(subjects);
  const now = new Date();
  const formatted = now.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const _cards = [
    { label: '\u{1F4DA} Estudados', value: overall.studiedTopics, _icon: BookOpen },
    { label: '\u{1F4CB} A Estudar', value: overall.totalTopics, _icon: FileQuestion },
    { label: '\u{1F4DD} Questoes', value: overall.questionsTotal, _icon: BarChart3 },
    { label: '\u2713 Acertos', value: overall.questionsCorrect, _icon: CheckCircle2 },
    { label: '\u{1F4CA} Rendimento', value: formatPercent(overall.rendimento), _icon: TrendingUp },
    { label: '\u{1F3AF} Progresso', value: formatPercent(overall.progresso), _icon: Target },
  ];

  function getMetaStatus(tipo: string) {
    if (tipo === 'questoes') {
      if (overall.questionsTotal >= 1000) return { text: '\u2705 Meta atingida!', color: 'text-green-600' };
      return { text: `${overall.questionsTotal} de 1000 (${formatPercent(overall.questionsTotal / 1000)})`, color: 'text-yellow-600' };
    }
    if (tipo === 'rendimento') {
      if (overall.rendimento >= 0.7) return { text: '\u2705 Meta atingida!', color: 'text-green-600' };
      if (overall.rendimento >= 0.5) return { text: '\u{1F7E1} Bom progresso', color: 'text-yellow-600' };
      return { text: '\u{1F534} Precisa melhorar', color: 'text-red-600' };
    }
    if (tipo === 'conteudos') {
      if (overall.progresso >= 1) return { text: '\u2705 Tudo estudado!', color: 'text-green-600' };
      if (overall.progresso >= 0.7) return { text: '\u{1F7E1} Quase la!', color: 'text-yellow-600' };
      return { text: '\u{1F534} Continue estudando', color: 'text-red-600' };
    }
    return { text: '', color: '' };
  }

  const overdueDeadlines = deadlines.filter(d => getDeadlineInfo(d.topic.deadline)?.urgency === 'overdue');
  const upcomingDeadlines = deadlines.filter(d => {
    const info = getDeadlineInfo(d.topic.deadline);
    return info && info.urgency !== 'overdue';
  }).slice(0, 8);

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-[#1a237e] to-[#303f9f] p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzEuNjU3IDAgMy0xLjM0MyAzLTNzLTEuMzQzLTMtMy0zLTMgMS4zNDMtMyAzIDEuMzQzIDMgMyAzem0wIDMwYzEuNjU3IDAgMy0xLjM0MyAzLTNzLTEuMzQzLTMtMy0zLTMgMS4zNDMtMyAzIDEuMzQzIDMgMyAzem0tMTgtMTVjMS42NTcgMCAzLTEuMzQzIDMtM3MtMS4zNDMtMy0zLTMtMyAxLjM0My0zIDMgMS4zNDMgMyAzIDN6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        <div className="relative">
          <h1 className="text-2xl md:text-3xl font-bold text-center">{'\u{1F4CA}'} VISAO GERAL - ENEM 2025</h1>
          <p className="text-center text-blue-200 mt-1 text-sm italic">
            Acompanhamento consolidado de todas as disciplinas
          </p>
        </div>
      </div>

      {/* Alert Banners */}
      {overdueDeadlines.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-700 text-sm">
              {"\u26A0\uFE0F"} {overdueDeadlines.length} prazo{overdueDeadlines.length > 1 ? 's' : ''} vencido{overdueDeadlines.length > 1 ? 's' : ''}!
            </p>
            <div className="mt-1 space-y-0.5">
              {overdueDeadlines.slice(0, 5).map(d => {
                const info = getDeadlineInfo(d.topic.deadline);
                return (
                  <p key={d.topic.id} className="text-xs text-red-600">
                    {d.subjectEmoji} <strong>{d.topic.name}</strong> {"\u2192"} {d.groupName} ({info?.text})
                  </p>
                );
              })}
              {overdueDeadlines.length > 5 && (
                <p className="text-xs text-red-500 italic">e mais {overdueDeadlines.length - 5}...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FSRS Reviews Due Alert */}
      {reviewsDue.length > 0 && (
        <div
          className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3 cursor-pointer hover:bg-purple-100 transition-colors"
          onClick={onOpenReviews}
        >
          <Brain size={20} className="text-purple-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-purple-700 text-sm">
              {"\u{1F514}"} {reviewsDue.length} revisao(oes) pendente{reviewsDue.length > 1 ? 's' : ''}!
            </p>
            <div className="mt-1 space-y-0.5">
              {reviewsDue.slice(0, 5).map(r => {
                const status = getReviewStatus(r.topic.fsrsNextReview);
                return (
                  <p key={r.topic.id} className="text-xs text-purple-600">
                    {r.subjectEmoji} <strong>{r.topic.name}</strong> {"\u2014"} {r.groupName}
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${status.className}`}>{status.text}</span>
                  </p>
                );
              })}
              {reviewsDue.length > 5 && (
                <p className="text-xs text-purple-500 italic">e mais {reviewsDue.length - 5}...</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 text-purple-600 text-sm font-medium shrink-0">
            Revisar <ArrowRight size={16} />
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div>
        <div className="bg-[#303f9f] text-white font-bold text-center py-2.5 rounded-t-xl text-lg">
          {'\u{1F4C8}'} RESUMO GERAL
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-0 border border-[#9fa8da] rounded-b-xl overflow-hidden">
          {_cards.map((card, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center p-4 bg-[#e8eaf6] border-r border-b border-[#9fa8da] last:border-r-0"
            >
              <span className="text-xs font-bold text-[#1a237e] mb-2 text-center">{card.label}</span>
              <span className="text-2xl md:text-3xl font-bold text-[#1a237e]">{card.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <ProgressBar value={overall.progresso} color="#4caf50" height="h-5" />
        <p className="text-center text-green-700 mt-2 text-sm italic">
          {overall.studiedTopics} de {overall.totalTopics} conteudos estudados ({formatPercent(overall.progresso)})
        </p>
      </div>

      {/* Priority & Deadline & Reviews Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Priority Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <Flag size={16} className="text-gray-600" />
            <h3 className="font-bold text-gray-700 text-sm">Prioridades (Pendentes)</h3>
          </div>
          <div className="p-4">
            {priorityStats.total === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">Nenhum conteudo pendente</p>
            ) : (
              <div className="space-y-3">
                {([
                  { key: 'alta' as const, count: priorityStats.alta },
                  { key: 'media' as const, count: priorityStats.media },
                  { key: 'baixa' as const, count: priorityStats.baixa },
                ]).map(({ key, count }) => {
                  const config = PRIORITY_CONFIG[key];
                  const pct = priorityStats.total > 0 ? count / priorityStats.total : 0;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-sm w-20 shrink-0">
                        {config.emoji} {config.label}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-500 ${
                            key === 'alta' ? 'bg-red-500' : key === 'media' ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${pct * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-600 w-8 text-right">{count}</span>
                    </div>
                  );
                })}
                {priorityStats.sem > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-20 shrink-0 text-gray-400">{'\u26AA'} Sem</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-2.5 rounded-full bg-gray-300 transition-all duration-500"
                        style={{ width: `${(priorityStats.sem / priorityStats.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-400 w-8 text-right">{priorityStats.sem}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <Calendar size={16} className="text-gray-600" />
            <h3 className="font-bold text-gray-700 text-sm">Proximos Prazos</h3>
          </div>
          <div className="p-4">
            {upcomingDeadlines.length === 0 && overdueDeadlines.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">Nenhum prazo definido</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {upcomingDeadlines.map(d => {
                  const info = getDeadlineInfo(d.topic.deadline);
                  return (
                    <div
                      key={d.topic.id}
                      className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors"
                      onClick={() => {
                        const sub = subjects.find(s => s.name === d.subjectName);
                        if (sub) onSelectSubject(sub.id);
                      }}
                    >
                      <span className="shrink-0">{d.subjectEmoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-gray-800 text-xs font-medium">{d.topic.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{d.subjectName}{' -> '}{d.groupName}</p>
                      </div>
                      {info && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 flex items-center gap-1 ${info.className}`}>
                          <Clock size={10} />
                          {info.text}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* FSRS Reviews Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <Brain size={16} className="text-purple-600" />
            <h3 className="font-bold text-gray-700 text-sm">Revisoes FSRS</h3>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Pendentes</span>
                <span className={`text-sm font-bold ${overall.reviewsDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {overall.reviewsDue > 0 ? `\u{1F514} ${overall.reviewsDue}` : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Com revisao ativa</span>
                <span className="text-sm font-bold text-purple-600">
                  {subjects.reduce((s, sub) => s + getAllTopics(sub).filter(t => t.reviewHistory.length > 0).length, 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total de revisoes</span>
                <span className="text-sm font-bold text-gray-600">
                  {subjects.reduce((s, sub) => s + getAllTopics(sub).reduce((rs, t) => rs + t.reviewHistory.length, 0), 0)}
                </span>
              </div>
              {overall.reviewsDue > 0 && (
                <button
                  onClick={onOpenReviews}
                  className="w-full mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Brain size={16} /> Revisar Agora
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table by Discipline */}
      <div>
        <div className="bg-[#303f9f] text-white font-bold text-center py-2.5 rounded-t-xl text-lg">
          {'\u{1F4DA}'} DESEMPENHO POR DISCIPLINA
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#1a237e] text-white text-sm">
                <th className="py-3 px-4 text-left font-bold">DISCIPLINA</th>
                <th className="py-3 px-4 text-center font-bold">TOPICOS</th>
                <th className="py-3 px-4 text-center font-bold">ESTUDADOS</th>
                <th className="py-3 px-4 text-center font-bold">{"\u{1F4CA}"} TOTAL</th>
                <th className="py-3 px-4 text-center font-bold">QUESTOES</th>
                <th className="py-3 px-4 text-center font-bold">ACERTOS</th>
                <th className="py-3 px-4 text-center font-bold">RENDIMENTO</th>
                <th className="py-3 px-4 text-center font-bold">{'\u{1F9E0}'} REV.</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject, i) => {
                const stats = getSubjectStats(subject);
                const allT = getAllTopics(subject);
                const highPrio = allT.filter(t => !t.studied && t.priority === 'alta').length;
                const overdue = allT.filter(t => !t.studied && t.deadline && getDeadlineInfo(t.deadline)?.urgency === 'overdue').length;
                return (
                  <tr
                    key={subject.id}
                    className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 cursor-pointer transition-colors`}
                    onClick={() => onSelectSubject(subject.id)}
                  >
                    <td className="py-3 px-4 font-bold" style={{ color: subject.color }}>
                      <div className="flex items-center gap-2">
                        {subject.emoji} {subject.name}
                        {highPrio > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                            {'\u{1F534}'} {highPrio}
                          </span>
                        )}
                        {overdue > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                            {'\u26A0\uFE0F'} {overdue}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-500">{subject.topicGroups.length}</td>
                    <td className="py-3 px-4 text-center">{stats.studied}</td>
                    <td className="py-3 px-4 text-center">{stats.total}</td>
                    <td className="py-3 px-4 text-center">{stats.questionsTotal}</td>
                    <td className="py-3 px-4 text-center">{stats.questionsCorrect}</td>
                    <td className="py-3 px-4 text-center font-semibold">{formatPercent(stats.rendimento)}</td>
                    <td className="py-3 px-4 text-center">
                      {stats.reviewsDue > 0 ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                          {'\u{1F514}'} {stats.reviewsDue}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {/* Total Row */}
              <tr className="bg-[#1a237e] text-white font-bold">
                <td className="py-3 px-4">{"\u{1F4CA}"} TOTAL</td>
                <td className="py-3 px-4 text-center">{subjects.reduce((s, sub) => s + sub.topicGroups.length, 0)}</td>
                <td className="py-3 px-4 text-center">{overall.studiedTopics}</td>
                <td className="py-3 px-4 text-center">{overall.totalTopics}</td>
                <td className="py-3 px-4 text-center">{overall.questionsTotal}</td>
                <td className="py-3 px-4 text-center">{overall.questionsCorrect}</td>
                <td className="py-3 px-4 text-center">{formatPercent(overall.rendimento)}</td>
                <td className="py-3 px-4 text-center">
                  {overall.reviewsDue > 0 ? `\u{1F514} ${overall.reviewsDue}` : '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Progress per Discipline */}
      <div>
        <div className="bg-[#303f9f] text-white font-bold text-center py-2.5 rounded-t-xl text-lg">
          {"\u{1F4CA}"} PROGRESSO POR DISCIPLINA
        </div>
        <div className="bg-white rounded-b-xl border border-[#9fa8da] divide-y divide-gray-100">
          {subjects.map(subject => {
            const stats = getSubjectStats(subject);
            return (
              <div
                key={subject.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onSelectSubject(subject.id)}
              >
                <span className="font-bold w-48 shrink-0 text-sm" style={{ color: subject.color }}>
                  {subject.emoji} {subject.name}
                </span>
                <div className="flex-1">
                  <ProgressBar value={stats.progresso} color={subject.color} />
                </div>
                <span className="font-bold text-sm w-12 text-right" style={{ color: subject.color }}>
                  {formatPercent(stats.progresso)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Goals */}
      <div>
        <div className="bg-[#303f9f] text-white font-bold text-center py-2.5 rounded-t-xl text-lg">
          {'\u{1F3AF}'} METAS E STATUS
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-[#9fa8da]">
            <thead>
              <tr className="bg-[#e3f2fd]">
                <th className="py-2.5 px-4 text-center font-bold text-sm">{'\u{1F4CB}'} META</th>
                <th className="py-2.5 px-4 text-center font-bold text-sm">{'\u{1F3AF}'} VALOR ALVO</th>
                <th className="py-2.5 px-4 text-center font-bold text-sm">{'\u{1F4CA}'} ATUAL</th>
                <th className="py-2.5 px-4 text-center font-bold text-sm">{'\u{1F4C8}'} STATUS</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                <td className="py-2.5 px-4 text-center">Questoes Resolvidas</td>
                <td className="py-2.5 px-4 text-center font-bold">1000</td>
                <td className="py-2.5 px-4 text-center">{overall.questionsTotal}</td>
                <td className={`py-2.5 px-4 text-center ${getMetaStatus('questoes').color}`}>
                  {getMetaStatus('questoes').text}
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="py-2.5 px-4 text-center">Rendimento Medio</td>
                <td className="py-2.5 px-4 text-center font-bold">70%</td>
                <td className="py-2.5 px-4 text-center">{formatPercent(overall.rendimento)}</td>
                <td className={`py-2.5 px-4 text-center ${getMetaStatus('rendimento').color}`}>
                  {getMetaStatus('rendimento').text}
                </td>
              </tr>
              <tr className="bg-white">
                <td className="py-2.5 px-4 text-center">Conteudos Estudados</td>
                <td className="py-2.5 px-4 text-center font-bold">100%</td>
                <td className="py-2.5 px-4 text-center">{formatPercent(overall.progresso)}</td>
                <td className={`py-2.5 px-4 text-center ${getMetaStatus('conteudos').color}`}>
                  {getMetaStatus('conteudos').text}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-amber-700 text-sm italic">
        {'\u{1F4A1}'} Priorize as materias com menor rendimento | Revise os conteudos com prioridade alta {'\u{1F534}'} | Fique atento aos prazos {'\u23F0'} | Use o FSRS para otimizar suas revisoes {'\u{1F9E0}'}
      </div>

      {/* Last Updated */}
      <p className="text-center text-gray-400 text-xs italic">
        {'\u{1F4C5}'} Ultima atualizacao: {formatted}
      </p>
    </div>
  );
}

