import { useState, useCallback, useEffect } from 'react';
import { loadData, saveData, getSubjectStats, getAllTopics, getDeadlineInfo, getReviewsDue } from './store';
import { StudyData, Subject } from './types';
import { type FSRSConfig, normalizeFSRSConfig } from './fsrs';
import { Overview } from './components/Overview';
import { SubjectDetail } from './components/SubjectDetail';
import { ReviewSystem } from './components/ReviewSystem';
import { BookOpen, LayoutDashboard, Brain } from 'lucide-react';

type View = 'overview' | 'subject' | 'reviews';

export function App() {
  const [data, setData] = useState<StudyData>(() => loadData());
  const [view, setView] = useState<View>('overview');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const updateSubject = useCallback(
    (updated: Subject) => {
      setData(prev => ({
        ...prev,
        subjects: prev.subjects.map(s => (s.id === updated.id ? updated : s)),
        lastUpdated: new Date().toISOString(),
      }));
    },
    []
  );

  const updateFsrsConfig = useCallback((nextConfig: FSRSConfig) => {
    setData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        fsrs: normalizeFSRSConfig(nextConfig),
      },
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  const selectedSubject = data.subjects.find(s => s.id === selectedSubjectId) || null;
  const reviewsDueCount = getReviewsDue(data.subjects).length;

  function navigateToSubject(id: string) {
    setSelectedSubjectId(id);
    setView('subject');
    setSidebarOpen(false);
  }

  function navigateToOverview() {
    setSelectedSubjectId(null);
    setView('overview');
    setSidebarOpen(false);
  }

  function navigateToReviews() {
    setView('reviews');
    setSelectedSubjectId(null);
    setSidebarOpen(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 font-['Inter',sans-serif]">
      {/* Top Navigation */}
      <nav className="bg-[#1a237e] text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg font-bold flex items-center gap-2">
              {'\u{1F4CA}'} Cronograma ENEM 2025
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={navigateToReviews}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors relative ${
                view === 'reviews' ? 'bg-purple-600 text-white' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <Brain size={16} />
              <span className="hidden sm:inline">Revisoes</span>
              {reviewsDueCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                  {reviewsDueCount}
                </span>
              )}
            </button>
            <button
              onClick={navigateToOverview}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                view === 'overview' ? 'bg-white/20' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <LayoutDashboard size={16} />
              <span className="hidden sm:inline">Visao Geral</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="flex max-w-7xl mx-auto">
        {/* Sidebar */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white shadow-lg lg:shadow-sm border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:transform-none ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          } pt-16 lg:pt-0 overflow-y-auto`}
        >
          <div className="p-4">
            {/* Review Button in Sidebar */}
            <button
              onClick={navigateToReviews}
              className={`w-full mb-4 px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all text-sm ${
                view === 'reviews'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              <Brain size={20} />
              <div className="flex-1 text-left">
                <p className="font-medium">Revisoes FSRS</p>
                <p className={`text-xs ${view === 'reviews' ? 'text-purple-200' : 'text-purple-500'}`}>
                  {reviewsDueCount > 0 ? `${'\u{1F514}'} ${reviewsDueCount} pendente(s)` : `${'\u2705'} Em dia`}
                </p>
              </div>
              {reviewsDueCount > 0 && (
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  view === 'reviews' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'
                }`}>
                  {reviewsDueCount}
                </span>
              )}
            </button>

            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">
              Disciplinas
            </h2>
            <div className="space-y-1">
              {data.subjects.map(subject => {
                const stats = getSubjectStats(subject);
                const allTopics_ = getAllTopics(subject);
                const overdueCount = allTopics_.filter(t => {
                  if (!t.deadline || t.studied) return false;
                  const info = getDeadlineInfo(t.deadline);
                  return info?.urgency === 'overdue';
                }).length;
                const highPrioCount = allTopics_.filter(t => !t.studied && t.priority === 'alta').length;
                const reviewsDue = allTopics_.filter(t => {
                  if (!t.fsrsNextReview) return false;
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return new Date(t.fsrsNextReview + 'T00:00:00') <= today;
                }).length;
                const isActive = view === 'subject' && selectedSubjectId === subject.id;

                return (
                  <button
                    key={subject.id}
                    onClick={() => navigateToSubject(subject.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all text-sm group ${
                      isActive
                        ? 'shadow-md text-white'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                    style={isActive ? { backgroundColor: subject.color } : undefined}
                  >
                    <span className="text-lg">{subject.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className={`font-medium truncate text-sm ${isActive ? 'text-white' : ''}`}>
                          {subject.name}
                        </p>
                        {overdueCount > 0 && (
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-orange-300' : 'bg-red-500'}`} title={`${overdueCount} prazo(s) vencido(s)`} />
                        )}
                        {highPrioCount > 0 && !overdueCount && (
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-red-300' : 'bg-red-400'}`} title={`${highPrioCount} prioridade(s) alta(s)`} />
                        )}
                        {reviewsDue > 0 && (
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-purple-300' : 'bg-purple-500'}`} title={`${reviewsDue} revisao(oes)`} />
                        )}
                      </div>
                      <p className={`text-xs ${isActive ? 'text-white/70' : 'text-gray-400'}`}>
                        {stats.studied}/{stats.total} estudados | {subject.topicGroups.length} topico{subject.topicGroups.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {stats.total > 0 && (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : subject.color + '15',
                          color: isActive ? 'white' : subject.color,
                        }}
                      >
                        {Math.round(stats.progresso * 100)}%
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tips in sidebar */}
          <div className="p-4 border-t border-gray-100">
            <div className="bg-purple-50 rounded-xl p-3 text-xs text-purple-700">
              <p className="font-bold mb-1">{'\u{1F9E0}'} Dica FSRS</p>
              <p>Marque assuntos como estudados e inicie revisoes para otimizar sua retencao de conteudo!</p>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 min-w-0">
          {view === 'reviews' ? (
            <ReviewSystem
              subjects={data.subjects}
              fsrsConfig={data.settings.fsrs}
              onUpdateFsrsConfig={updateFsrsConfig}
              onUpdateSubject={updateSubject}
              onNavigateToSubject={navigateToSubject}
            />
          ) : view === 'subject' && selectedSubject ? (
            <SubjectDetail
              subject={selectedSubject}
              fsrsConfig={data.settings.fsrs}
              onBack={navigateToOverview}
              onUpdate={updateSubject}
            />
          ) : (
            <Overview
              subjects={data.subjects}
              onSelectSubject={navigateToSubject}
              onOpenReviews={navigateToReviews}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 lg:hidden z-40 safe-area-pb">
        <div className="flex">
          <button
            onClick={navigateToOverview}
            className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs ${
              view === 'overview' ? 'text-[#1a237e] font-bold' : 'text-gray-400'
            }`}
          >
            <LayoutDashboard size={20} />
            Visao Geral
          </button>
          <button
            onClick={navigateToReviews}
            className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs relative ${
              view === 'reviews' ? 'text-purple-700 font-bold' : 'text-gray-400'
            }`}
          >
            <Brain size={20} />
            Revisoes
            {reviewsDueCount > 0 && (
              <span className="absolute top-1.5 right-1/4 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {reviewsDueCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs ${
              sidebarOpen ? 'text-[#1a237e] font-bold' : 'text-gray-400'
            }`}
          >
            <BookOpen size={20} />
            Disciplinas
          </button>
        </div>
      </div>
    </div>
  );
}

