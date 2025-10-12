import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
        <h1 className="text-9xl font-extrabold text-cyan-400 tracking-widest">404</h1>
        <div className="bg-slate-700 px-2 text-sm rounded rotate-12 absolute">
            الصفحة غير موجودة
        </div>
        <p className="mt-4 text-lg text-slate-300">
            عذراً، الصفحة التي تبحث عنها غير موجودة.
        </p>
        <Link 
            to="/" 
            className="mt-6 inline-block px-5 py-3 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 focus:outline-none focus:ring"
        >
            العودة إلى لوحة التحكم
        </Link>
    </div>
  );
};

export default NotFoundPage;
