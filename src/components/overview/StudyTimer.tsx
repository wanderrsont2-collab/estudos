import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { StudySession, Subject } from '../../types';

const STUDY_SESSION_TYPE_OPTIONS: Array<{ value: StudySession['type']; label: string }> = [
  { value: 'questions', label: 'Questoes' },
  { value: 'review', label: 'Revisao' },
  { value: 'reading', label: 'Leitura' },
  { value: 'essay', label: 'Redacao' },
];

interface StudyTimerProps {
  subjects: Subject[];
  onSessionEnd: (session: Omit<StudySession, 'id'>) => void;
}

export const StudyTimer = memo(function StudyTimer({ subjects, onSessionEnd }: StudyTimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sessionType, setSessionType] = useState<StudySession['type']>('questions');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const startRef = useRef<Date | null>(null);
  const intervalRef = useRef<number | null>(null);
  const subjectIdRef = useRef(subjectId);
  subjectIdRef.current = subjectId;
  const sessionTypeRef = useRef(sessionType);
  sessionTypeRef.current = sessionType;

  useEffect(() => {
    if (subjects.length === 0) {
      setSubjectId('');
      return;
    }
    setSubjectId(prev => {
      if (subjects.some(s => s.id === prev)) return prev;
      return subjects[0].id;
    });
  }, [subjects]);

  useEffect(() => () => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const startTime = startRef.current;
    if (startTime) {
      const endTime = new Date();
      const durationSeconds = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));
      onSessionEnd({
        subjectId: subjectIdRef.current,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMinutes: Math.floor(durationSeconds / 60),
        type: sessionTypeRef.current,
      });
    }
    startRef.current = null;
    setElapsed(0);
    setIsRunning(false);
  }, [onSessionEnd]);

  const startTimer = useCallback(() => {
    if (!subjectIdRef.current) return;
    startRef.current = new Date();
    setElapsed(0);
    intervalRef.current = window.setInterval(() => setElapsed(prev => prev + 1), 1000);
    setIsRunning(true);
  }, []);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Sessao de estudo</p>
          <p className="text-2xl font-mono font-bold text-slate-700 dark:text-white">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </p>
        </div>
        <button
          onClick={isRunning ? stopTimer : startTimer}
          disabled={!subjectId && !isRunning}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
            isRunning ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'
          }`}
        >
          {isRunning ? 'Parar' : 'Iniciar'}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-500">Disciplina
          <select value={subjectId} onChange={event => setSubjectId(event.target.value)} disabled={isRunning} className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs">
            {subjects.length === 0 ? <option value="">Sem disciplinas</option> : subjects.map(subject => <option key={`study-timer-subject-${subject.id}`} value={subject.id}>{subject.emoji} {subject.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">Tipo
          <select value={sessionType} onChange={event => setSessionType(event.target.value as StudySession['type'])} disabled={isRunning} className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs">
            {STUDY_SESSION_TYPE_OPTIONS.map(option => <option key={`study-timer-type-${option.value}`} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
});
