import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

/**
 * SessionTimeout Component
 * يعرض تحذيراً عندما تقترب الجلسة من الانتهاء
 * ويسمح للمستخدم بتمديد الجلسة
 */
const SessionTimeout: React.FC = () => {
  const { sessionTimeRemaining, isAuthenticated } = useAuth();
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    // إظهار التحذير عندما يبقى 5 دقائق أو أقل
    if (isAuthenticated && sessionTimeRemaining > 0 && sessionTimeRemaining <= 300) {
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }
  }, [sessionTimeRemaining, isAuthenticated]);

  const handleContinueSession = () => {
    // أي نشاط سيعيد تعيين المؤقت تلقائياً
    setShowWarning(false);
    // محاكاة نشاط
    document.dispatchEvent(new Event('mousedown'));
  };

  if (!showWarning) return null;

  const minutes = Math.floor(sessionTimeRemaining / 60);
  const seconds = sessionTimeRemaining % 60;

  return (
    <Modal isOpen={showWarning} onClose={() => setShowWarning(false)} title="تحذير انتهاء الجلسة">
      <div className="space-y-4">
        <p className="text-slate-300">
          ستنتهي جلستك قريباً بسبب عدم النشاط.
        </p>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-yellow-400 text-center text-xl font-bold">
            الوقت المتبقي: {minutes}:{seconds.toString().padStart(2, '0')}
          </p>
        </div>
        <p className="text-slate-400 text-sm">
          هل تريد الاستمرار في العمل؟
        </p>
        <div className="flex gap-3">
          <Button onClick={handleContinueSession} variant="primary" className="flex-1">
            متابعة الجلسة
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SessionTimeout;

