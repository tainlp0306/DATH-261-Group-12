import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

const LearnerAccessTracker = () => {
  const { pathname } = useLocation();
  const { isAuthenticated, isLearner } = useAuth();
  const lastActivityAt = useRef(0);
  const courseId = pathname.match(/^\/courses\/(\d+)(?:\/|$)/)?.[1];

  useEffect(() => {
    if (!isAuthenticated || !isLearner || !courseId) return undefined;
    lastActivityAt.current = Date.now();

    const record = async () => {
      try {
        await authApi.recordCourseAccess(courseId);
      } catch (error) {
        if (error.response?.status !== 403) {
          console.error('Failed to record learner access activity:', error);
        }
      }
    };
    const markActive = () => { lastActivityAt.current = Date.now(); };
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastActivityAt.current <= 5 * 60 * 1000) {
        record();
      }
    }, 60 * 1000);

    record();
    window.addEventListener('pointerdown', markActive, { passive: true });
    window.addEventListener('keydown', markActive);
    window.addEventListener('scroll', markActive, { passive: true });
    window.addEventListener('touchstart', markActive, { passive: true });

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener('pointerdown', markActive);
      window.removeEventListener('keydown', markActive);
      window.removeEventListener('scroll', markActive);
      window.removeEventListener('touchstart', markActive);
    };
  }, [courseId, isAuthenticated, isLearner]);

  return null;
};

export default LearnerAccessTracker;
