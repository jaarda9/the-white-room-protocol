import { useState, useCallback, useEffect } from 'react';
import { UserProgress, DEFAULT_PROGRESS, ACHIEVEMENTS, COURSE_NODES, NodeStatus } from '@/data/courseData';

const STORAGE_KEY = 'learnquest-progress';

function loadProgress(): UserProgress {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { ...DEFAULT_PROGRESS };
}

function saveProgress(p: UserProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function useProgress() {
  const [progress, setProgress] = useState<UserProgress>(loadProgress);

  useEffect(() => {
    // Update streak on load
    const today = new Date().toDateString();
    const last = progress.lastActiveDate;
    if (last && last !== today) {
      const lastDate = new Date(last);
      const diff = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
      if (diff > 1) {
        setProgress(p => {
          const updated = { ...p, streak: 0 };
          saveProgress(updated);
          return updated;
        });
      }
    }
  }, []);

  const getNodeStatus = useCallback((nodeId: string): NodeStatus => {
    if (progress.completedNodes.includes(nodeId)) return 'completed';
    const node = COURSE_NODES.find(n => n.id === nodeId);
    if (!node) return 'locked';
    const allPrereqsMet = node.prerequisites.every(p => progress.completedNodes.includes(p));
    return allPrereqsMet ? 'available' : 'locked';
  }, [progress.completedNodes]);

  const completeNode = useCallback((nodeId: string, quizScore: number) => {
    setProgress(prev => {
      if (prev.completedNodes.includes(nodeId)) return prev;
      const node = COURSE_NODES.find(n => n.id === nodeId);
      const xpGain = node?.xpReward ?? 100;
      const today = new Date().toDateString();
      const last = prev.lastActiveDate;
      let newStreak = prev.streak;
      if (last !== today) {
        const lastDate = last ? new Date(last) : null;
        const diff = lastDate ? Math.floor((Date.now() - lastDate.getTime()) / 86400000) : 2;
        newStreak = diff <= 1 ? prev.streak + 1 : 1;
      }

      const updated: UserProgress = {
        ...prev,
        completedNodes: [...prev.completedNodes, nodeId],
        quizScores: { ...prev.quizScores, [nodeId]: quizScore },
        xp: prev.xp + xpGain,
        streak: newStreak,
        lastActiveDate: today,
      };

      // Check achievements
      const newAchievements = ACHIEVEMENTS
        .filter(a => !updated.achievements.includes(a.id) && a.condition(updated))
        .map(a => a.id);
      updated.achievements = [...updated.achievements, ...newAchievements];

      saveProgress(updated);
      return updated;
    });
  }, []);

  const resetProgress = useCallback(() => {
    const fresh = { ...DEFAULT_PROGRESS, startDate: new Date().toISOString() };
    saveProgress(fresh);
    setProgress(fresh);
  }, []);

  return { progress, getNodeStatus, completeNode, resetProgress };
}
