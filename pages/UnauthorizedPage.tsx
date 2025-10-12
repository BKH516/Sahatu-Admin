import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';

/**
 * UnauthorizedPage
 * صفحة تظهر عند محاولة الوصول لصفحة بدون صلاحيات
 */
const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-slate-800 rounded-lg p-8 shadow-xl border border-slate-700">
          <div className="mb-6">
            <div className="mx-auto w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
              <svg
                className="w-10 h-10 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white mb-4">
            غير مصرح لك بالدخول
          </h1>

          <p className="text-slate-300 mb-2">
            عذراً، ليس لديك الصلاحيات الكافية للوصول إلى هذه الصفحة.
          </p>

          <p className="text-slate-400 text-sm mb-8">
            إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع المسؤول.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => navigate(-1)}
              variant="secondary"
              className="flex-1"
            >
              العودة للخلف
            </Button>
            <Button
              onClick={() => navigate('/')}
              variant="primary"
              className="flex-1"
            >
              العودة للرئيسية
            </Button>
          </div>
        </div>

        <div className="mt-6 text-slate-500 text-sm">
          <p>رقم الخطأ: 403 - Forbidden</p>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;

